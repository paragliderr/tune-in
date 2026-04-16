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
    data:            object     = None   # HeteroData
    id_maps:         dict       = field(default_factory=dict)
    supabase_to_idx: dict       = field(default_factory=dict)
    user_embeddings: np.ndarray = None
    user_scores:     np.ndarray = None
    post_scores:     np.ndarray = None
    built_at:        float      = 0.0

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

    async def get_user_dashboard(self, user_uuid: str, top_k: int = 5) -> dict:
        await self._ensure_fresh_cache()

        idx = self._cache.supabase_to_idx.get(user_uuid)
        if idx is None:
            raise ValueError(f"Supabase UUID '{user_uuid}' not found in Neo4j graph cache.")

        scores     = self._cache.user_scores
        embeddings = self._cache.user_embeddings
        data       = self._cache.data
        cfg        = self._config
        sb         = get_supabase()

        # ── 1. Calculate Current User's Total Blended Score ─────────────────
        hgt_raw = float(scores[idx])
        likes_count = self._count_edges(data, ("user", "LIKES",  "post"), idx, side=0)
        clubs_count = self._count_edges(data, ("user", "JOINED", "club"), idx, side=0)

        base_neo4j_score = (cfg.weight_likes * likes_count * 20) + (cfg.weight_clubs * clubs_count * 15) + (cfg.weight_hgt_signal * max(0, hgt_raw) * 100)
        current_supa_stats = await fetch_dynamic_supabase_stats(user_uuid)
        
        current_total_score = round(max(0.0, base_neo4j_score + current_supa_stats["score"]), 1)

        # ── 2. Cosine-similarity target match & Mentor filtering ───────────
        target_vec = embeddings[idx].reshape(1, -1)
        sim_scores = cosine_similarity(target_vec, embeddings).flatten()
        sim_scores[idx] = -1  # exclude self

        # Look at top 20 closest graph neighbors to find potential mentors
        top_indices = np.argsort(sim_scores)[::-1][:20]
        supa_ids    = data["user"].supabase_ids

        recommendations = []
        for sim_idx in top_indices:
            sim_idx = int(sim_idx)
            sim_val = float(sim_scores[sim_idx])
            
            if sim_val < 0.1:
                continue
                
            rec_supabase_id = supa_ids[sim_idx]
            
            # Calculate Candidate's Total Score
            rec_raw = float(scores[sim_idx])
            rec_likes = self._count_edges(data, ("user", "LIKES", "post"), sim_idx, side=0)
            rec_clubs = self._count_edges(data, ("user", "JOINED", "club"), sim_idx, side=0)
            rec_base = (cfg.weight_likes * rec_likes * 20) + (cfg.weight_clubs * rec_clubs * 15) + (cfg.weight_hgt_signal * max(0, rec_raw) * 100)
            
            rec_supa_stats = await fetch_dynamic_supabase_stats(rec_supabase_id)
            rec_total_score = rec_base + rec_supa_stats["score"]

            # LEADERBOARD LOGIC: Only recommend if they outrank the current user
            if rec_total_score > current_total_score:
                # Fetch profile info for UI
                prof_res = sb.table("profiles").select("username, bio").eq("id", rec_supabase_id).execute()
                prof = prof_res.data[0] if prof_res.data else {}
                
                recommendations.append({
                    "id":           rec_supabase_id,
                    "type":         "user",
                    "title":        prof.get("username") or f"User @{rec_supabase_id[:8]}",
                    "subtitle":     prof.get("bio") or "Similar multi-domain behavior",
                    "impact":       f"Score: {int(rec_total_score)}",
                    "match_score":  int(sim_val * 100),
                    "match_reason": "Top performer in shared interests",
                    "actionPath":   f"/user/{rec_supabase_id}",
                    "sort_score":   rec_total_score
                })

        # Sort successful recommendations by their total score, limit to top_k
        recommendations = sorted(recommendations, key=lambda x: x["sort_score"], reverse=True)[:top_k]
        
        # Clean up sort key before sending to frontend
        for r in recommendations:
            r.pop("sort_score", None)

        # ── 3. Combine Connections List ────────────────────────────────────
        api_connections = [
            {"id": "social", "name": "Clubs Joined", "points": clubs_count * 15, "connected": clubs_count > 0, "icon": "users"},
            {"id": "posts", "name": "Posts Liked", "points": likes_count * 20, "connected": likes_count > 0, "icon": "heart"},
        ]
        api_connections.extend(current_supa_stats["connections"])

        # ── 4. Global rank estimation ──────────────────────────────────────
        all_scores_tensor = torch.tensor(scores)
        base_rank = int((all_scores_tensor > hgt_raw).sum().item()) + 1

        return {
            "user_id":         user_uuid,
            "total_score":     current_total_score,
            "rank":            base_rank,
            "total_users":     len(supa_ids),
            "hgt_raw_signal":  round(hgt_raw, 4),
            "api_connections": api_connections,
            "recommendations": recommendations,
        }

    async def get_leaderboard(self, top_k: int = 20) -> list[dict]:
        await self._ensure_fresh_cache()

        scores   = self._cache.user_scores
        data     = self._cache.data
        cfg      = self._config
        supa_ids = data["user"].supabase_ids

        # Fetch all dynamic stats in bulk if possible, but async loop is okay for now
        results = []
        for idx, raw_score in enumerate(scores):
            user_uuid = supa_ids[idx]
            likes = self._count_edges(data, ("user", "LIKES",  "post"), idx, side=0)
            clubs = self._count_edges(data, ("user", "JOINED", "club"), idx, side=0)
            
            base = (cfg.weight_likes * likes * 20) + (cfg.weight_clubs * clubs * 15) + (cfg.weight_hgt_signal * max(0, float(raw_score)) * 100)
            
            supa_stats = await fetch_dynamic_supabase_stats(user_uuid)
            blended = round(max(0.0, base + supa_stats["score"]), 1)
            
            results.append({
                "rank":        0,             
                "user_id":     user_uuid, 
                "total_score": blended,
                "likes_count": likes,
                "clubs_count": clubs,
                "hgt_signal":  round(float(raw_score), 4),
            })

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