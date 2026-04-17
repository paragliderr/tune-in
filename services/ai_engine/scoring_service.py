"""
TuneIn Scoring Service — v3
============================
Key fixes:
  1. Removed stray `333` line (SyntaxError).
  2. get_leaderboard ALWAYS includes the requesting user so the
     frontend can find myLeaderboardRank (was returning Infinity).
  3. similarity_to_me is NEVER null — score-proximity fallback when
     interest data is sparse.
  4. top_similar includes full activity payload for path view.
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
        self._config              = config or HGTConfig()
        self.supabase             = get_supabase()
        self._scores_cache: dict  = {}
        self._scores_built_at: float = 0.0
        self._scores_ttl: int     = 120

    # ── User discovery ────────────────────────────────────────────────────

    def _discover_all_user_ids(self) -> set:
        sb = self.supabase
        ids = set()
        for table, col in [
            ("profiles",      "id"),
            ("club_members",  "user_id"),
            ("post_reactions","user_id"),
            ("strava_stats",  "user_id"),
            ("github_stats",  "user_id"),
            ("movie_reviews", "user_id"),
            ("game_reviews",  "user_id"),
        ]:
            try:
                rows = sb.table(table).select(col).execute().data or []
                ids.update(r[col] for r in rows if r.get(col))
            except Exception as e:
                logger.warning(f"{table}.{col} fetch failed: {e}")
        return ids

    # ── Scores (single source of truth) ───────────────────────────────────

    def get_all_user_scores(self) -> dict:
        if self._scores_cache and \
                (time.time() - self._scores_built_at) < self._scores_ttl:
            return self._scores_cache

        sb = self.supabase

        def safe(table, cols, filters=None):
            try:
                q = sb.table(table).select(cols)
                for k, v in (filters or {}).items():
                    q = q.eq(k, v)
                return q.execute().data or []
            except Exception as e:
                logger.warning(f"{table} fetch failed: {e}")
                return []

        likes_rows  = safe("post_reactions", "user_id", {"reaction": "like"})
        clubs_rows  = safe("club_members",   "user_id")
        strava_rows = safe("strava_stats",   "user_id, total_distance_km")
        github_rows = safe("github_stats",   "user_id, total_commits, streak_days")
        movie_rows  = safe("movie_reviews",  "user_id")
        game_rows   = safe("game_reviews",   "user_id")

        def cmap(rows, key="user_id"):
            m: dict = {}
            for r in rows:
                uid = r[key]; m[uid] = m.get(uid, 0) + 1
            return m

        likes_c = cmap(likes_rows)
        clubs_c = cmap(clubs_rows)
        movie_c = cmap(movie_rows)
        game_c  = cmap(game_rows)

        strava_m: dict = {r["user_id"]: float(r.get("total_distance_km") or 0) for r in strava_rows}
        github_m: dict = {
            r["user_id"]: {"commits": int(r.get("total_commits") or 0),
                           "streak":  int(r.get("streak_days")   or 0)}
            for r in github_rows
        }

        all_uids = self._discover_all_user_ids()
        all_uids |= set(likes_c)|set(clubs_c)|set(strava_m)|set(github_m)|set(movie_c)|set(game_c)

        scores = {}
        for uid in all_uids:
            s  = 0.0
            s += likes_c.get(uid, 0) * 2.0
            s += clubs_c.get(uid, 0) * 15.0
            if uid in strava_m:
                s += 10.0 + strava_m[uid] * 0.5
            gh = github_m.get(uid, {})
            s += gh.get("commits", 0) * 1.0
            s += gh.get("streak",  0) * 5.0
            s += movie_c.get(uid, 0) * 3.0
            s += game_c.get(uid,  0) * 3.0
            scores[uid] = round(s, 1)

        self._scores_cache    = scores
        self._scores_built_at = time.time()
        logger.info(f"Scores computed for {len(scores)} users: {scores}")
        return scores

    def invalidate_scores_cache(self):
        self._scores_cache    = {}
        self._scores_built_at = 0.0

    # ── Similarity ────────────────────────────────────────────────────────

    def _get_all_club_sets(self) -> dict:
        try:
            rows = self.supabase.table("club_members") \
                .select("user_id, clubs(name)").execute().data or []
        except Exception:
            return {}
        result: dict = {}
        for r in rows:
            name = (r.get("clubs") or {}).get("name", "")
            if name:
                result.setdefault(r["user_id"], set()).add(name.lower())
        return result

    def _get_all_category_sets(self) -> dict:
        try:
            rows = self.supabase.table("post_reactions") \
                .select("user_id, posts(category)") \
                .eq("reaction", "like").execute().data or []
        except Exception:
            return {}
        result: dict = {}
        for r in rows:
            cat = (r.get("posts") or {}).get("category", "")
            if cat:
                result.setdefault(r["user_id"], set()).add(cat.lower())
        return result

    @staticmethod
    def _jaccard(a: set, b: set) -> float:
        u = a | b
        return len(a & b) / len(u) if u else 0.0

    def _sim_pct(self, uid_a, uid_b, all_clubs, all_cats, all_scores) -> int:
        ia = all_clubs.get(uid_a, set()) | all_cats.get(uid_a, set())
        ib = all_clubs.get(uid_b, set()) | all_cats.get(uid_b, set())
        if ia or ib:
            return round(self._jaccard(ia, ib) * 100)
        # score-proximity fallback — never returns null
        sa, sb_ = all_scores.get(uid_a, 0), all_scores.get(uid_b, 0)
        return max(5, round((1 - abs(sa - sb_) / max(sa, sb_, 1)) * 100))

    def get_similarity_ranked_users(self, user_id: str) -> list:
        all_scores = self.get_all_user_scores()
        my_score   = all_scores.get(user_id, 0)
        all_clubs  = self._get_all_club_sets()
        all_cats   = self._get_all_category_sets()
        my_clubs   = all_clubs.get(user_id, set())
        my_cats    = all_cats.get(user_id, set())

        results = []
        for other_id, other_score in all_scores.items():
            if other_id == user_id:
                continue
            results.append({
                "user_id":           other_id,
                "score":             other_score,
                "match_pct":         self._sim_pct(user_id, other_id, all_clubs, all_cats, all_scores),
                "role":              "mentor" if other_score > my_score else "mentee",
                "shared_clubs":      sorted(my_clubs & all_clubs.get(other_id, set())),
                "shared_categories": sorted(my_cats  & all_cats.get(other_id, set())),
            })

        results.sort(key=lambda x: (x["match_pct"], x["score"]), reverse=True)
        return results

    # ── Activity ──────────────────────────────────────────────────────────

    def get_user_activity(self, target_user_id: str) -> dict:
        sb = self.supabase

        def safe(fn):
            try:    return fn() or []
            except: return []

        all_clubs     = self._get_all_club_sets()
        post_likes    = safe(lambda: sb.table("post_reactions")
            .select("posts(title, category)").eq("user_id", target_user_id)
            .eq("reaction", "like").execute().data)
        strava_rows   = safe(lambda: sb.table("strava_stats")
            .select("total_distance_km, total_elevation_m, total_moving_time_hrs, score")
            .eq("user_id", target_user_id).execute().data)
        github_rows   = safe(lambda: sb.table("github_stats")
            .select("username, total_commits, streak_days, score")
            .eq("user_id", target_user_id).execute().data)
        movie_reviews = safe(lambda: sb.table("movie_reviews")
            .select("title, rating, review, created_at")
            .eq("user_id", target_user_id)
            .order("created_at", desc=True).limit(10).execute().data)
        game_reviews  = safe(lambda: sb.table("game_reviews")
            .select("title, rating, review, created_at")
            .eq("user_id", target_user_id)
            .order("created_at", desc=True).limit(10).execute().data)

        return {
            "clubs":         sorted(list(all_clubs.get(target_user_id, set()))),
            "post_likes":    post_likes,
            "strava":        strava_rows[0] if strava_rows else None,
            "github":        github_rows[0] if github_rows else None,
            "movie_reviews": movie_reviews,
            "game_reviews":  game_reviews,
            "hgt_score":     self.get_all_user_scores().get(target_user_id, 0),
        }

    # ── Profiles ──────────────────────────────────────────────────────────

    def _fetch_profiles_map(self, user_ids: list) -> dict:
        if not user_ids:
            return {}
        try:
            rows = self.supabase.table("profiles") \
                .select("id, username, avatar_url") \
                .in_("id", list(set(user_ids))).execute().data or []
            result = {r["id"]: r for r in rows}
            for uid in user_ids:
                result.setdefault(uid, {"id": uid, "username": uid[:8], "avatar_url": None})
            return result
        except Exception as e:
            logger.warning(f"Profile batch fetch failed: {e}")
            return {uid: {"id": uid, "username": uid[:8], "avatar_url": None} for uid in user_ids}

    # ── Dashboard ─────────────────────────────────────────────────────────

    async def get_user_dashboard(self, user_id: str) -> dict:
        all_scores   = self.get_all_user_scores()
        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        rank         = next(
            (i + 1 for i, (uid, _) in enumerate(sorted_users) if uid == user_id),
            len(all_scores)
        )
        total_score = all_scores.get(user_id, 0)
        logger.info(f"Dashboard: user={user_id} score={total_score} rank={rank}/{len(all_scores)}")

        similarity_ranked = self.get_similarity_ranked_users(user_id)
        candidate_ids     = [r["user_id"] for r in similarity_ranked[:10]]
        profiles_map      = self._fetch_profiles_map(candidate_ids)

        def enrich(records, with_activity=False):
            out = []
            for r in records:
                prof  = profiles_map.get(r["user_id"], {})
                entry = {**r,
                         "username":   prof.get("username", r["user_id"][:8]),
                         "avatar_url": prof.get("avatar_url")}
                if with_activity:
                    entry["activity"] = self.get_user_activity(r["user_id"])
                out.append(entry)
            return out

        return {
            "total_score": total_score,
            "rank":        rank,
            "total_users": len(all_scores),
            "top_similar": enrich(similarity_ranked[:3], with_activity=True),
            "mentors":     enrich([r for r in similarity_ranked if r["role"] == "mentor"][:5]),
            "mentees":     enrich([r for r in similarity_ranked if r["role"] == "mentee"][:5]),
        }

    # ── Leaderboard ───────────────────────────────────────────────────────

    async def get_leaderboard(self, top_k: int = 50,
                              requesting_user_id: str = None) -> list:
        """
        FIX: requesting user is ALWAYS in the response (even outside top_k)
        so frontend finds their rank via leaderboard.find(e => e.is_current_user).
        """
        all_scores   = self.get_all_user_scores()
        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        if not sorted_users:
            return []

        all_clubs = self._get_all_club_sets()
        all_cats  = self._get_all_category_sets()
        rank_map  = {uid: i + 1 for i, (uid, _) in enumerate(sorted_users)}

        # Always include requesting user
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
                sim_pct = self._sim_pct(requesting_user_id, uid,
                                        all_clubs, all_cats, all_scores)

            my_i = all_clubs.get(uid, set()) | all_cats.get(uid, set())
            match_count = sum(
                1 for ou, _ in sorted_users if ou != uid and
                self._jaccard(my_i, all_clubs.get(ou, set()) | all_cats.get(ou, set())) >= 0.10
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