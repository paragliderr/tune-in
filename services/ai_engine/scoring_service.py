"""
TuneIn Scoring Service — Fixed
================================
Key fixes vs previous version:
  1. User discovery no longer depends on profiles table alone —
     falls back to union of all activity tables so a user who
     hasn't filled their profile still gets scored.
  2. Strava zero-value rows no longer silently score 0 — we check
     whether the row EXISTS not just its numeric values, and award
     a flat connection bonus so connected users are rewarded.
  3. Similarity is computed for ALL users against the requesting
     user, sorted by match_pct desc, so the highest-similarity
     user always comes first regardless of score.
  4. get_user_dashboard now returns top_similar: the 3 users most
     similar to the requesting user, plus their activity path.
"""

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional
from functools import partial

from supabase import create_client, Client as SupabaseClient

logger = logging.getLogger(__name__)

# ── Supabase singleton ────────────────────────────────────────────────────────
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
    weight_likes:  float = 0.40
    weight_clubs:  float = 0.35
    weight_hgt:    float = 0.25


class ScoringService:
    def __init__(self, neo4j_uri="", neo4j_user="", neo4j_password="", config=None, cache_ttl=300):
        self._config         = config or HGTConfig()
        self._cache_ttl      = cache_ttl
        self.supabase        = get_supabase()
        self._scores_cache: dict  = {}
        self._scores_built_at: float = 0.0
        self._scores_ttl: int = 120

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 1 — DISCOVER ALL USERS (union across all activity tables)
    # ════════════════════════════════════════════════════════════════════════

    def _discover_all_user_ids(self) -> set:
        """
        FIX: Don't rely only on profiles.id. A user who skipped profile
        setup still exists in auth.users and has activity rows. We union
        all user_id columns from every activity table so nobody gets missed.
        """
        sb = self.supabase
        sources = []

        try:
            r = sb.table("profiles").select("id").execute().data or []
            sources.extend(row["id"] for row in r if row.get("id"))
        except Exception as e:
            logger.warning(f"profiles fetch failed: {e}")

        for table in ["club_members", "post_reactions", "strava_stats",
                       "github_stats", "movie_reviews", "game_reviews"]:
            try:
                r = sb.table(table).select("user_id").execute().data or []
                sources.extend(row["user_id"] for row in r if row.get("user_id"))
            except Exception as e:
                logger.warning(f"{table} user_id fetch failed: {e}")

        return set(sources)

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 2 — BATCH SCORE COMPUTATION
    # ════════════════════════════════════════════════════════════════════════

    def get_all_user_scores(self) -> dict:
        """
        Returns {user_id: score}.

        Score formula:
          likes  × 2     (post engagement)
          clubs  × 15    (community involvement)
          strava_connected × 10   (flat bonus — data may be 0 even if connected)
          strava_km × 0.5         (distance reward on top)
          github_commits × 1
          github_streak  × 5
          movie_reviews  × 3
          game_reviews   × 3
        """
        if self._scores_cache and (time.time() - self._scores_built_at) < self._scores_ttl:
            return self._scores_cache

        sb = self.supabase

        # Fetch all activity data in 6 queries total
        try:
            likes_rows = sb.table("post_reactions").select("user_id").eq("reaction", "like").execute().data or []
        except Exception:
            likes_rows = []

        try:
            clubs_rows = sb.table("club_members").select("user_id").execute().data or []
        except Exception:
            clubs_rows = []

        try:
            # FIX: fetch the row regardless of numeric values — existence = connected bonus
            strava_rows = sb.table("strava_stats").select("user_id, total_distance_km").execute().data or []
        except Exception:
            strava_rows = []

        try:
            github_rows = sb.table("github_stats").select("user_id, total_commits, streak_days").execute().data or []
        except Exception:
            github_rows = []

        try:
            movie_rows = sb.table("movie_reviews").select("user_id").execute().data or []
        except Exception:
            movie_rows = []

        try:
            game_rows = sb.table("game_reviews").select("user_id").execute().data or []
        except Exception:
            game_rows = []

        # Aggregate per-user
        likes_count: dict  = {}
        for r in likes_rows:
            uid = r["user_id"]; likes_count[uid] = likes_count.get(uid, 0) + 1

        clubs_count: dict  = {}
        for r in clubs_rows:
            uid = r["user_id"]; clubs_count[uid] = clubs_count.get(uid, 0) + 1

        strava_map: dict   = {}
        for r in strava_rows:
            uid = r["user_id"]
            strava_map[uid] = {
                "connected": True,
                "km": float(r.get("total_distance_km") or 0),
            }

        github_map: dict   = {}
        for r in github_rows:
            uid = r["user_id"]
            github_map[uid] = {
                "commits": int(r.get("total_commits") or 0),
                "streak":  int(r.get("streak_days")   or 0),
            }

        movie_count: dict  = {}
        for r in movie_rows:
            uid = r["user_id"]; movie_count[uid] = movie_count.get(uid, 0) + 1

        game_count: dict   = {}
        for r in game_rows:
            uid = r["user_id"]; game_count[uid] = game_count.get(uid, 0) + 1

        # FIX: discover users from all tables, not just profiles
        all_uids = self._discover_all_user_ids()
        # Also make sure anyone in any activity map is included
        all_uids |= set(likes_count) | set(clubs_count) | set(strava_map) \
                  | set(github_map) | set(movie_count) | set(game_count)

        scores = {}
        for uid in all_uids:
            score = 0.0
            score += likes_count.get(uid, 0)  * 2.0
            score += clubs_count.get(uid, 0)  * 15.0
            st = strava_map.get(uid)
            if st:
                score += 10.0          # flat connection bonus
                score += st["km"] * 0.5
            gh = github_map.get(uid, {})
            score += gh.get("commits", 0) * 1.0
            score += gh.get("streak",  0) * 5.0
            score += movie_count.get(uid, 0) * 3.0
            score += game_count.get(uid, 0)  * 3.0
            scores[uid] = round(score, 1)

        self._scores_cache    = scores
        self._scores_built_at = time.time()

        logger.info(f"Scores computed for {len(scores)} users: {scores}")
        return scores

    def invalidate_scores_cache(self):
        self._scores_cache    = {}
        self._scores_built_at = 0.0

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 3 — SIMILARITY (Jaccard on clubs + categories)
    # ════════════════════════════════════════════════════════════════════════

    def _get_all_club_sets(self) -> dict:
        try:
            rows = self.supabase.table("club_members")\
                .select("user_id, clubs(name)").execute().data or []
        except Exception:
            rows = []
        result: dict = {}
        for r in rows:
            uid  = r["user_id"]
            name = (r.get("clubs") or {}).get("name", "")
            if name:
                result.setdefault(uid, set()).add(name.lower())
        return result

    def _get_all_category_sets(self) -> dict:
        try:
            rows = self.supabase.table("post_reactions")\
                .select("user_id, posts(category)")\
                .eq("reaction", "like").execute().data or []
        except Exception:
            rows = []
        result: dict = {}
        for r in rows:
            uid      = r["user_id"]
            category = (r.get("posts") or {}).get("category", "")
            if category:
                result.setdefault(uid, set()).add(category.lower())
        return result

    @staticmethod
    def _jaccard(a: set, b: set) -> float:
        if not a and not b:
            return 0.0
        union = a | b
        if not union:
            return 0.0
        return len(a & b) / len(union)

    def get_similarity_ranked_users(self, user_id: str) -> list:
        """
        Returns ALL other users ranked by similarity to user_id, descending.
        Each entry: {user_id, score, match_pct, role, shared_clubs, shared_categories}

        FIX: sorted by match_pct first, not by score. The highest-similarity
        user always appears first regardless of their absolute score.
        """
        all_scores = self.get_all_user_scores()
        my_score   = all_scores.get(user_id, 0)

        all_clubs = self._get_all_club_sets()
        all_cats  = self._get_all_category_sets()

        my_clubs = all_clubs.get(user_id, set())
        my_cats  = all_cats.get(user_id, set())
        my_interests = my_clubs | my_cats

        results = []
        for other_id, other_score in all_scores.items():
            if other_id == user_id:
                continue

            other_clubs = all_clubs.get(other_id, set())
            other_cats  = all_cats.get(other_id, set())
            other_interests = other_clubs | other_cats

            sim = self._jaccard(my_interests, other_interests)
            match_pct = round(sim * 100)

            # If neither user has interest data, fall back to score-proximity
            if not my_interests and not other_interests:
                score_diff = abs(my_score - other_score)
                max_score  = max(my_score, other_score, 1)
                match_pct  = max(10, round((1 - score_diff / max_score) * 100))

            # Always include everyone (threshold = 0) so we always get results
            results.append({
                "user_id":             other_id,
                "score":               other_score,
                "match_pct":           match_pct,
                "role":                "mentor" if other_score > my_score else "mentee",
                "shared_clubs":        list(my_clubs & other_clubs),
                "shared_categories":   list(my_cats  & other_cats),
            })

        # Sort by similarity desc, then score desc as tiebreaker
        results.sort(key=lambda x: (x["match_pct"], x["score"]), reverse=True)
        return results

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 4 — ACTIVITY PROFILE
    # ════════════════════════════════════════════════════════════════════════

    def get_user_activity(self, target_user_id: str) -> dict:
        sb = self.supabase
        all_clubs = self._get_all_club_sets()

        try:
            post_likes = sb.table("post_reactions")\
                .select("posts(title, category)")\
                .eq("user_id", target_user_id)\
                .eq("reaction", "like").execute().data or []
        except Exception:
            post_likes = []

        try:
            strava = sb.table("strava_stats")\
                .select("total_distance_km, total_elevation_m, total_moving_time_hrs, score")\
                .eq("user_id", target_user_id).execute().data or []
        except Exception:
            strava = []

        try:
            github = sb.table("github_stats")\
                .select("username, total_commits, streak_days, score")\
                .eq("user_id", target_user_id).execute().data or []
        except Exception:
            github = []

        try:
            movie_reviews = sb.table("movie_reviews")\
                .select("*").eq("user_id", target_user_id).execute().data or []
        except Exception:
            movie_reviews = []

        try:
            game_reviews = sb.table("game_reviews")\
                .select("*").eq("user_id", target_user_id).execute().data or []
        except Exception:
            game_reviews = []

        return {
            "clubs":         sorted(list(all_clubs.get(target_user_id, set()))),
            "post_likes":    post_likes,
            "strava":        strava[0] if strava else None,
            "github":        github[0] if github else None,
            "movie_reviews": movie_reviews,
            "game_reviews":  game_reviews,
            "hgt_score":     self.get_all_user_scores().get(target_user_id, 0),
        }

    def _fetch_profiles_map(self, user_ids: list) -> dict:
        if not user_ids:
            return {}
        try:
            rows = self.supabase.table("profiles")\
                .select("id, username, avatar_url")\
                .in_("id", user_ids).execute().data or []
            result = {r["id"]: r for r in rows}
            # For any user_id not in profiles, generate a fallback username
            for uid in user_ids:
                if uid not in result:
                    result[uid] = {
                        "id":         uid,
                        "username":   uid[:8],   # first 8 chars of UUID
                        "avatar_url": None,
                    }
            return result
        except Exception as e:
            logger.warning(f"Profile batch fetch failed: {e}")
            return {uid: {"id": uid, "username": uid[:8], "avatar_url": None} for uid in user_ids}

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 5 — DASHBOARD  (new shape)
    # ════════════════════════════════════════════════════════════════════════

    async def get_user_dashboard(self, user_id: str) -> dict:
        """
        Returns:
          total_score    — this user's HGT score
          rank           — their rank among all users
          total_users    — how many users exist
          top_similar    — top 3 users most similar to this user (by match_pct),
                           each enriched with username + avatar + full activity
          mentors        — users with higher score than this user (similarity sorted)
          mentees        — users with lower score (similarity sorted)
        """
        all_scores   = self.get_all_user_scores()
        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        rank         = next((i + 1 for i, (uid, _) in enumerate(sorted_users) if uid == user_id), None)
        total_score  = all_scores.get(user_id, 0)

        logger.info(f"Dashboard for {user_id}: score={total_score}, rank={rank}, total={len(all_scores)}")

        similarity_ranked = self.get_similarity_ranked_users(user_id)

        # Top 3 most similar users (regardless of mentor/mentee role)
        top_3_ids = [r["user_id"] for r in similarity_ranked[:3]]

        # Batch fetch profiles + activity for top 3
        all_ids      = list({r["user_id"] for r in similarity_ranked[:10]})
        profiles_map = self._fetch_profiles_map(all_ids)

        def enrich(records: list, include_activity=False) -> list:
            enriched = []
            for r in records:
                profile  = profiles_map.get(r["user_id"], {})
                entry = {
                    **r,
                    "username":   profile.get("username", r["user_id"][:8]),
                    "avatar_url": profile.get("avatar_url"),
                }
                if include_activity:
                    entry["activity"] = self.get_user_activity(r["user_id"])
                enriched.append(entry)
            return enriched

        # top_similar: top 3 by match_pct, with full activity for the path view
        top_similar = enrich(similarity_ranked[:3], include_activity=True)

        mentors = enrich([r for r in similarity_ranked if r["role"] == "mentor"][:5])
        mentees = enrich([r for r in similarity_ranked if r["role"] == "mentee"][:5])

        return {
            "total_score": total_score,
            "rank":        rank,
            "total_users": len(all_scores),
            "top_similar": top_similar,   # NEW — used for the default panel
            "mentors":     mentors,
            "mentees":     mentees,
        }

    # ════════════════════════════════════════════════════════════════════════
    # SECTION 6 — LEADERBOARD
    # ════════════════════════════════════════════════════════════════════════

    async def get_leaderboard(self, top_k: int = 50, requesting_user_id: str = None) -> list:
        """
        Returns top_k users by score.
        If requesting_user_id is provided, each entry also includes:
          similarity_to_me — Jaccard match% vs the requesting user
        """
        all_scores   = self.get_all_user_scores()
        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)

        if not sorted_users:
            return []

        top_ids      = [uid for uid, _ in sorted_users[:top_k]]
        profiles_map = self._fetch_profiles_map(top_ids)

        all_clubs = self._get_all_club_sets()
        all_cats  = self._get_all_category_sets()

        my_interests = set()
        if requesting_user_id:
            my_interests = (all_clubs.get(requesting_user_id, set()) |
                            all_cats.get(requesting_user_id, set()))

        results = []
        for rank_idx, (uid, score) in enumerate(sorted_users[:top_k]):
            profile = profiles_map.get(uid, {})

            match_pct = None
            if requesting_user_id and uid != requesting_user_id:
                other_interests = all_clubs.get(uid, set()) | all_cats.get(uid, set())
                sim = self._jaccard(my_interests, other_interests)
                match_pct = round(sim * 100)
                # fallback when no interests at all
                if not my_interests and not other_interests:
                    score_diff = abs(all_scores.get(requesting_user_id, 0) - score)
                    max_score  = max(all_scores.get(requesting_user_id, 0), score, 1)
                    match_pct  = max(10, round((1 - score_diff / max_score) * 100))

            # Diversity multiplier
            match_count = sum(
                1 for other_uid, _ in sorted_users
                if other_uid != uid and
                self._jaccard(
                    all_clubs.get(uid, set()) | all_cats.get(uid, set()),
                    all_clubs.get(other_uid, set()) | all_cats.get(other_uid, set())
                ) >= 0.10
            )
            diversity_multiplier = 1 + min(match_count * 0.05, 0.5)
            final_score          = round(score * diversity_multiplier, 1)

            results.append({
                "rank":                 rank_idx + 1,
                "user_id":              uid,
                "username":             profile.get("username", uid[:8]),
                "avatar_url":           profile.get("avatar_url"),
                "total_score":          final_score,
                "base_score":           score,
                "match_count":          match_count,
                "similarity_to_me":     match_pct,   # NEW
                "diversity_multiplier": round(diversity_multiplier, 2),
            })

        return results