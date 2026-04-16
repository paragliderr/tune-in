"""
TuneIn Scoring Service
======================
Orchestrates:
  1. Build graph from Neo4j
  2. Run HGT forward pass
  3. Compute cosine-similarity recommendations
  4. Rank users by influence score
  5. Return structured payload for FastAPI → React

Math explained inline at each step.
"""
# ── Standard libs ─────────────────────────────────────────────
import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

# ── ML / Math ────────────────────────────────────────────────
import torch
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# ── Supabase ─────────────────────────────────────────────────
from supabase import create_client, Client as SupabaseClient

# ── Internal (AI Engine) ─────────────────────────────────────
from ai_engine.graph_builder import Neo4jGraphBuilder
from ai_engine.hgt_model import TuneInHGT

logger = logging.getLogger(__name__)

# ── Supabase Singleton ───────────────────────────────────────
_supabase_client: SupabaseClient = None

def get_supabase() -> SupabaseClient:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _supabase_client

async def fetch_dynamic_supabase_stats(user_uuid: str) -> dict:
    """Fetches real-time integration stats directly from Supabase."""
    sb = get_supabase()
    total_supa_score = 0
    connections = []

    try:
        # 1. GitHub Stats
        gh_res = sb.table("github_stats").select("*").eq("user_id", user_uuid).execute()
        if gh_res.data:
            stats = gh_res.data[0]
            total_supa_score += (stats.get("total_commits", 0) * 2) + (stats.get("pull_requests", 0) * 5)
            connections.append({"id": "github", "name": "GitHub", "connected": True, "icon": "github"})

        # 2. Strava Stats
        st_res = sb.table("strava_stats").select("*").eq("user_id", user_uuid).execute()
        if st_res.data:
            stats = st_res.data[0]
            total_supa_score += (stats.get("total_activities", 0) * 5)
            connections.append({"id": "strava", "name": "Strava", "connected": True, "icon": "activity"})
            
    except Exception as e:
        logger.error(f"Error fetching Supabase stats for {user_uuid}: {e}")

    return {
        "score": total_supa_score,
        "connections": connections
    }


# ── Config ───────────────────────────────────────────────────────────────────
@dataclass
class HGTConfig:
    hidden_channels: int = 128
    out_channels: int    = 64
    num_heads: int       = 4
    num_layers: int      = 2

    # Score blending weights (tune these based on your product priorities)
    weight_likes:      float = 0.40   # 40% = posts liked
    weight_clubs:      float = 0.35   # 35% = clubs joined
    weight_hgt_signal: float = 0.25   # 25% = pure graph-learned signal


# ── Cached graph state (rebuilt on demand) ───────────────────────────────────
@dataclass
class GraphCache:
    data:            object     = None
    id_maps:         dict       = field(default_factory=dict)
    supabase_to_idx: dict       = field(default_factory=dict)
    user_embeddings: np.ndarray = None
    user_scores:     np.ndarray = None
    post_scores:     np.ndarray = None
    built_at:        float      = 0.0
    all_blended_scores: list    = field(default_factory=list)

    def is_stale(self, ttl_seconds: int = 300) -> bool:
        return (time.time() - self.built_at) > ttl_seconds


# ── Top-level fallback ────────────────────────────────────────────────────────
async def compute_user_score(user_id: str) -> float:
    # Retained as-is for lightweight health checks
    try:
        builder = Neo4jGraphBuilder(
            uri=os.getenv("NEO4J_URI", "neo4j://localhost:7687"),
            user=os.getenv("NEO4J_USER", "neo4j"),
            password=os.getenv("NEO4J_PASSWORD", "password"),
        )
        await builder.connect()
        try:
            graph, _ = await builder.build()
        finally:
            await builder.close()

        if not graph or len(graph.node_types) == 0:
            return 0

        user_idx = builder.supabase_to_idx.get(user_id)
        if user_idx is None:
            return 0

        model = TuneInHGT(
            hidden_channels=128, out_channels=64, num_heads=4, num_layers=2, metadata=graph.metadata()
        )
        model.eval()
        with torch.no_grad():
            outputs = model(graph.x_dict, graph.edge_index_dict)

        hgt_raw = float(outputs["user_scores"].cpu().numpy()[user_idx])
        likes = int((graph["user", "LIKES",  "post"].edge_index[0] == user_idx).sum())
        clubs = int((graph["user", "JOINED", "club"].edge_index[0] == user_idx).sum())

        supa_stats = await fetch_dynamic_supabase_stats(user_id)
        
        total_score = (
            likes * 20 * 0.40 +
            clubs * 15 * 0.35 +
            max(0, hgt_raw) * 100 * 0.25 +
            supa_stats["score"]
        )
        return round(max(0.0, total_score), 2)

    except Exception as e:
        logger.error(f"compute_user_score failed: {e}", exc_info=True)
        return 0


# ── Singleton service ─────────────────────────────────────────────────────────
class ScoringService:
    def __init__(
        self, neo4j_uri: str, neo4j_user: str, neo4j_password: str, config: HGTConfig = None, cache_ttl: int = 300
    ):
        self._neo4j_uri      = neo4j_uri
        self._neo4j_user     = neo4j_user
        self._neo4j_password = neo4j_password
        self._config         = config or HGTConfig()
        self._cache_ttl      = cache_ttl
        self._cache          = GraphCache()
        self._model: Optional[TuneInHGT] = None
        self._lock           = asyncio.Lock()
        self.supabase        = get_supabase()

    def get_all_user_scores(self) -> dict:
        """Single source of truth. Called by everyone."""
        profiles = self.supabase.table("profiles").select("id").execute().data
        return {p["id"]: self._compute_score(p["id"]) for p in profiles}

    def _compute_score(self, user_id: str) -> float:
        score = 0.0
        # Post likes
        likes = self.supabase.table("post_reactions")\
            .select("id").eq("user_id", user_id).eq("reaction", "like").execute().data
        score += len(likes) * 2.0
        # Club memberships  
        clubs = self.supabase.table("club_members")\
            .select("id").eq("user_id", user_id).execute().data
        score += len(clubs) * 15.0
        # Strava
        strava = self.supabase.table("strava_stats")\
            .select("total_distance_km").eq("user_id", user_id).execute().data
        if strava:
            score += (strava[0].get("total_distance_km") or 0) * 0.5
        # GitHub
        github = self.supabase.table("github_stats")\
            .select("total_commits, streak_days").eq("user_id", user_id).execute().data
        if github:
            score += (github[0].get("total_commits") or 0) * 1.0
            score += (github[0].get("streak_days") or 0) * 5.0
        return round(score, 1)

    def get_hgt_matches(self, user_id: str) -> dict:
        my_clubs = self._get_club_set(user_id)
        my_cats = self._get_liked_categories(user_id)
        all_scores = self.get_all_user_scores()
        my_score = all_scores.get(user_id, 0)
        
        results = []
        for other_id, other_score in all_scores.items():
            if other_id == user_id: continue
            other_clubs = self._get_club_set(other_id)
            other_cats = self._get_liked_categories(other_id)
            sim = self._jaccard(my_clubs | my_cats, other_clubs | other_cats)
            match_pct = round(sim * 100)
            if match_pct < 30: continue
            results.append({
                "user_id": other_id,
                "score": other_score,
                "match_pct": match_pct,
                "role": "mentor" if other_score > my_score else "mentee",
                "shared_clubs": list(my_clubs & other_clubs),
            })
        results.sort(key=lambda x: x["match_pct"], reverse=True)
        return {
            "mentors": [r for r in results if r["role"] == "mentor"][:5],
            "mentees": [r for r in results if r["role"] == "mentee"][:5],
        }

    def _get_club_set(self, user_id: str) -> set:
        rows = self.supabase.table("club_members")\
            .select("clubs(name)").eq("user_id", user_id).execute().data
        return {r["clubs"]["name"].lower() for r in rows if r.get("clubs")}

    def _get_liked_categories(self, user_id: str) -> set:
        rows = self.supabase.table("post_reactions")\
            .select("posts(category)").eq("user_id", user_id)\
            .eq("reaction", "like").execute().data
        return {r["posts"]["category"].lower() for r in rows 
                if r.get("posts") and r["posts"].get("category")}

    def _jaccard(self, a: set, b: set) -> float:
        if not a and not b: return 0.0
        return len(a & b) / len(a | b)

    def get_user_activity(self, target_user_id: str) -> dict:
        """Full profile for mentor/mentee click-through."""
        return {
            "clubs": self._get_club_set(target_user_id),
            "post_likes": self.supabase.table("post_reactions")
                .select("posts(title, category)").eq("user_id", target_user_id)
                .eq("reaction","like").execute().data,
            "strava": self.supabase.table("strava_stats")
                .select("total_distance_km,total_elevation_m,total_moving_time_hrs,score")
                .eq("user_id", target_user_id).execute().data,
            "github": self.supabase.table("github_stats")
                .select("username,total_commits,streak_days,score")
                .eq("user_id", target_user_id).execute().data,
            "movie_reviews": self.supabase.table("movie_reviews")
                .select("*").eq("user_id", target_user_id).execute().data,
            "game_reviews": self.supabase.table("game_reviews")
                .select("*").eq("user_id", target_user_id).execute().data,
        }

    async def get_user_dashboard(self, user_id: str) -> dict:
        """Fixed: rank and score both come from get_all_user_scores."""
        all_scores = self.get_all_user_scores()
        sorted_users = sorted(all_scores.items(), key=lambda x: x[1], reverse=True)
        rank = next((i+1 for i, (uid, _) in enumerate(sorted_users) if uid == user_id), None)
        total_score = all_scores.get(user_id, 0)
        hgt = self.get_hgt_matches(user_id)
        return {
            "total_score": total_score,
            "rank": rank,
            "total_users": len(all_scores),
            "mentors": hgt["mentors"],
            "mentees": hgt["mentees"],
        }

    async def get_leaderboard(self, top_k: int = 20) -> list[dict]:
        await self._ensure_fresh_cache()

        scores   = self._cache.user_scores
        data     = self._cache.data
        cfg      = self._config
        supa_ids = data["user"].supabase_ids

        results = []
        all_blended = []

        for idx, raw_score in enumerate(scores):
            user_uuid = supa_ids[idx]
            likes = self._count_edges(data, ("user", "LIKES",  "post"), idx, side=0)
            clubs = self._count_edges(data, ("user", "JOINED", "club"), idx, side=0)

            base = (cfg.weight_likes * likes * 20 +
                    cfg.weight_clubs * clubs * 15 +
                    cfg.weight_hgt_signal * max(0, float(raw_score)) * 100)

            supa = await fetch_dynamic_supabase_stats(user_uuid)
            blended = round(max(0.0, base + supa["score"]), 1)
            all_blended.append(blended)

            results.append({
                "rank":        0,
                "user_id":     user_uuid,
                "total_score": blended,
                "likes_count": likes,
                "clubs_count": clubs,
                "hgt_signal":  round(float(raw_score), 4),
            })

        # Store blended scores in cache so dashboard rank is consistent
        self._cache.all_blended_scores = all_blended

        results.sort(key=lambda x: x["total_score"], reverse=True)
        for i, r in enumerate(results[:top_k]):
            r["rank"] = i + 1

        return results[:top_k]

    async def get_post_feed(self, top_k: int = 30) -> list[dict]:
        await self._ensure_fresh_cache()
        post_scores = self._cache.post_scores
        post_ids    = self._cache.data["post"].node_ids
        ranked = sorted(
            [(post_ids[i], float(s)) for i, s in enumerate(post_scores)],
            key=lambda x: x[1], reverse=True,
        )
        return [
            {"post_id": pid, "hgt_score": round(score, 4), "rank": i + 1}
            for i, (pid, score) in enumerate(ranked[:top_k])
        ]

    async def invalidate_cache(self):
        async with self._lock:
            self._cache = GraphCache()
        logger.info("Graph cache invalidated.")

    async def _ensure_fresh_cache(self):
        if not self._cache.is_stale(self._cache_ttl):
            return
        async with self._lock:
            if not self._cache.is_stale(self._cache_ttl):
                return
            await self._rebuild_cache()

    async def _rebuild_cache(self):
        logger.info("Rebuilding HGT graph cache from Neo4j …")
        t0 = time.time()

        builder = Neo4jGraphBuilder(self._neo4j_uri, self._neo4j_user, self._neo4j_password)
        await builder.connect()
        try:
            data, id_maps = await builder.build()
        finally:
            await builder.close()

        if self._model is None:
            self._model = TuneInHGT(
                hidden_channels=self._config.hidden_channels,
                out_channels=self._config.out_channels,
                num_heads=self._config.num_heads,
                num_layers=self._config.num_layers,
                metadata=data.metadata(),
            )
            logger.info("HGT model initialised.")

        self._model.eval()
        with torch.no_grad():
            outputs = self._model(data.x_dict, data.edge_index_dict)

        self._cache = GraphCache(
            data            = data,
            id_maps         = id_maps,
            supabase_to_idx = dict(builder.supabase_to_idx),
            user_embeddings = outputs["user_embeddings"].cpu().numpy(),
            user_scores     = outputs["user_scores"].cpu().numpy(),
            post_scores     = outputs["post_scores"].cpu().numpy(),
            built_at        = time.time(),
        )

        logger.info(f"Cache rebuilt in {time.time() - t0:.2f}s")

    @staticmethod
    def _count_edges(data, edge_type: tuple, node_idx: int, side: int) -> int:
        try:
            edge_index = data[edge_type].edge_index
            return int((edge_index[side] == node_idx).sum().item())
        except (KeyError, AttributeError):
            return 0