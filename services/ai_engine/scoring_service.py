"""
TuneIn Scoring Service — v5 (definitive fix)
=============================================
Root causes fixed vs v4:
  1. get_user_dashboard called get_user_activity() 3× inside the async
     function, each of which re-fetched _get_all_club_sets() +
     _get_all_category_sets() from Supabase. That's up to 9 extra
     round-trips inside a single dashboard request → timeout → empty
     top_similar returned to frontend → "No other users found yet."

  2. Club/category sets are now cached alongside scores (same TTL).
     All similarity math reuses the same in-memory dicts within a
     single request cycle.

  3. get_user_activity accepts pre-fetched club_sets so callers can
     pass the already-loaded dict instead of re-querying.

  4. Leaderboard always injects is_current_user=True for requesting
     user so frontend .find(e => e.is_current_user) always succeeds.
"""

import logging
import os
import time
from dataclasses import dataclass

from supabase import create_client, Client as SupabaseClient

logger = logging.getLogger(__name__)

_supabase_client: SupabaseClient = None


def get_supabase() -> SupabaseClient:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _supabase_client


@dataclass
class HGTConfig:
    weight_likes: float = 0.40
    weight_clubs: float = 0.35
    weight_hgt:   float = 0.25


class ScoringService:
    def __init__(self, neo4j_uri="", neo4j_user="", neo4j_password="",
                 config=None, cache_ttl=300):
        self._config = config or HGTConfig()
        self.supabase = get_supabase()

        # Scores cache
        self._scores_cache: dict = {}
        self._scores_built_at: float = 0.0
        self._scores_ttl: int = 120

        # Club / category set caches (same TTL as scores)
        self._clubs_cache: dict = {}
        self._cats_cache:  dict = {}
        self._sets_built_at: float = 0.0

    # ─── Supabase helper ───────────────────────────────────────────────────

    def _safe(self, table, cols, filters=None, order_col=None,
              order_desc=False, limit=None):
        """One-liner Supabase fetch that never raises."""
        try:
            q = self.supabase.table(table).select(cols)
            for k, v in (filters or {}).items():
                q = q.eq(k, v)
            if order_col:
                q = q.order(order_col, desc=order_desc)
            if limit:
                q = q.limit(limit)
            return q.execute().data or []
        except Exception as e:
            logger.warning(f"{table} fetch failed: {e}")
            return []

    # ─── User discovery ────────────────────────────────────────────────────

    def _discover_all_user_ids(self) -> set:
        ids: set = set()
        for table, col in [
            ("profiles",       "id"),
            ("club_members",   "user_id"),
            ("post_reactions", "user_id"),
            ("strava_stats",   "user_id"),
            ("github_stats",   "user_id"),
            ("movie_reviews",  "user_id"),
            ("game_reviews",   "user_id"),
        ]:
            rows = self._safe(table, col)
            ids.update(r[col] for r in rows if r.get(col))
        return ids

    # ─── Scores ────────────────────────────────────────────────────────────

    def get_all_user_scores(self) -> dict:
        now = time.time()
        if self._scores_cache and (now - self._scores_built_at) < self._scores_ttl:
            return self._scores_cache

        likes_rows  = self._safe("post_reactions", "user_id", {"reaction": "like"})
        clubs_rows  = self._safe("club_members",   "user_id")
        strava_rows = self._safe("strava_stats",   "user_id, total_distance_km")
        github_rows = self._safe("github_stats",   "user_id, total_commits, streak_days")
        movie_rows  = self._safe("movie_reviews",  "user_id")
        game_rows   = self._safe("game_reviews",   "user_id")

        def cmap(rows, key="user_id"):
            m: dict = {}
            for r in rows:
                uid = r[key]; m[uid] = m.get(uid, 0) + 1
            return m

        likes_c = cmap(likes_rows)
        clubs_c = cmap(clubs_rows)
        movie_c = cmap(movie_rows)
        game_c  = cmap(game_rows)
        strava_m = {r["user_id"]: float(r.get("total_distance_km") or 0)
                    for r in strava_rows}
        github_m = {r["user_id"]: {"commits": int(r.get("total_commits") or 0),
                                   "streak":  int(r.get("streak_days")   or 0)}
                    for r in github_rows}

        all_uids = self._discover_all_user_ids()
        all_uids |= set(likes_c) | set(clubs_c) | set(strava_m) \
                  | set(github_m) | set(movie_c) | set(game_c)

        scores = {}
        for uid in all_uids:
            s  = likes_c.get(uid, 0) * 2.0
            s += clubs_c.get(uid, 0) * 15.0
            if uid in strava_m:
                s += 10.0 + strava_m[uid] * 0.5
            gh = github_m.get(uid, {})
            s += gh.get("commits", 0) * 1.0
            s += gh.get("streak",  0) * 5.0
            s += movie_c.get(uid, 0) * 3.0
            s += game_c.get(uid, 0)  * 3.0
            scores[uid] = round(s, 1)

        self._scores_cache    = scores
        self._scores_built_at = time.time()
        logger.info(f"Scores for {len(scores)} users: {scores}")
        return scores

    def invalidate_scores_cache(self):
        self._scores_cache    = {}
        self._scores_built_at = 0.0
        self._clubs_cache     = {}
        self._cats_cache      = {}
        self._sets_built_at   = 0.0

    # ─── Club / category sets (cached) ────────────────────────────────────

    def _get_sets(self) -> tuple[dict, dict]:
        """
        FIX: Returns (club_sets, category_sets) from cache.
        Previously every call to get_user_activity() re-fetched both tables.
        Now they are loaded once and reused for the entire request cycle.
        """
        now = time.time()
        if self._clubs_cache and (now - self._sets_built_at) < self._scores_ttl:
            return self._clubs_cache, self._cats_cache

        # Clubs
        clubs: dict = {}
        for r in self._safe("club_members", "user_id, clubs(name)"):
            name = (r.get("clubs") or {}).get("name", "")
            if name:
                clubs.setdefault(r["user_id"], set()).add(name.lower())

        # Categories (from liked posts)
        cats: dict = {}
        for r in self._safe("post_reactions", "user_id, posts(category)",
                             {"reaction": "like"}):
            cat = (r.get("posts") or {}).get("category", "")
            if cat:
                cats.setdefault(r["user_id"], set()).add(cat.lower())

        self._clubs_cache   = clubs
        self._cats_cache    = cats
        self._sets_built_at = time.time()
        return clubs, cats

    # ─── Jaccard / similarity ──────────────────────────────────────────────

    @staticmethod
    def _jaccard(a: set, b: set) -> float:
        u = a | b
        return len(a & b) / len(u) if u else 0.0

    def _sim_pct(self, uid_a, uid_b, clubs, cats, scores) -> int:
        ia = clubs.get(uid_a, set()) | cats.get(uid_a, set())
        ib = clubs.get(uid_b, set()) | cats.get(uid_b, set())
        if ia or ib:
            j = self._jaccard(ia, ib)
            if j > 0:
                return round(j * 100)
            sa, sb = scores.get(uid_a, 0), scores.get(uid_b, 0)
            prox = max(0, 1 - abs(sa - sb) / max(sa, sb, 1))
            return max(5, round(prox * 40))
        sa, sb = scores.get(uid_a, 0), scores.get(uid_b, 0)
        return max(5, round((1 - abs(sa - sb) / max(sa, sb, 1)) * 100))

    def get_similarity_ranked_users(self, user_id: str,
                                    clubs: dict = None,
                                    cats:  dict = None) -> list:
        all_scores = self.get_all_user_scores()
        my_score   = all_scores.get(user_id, 0)
        if clubs is None or cats is None:
            clubs, cats = self._get_sets()

        my_clubs = clubs.get(user_id, set())
        my_cats  = cats.get(user_id, set())

        results = []
        for other_id, other_score in all_scores.items():
            if other_id == user_id:
                continue
            match_pct = self._sim_pct(user_id, other_id, clubs, cats, all_scores)
            max_s     = max(my_score, other_score, 1)
            prox      = round((1 - abs(my_score - other_score) / max_s) * 100)
            results.append({
                "user_id":           other_id,
                "score":             other_score,
                "match_pct":         match_pct,
                "score_proximity":   prox,
                "role":              "mentor" if other_score >= my_score else "mentee",
                "shared_clubs":      sorted(my_clubs & clubs.get(other_id, set())),
                "shared_categories": sorted(my_cats  & cats.get(other_id, set())),
            })

        results.sort(key=lambda x: (x["match_pct"], x["score_proximity"]),
                     reverse=True)
        return results

    # ─── Activity (accepts pre-loaded club sets) ───────────────────────────

    def get_user_activity(self, target_user_id: str,
                          clubs: dict = None) -> dict:
        """
        FIX: accepts pre-loaded `clubs` dict so the caller (get_user_dashboard)
        doesn't trigger another full club_members query per user.
        """
        if clubs is None:
            clubs, _ = self._get_sets()

        post_likes = self._safe(
            "post_reactions", "posts(title, category)",
            {"user_id": target_user_id, "reaction": "like"})

        strava_rows = self._safe(
            "strava_stats",
            "total_distance_km, total_elevation_m, total_moving_time_hrs, score",
            {"user_id": target_user_id})

        github_rows = self._safe(
            "github_stats",
            "username, total_commits, streak_days, score",
            {"user_id": target_user_id})

        movie_reviews = self._safe(
            "movie_reviews", "title, rating, review, created_at",
            {"user_id": target_user_id},
            order_col="created_at", order_desc=True, limit=10)

        game_reviews = self._safe(
            "game_reviews", "title, rating, review, created_at",
            {"user_id": target_user_id},
            order_col="created_at", order_desc=True, limit=10)

        # Posts liked by this user with title + category
        liked_posts = []
        for r in post_likes:
            p = r.get("posts") or {}
            if p.get("title"):
                liked_posts.append({
                    "title":    p["title"],
                    "category": p.get("category", ""),
                })

        return {
            "clubs":         sorted(list(clubs.get(target_user_id, set()))),
            "post_likes":    liked_posts,
            "strava":        strava_rows[0] if strava_rows else None,
            "github":        github_rows[0] if github_rows else None,
            "movie_reviews": movie_reviews,
            "game_reviews":  game_reviews,
            "hgt_score":     self.get_all_user_scores().get(target_user_id, 0),
        }

    # ─── Profiles ──────────────────────────────────────────────────────────

    def _fetch_profiles_map(self, user_ids: list) -> dict:
        if not user_ids:
            return {}
        try:
            rows = (self.supabase.table("profiles")
                    .select("id, username, avatar_url")
                    .in_("id", list(set(user_ids)))
                    .execute().data or [])
            result = {r["id"]: r for r in rows}
            for uid in user_ids:
                result.setdefault(uid, {
                    "id": uid, "username": uid[:8], "avatar_url": None
                })
            return result
        except Exception as e:
            logger.warning(f"Profile batch fetch failed: {e}")
            return {uid: {"id": uid, "username": uid[:8], "avatar_url": None}
                    for uid in user_ids}

    # ─── Dashboard ─────────────────────────────────────────────────────────

    async def get_user_dashboard(self, user_id: str) -> dict:
        """
        FIX: loads club/category sets ONCE at the top, then passes them
        to all downstream calls (similarity ranking + 3× activity fetch).
        Previously each activity fetch triggered 2 full Supabase queries.
        """
        all_scores   = self.get_all_user_scores()
        clubs, cats  = self._get_sets()          # ← one load, reused everywhere

        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        rank = next(
            (i + 1 for i, (uid, _) in enumerate(sorted_users) if uid == user_id),
            len(all_scores),
        )
        total_score = all_scores.get(user_id, 0)
        logger.info(f"Dashboard: {user_id} score={total_score} rank={rank}/{len(all_scores)}")

        similarity_ranked = self.get_similarity_ranked_users(
            user_id, clubs=clubs, cats=cats
        )

        # Fetch profiles for top 10 candidates
        candidate_ids = [r["user_id"] for r in similarity_ranked[:10]]
        profiles_map  = self._fetch_profiles_map(candidate_ids)

        def enrich(records, with_activity=False):
            out = []
            for r in records:
                prof  = profiles_map.get(r["user_id"], {})
                entry = {
                    **r,
                    "username":   prof.get("username",   r["user_id"][:8]),
                    "avatar_url": prof.get("avatar_url"),
                }
                if with_activity:
                    # FIX: pass pre-loaded clubs dict — no extra Supabase query
                    entry["activity"] = self.get_user_activity(
                        r["user_id"], clubs=clubs
                    )
                out.append(entry)
            return out

        top_3 = similarity_ranked[:3]

        return {
            "total_score": total_score,
            "rank":        rank,
            "total_users": len(all_scores),
            "top_similar": enrich(top_3, with_activity=True),
            "mentors":     enrich([r for r in similarity_ranked if r["role"] == "mentor"][:5]),
            "mentees":     enrich([r for r in similarity_ranked if r["role"] == "mentee"][:5]),
        }

    # ─── Leaderboard ───────────────────────────────────────────────────────

    async def get_leaderboard(self, top_k: int = 50,
                              requesting_user_id: str = None) -> list:
        all_scores   = self.get_all_user_scores()
        clubs, cats  = self._get_sets()
        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        if not sorted_users:
            return []

        rank_map = {uid: i + 1 for i, (uid, _) in enumerate(sorted_users)}

        include_ids = set(uid for uid, _ in sorted_users[:top_k])
        if requesting_user_id:
            include_ids.add(requesting_user_id)

        profiles_map = self._fetch_profiles_map(list(include_ids))

        results = []
        for uid in include_ids:
            score   = all_scores.get(uid, 0)
            profile = profiles_map.get(uid, {})
            rank    = rank_map.get(uid, len(sorted_users))

            sim_pct = None
            if requesting_user_id and uid != requesting_user_id:
                sim_pct = self._sim_pct(
                    requesting_user_id, uid, clubs, cats, all_scores
                )

            my_i = clubs.get(uid, set()) | cats.get(uid, set())
            match_count = sum(
                1 for ou, _ in sorted_users
                if ou != uid and self._jaccard(
                    my_i, clubs.get(ou, set()) | cats.get(ou, set())
                ) >= 0.10
            )
            div_mult    = round(1 + min(match_count * 0.05, 0.5), 2)
            final_score = round(score * div_mult, 1)

            results.append({
                "rank":                 rank,
                "user_id":              uid,
                "username":             profile.get("username", uid[:8]),
                "avatar_url":           profile.get("avatar_url"),
                "total_score":          final_score,
                "base_score":           score,
                "match_count":          match_count,
                "similarity_to_me":     sim_pct,
                "diversity_multiplier": div_mult,
                "is_current_user":      uid == requesting_user_id,
            })

        results.sort(key=lambda x: x["rank"])
        return results