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

# ── Internal (AI Engine) ─────────────────────────────────────
from ai_engine.graph_builder import Neo4jGraphBuilder
from ai_engine.hgt_model import TuneInHGT

logger = logging.getLogger(__name__)


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
    # supabase_id → int index — populated from builder.supabase_to_idx
    supabase_to_idx: dict       = field(default_factory=dict)
    user_embeddings: np.ndarray = None
    user_scores:     np.ndarray = None
    post_scores:     np.ndarray = None
    built_at:        float      = 0.0

    def is_stale(self, ttl_seconds: int = 300) -> bool:
        return (time.time() - self.built_at) > ttl_seconds


# ── Top-level fallback ────────────────────────────────────────────────────────
async def compute_user_score(user_id: str) -> float:
    """
    Standalone fallback scorer — spins up a fresh builder each call.
    Used by simple endpoints that don't have access to the ScoringService
    singleton (e.g. a lightweight health-check route).

    For production traffic prefer ScoringService.get_user_dashboard() which
    keeps the graph cached across requests.
    """
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

        # ── Resolve supabase_id → HGT index ──────────────────────────────────
        # builder.supabase_to_idx is populated during build():
        #   supabase_id → int index in the node feature matrix
        user_idx = builder.supabase_to_idx.get(user_id)
        if user_idx is None:
            logger.warning(f"compute_user_score: supabase_id '{user_id}' not in graph.")
            return 0

        # ── Run HGT forward pass ──────────────────────────────────────────────
        model = TuneInHGT(
            hidden_channels=128,
            out_channels=64,
            num_heads=4,
            num_layers=2,
            metadata=graph.metadata(),
        )
        model.eval()
        with torch.no_grad():
            outputs = model(graph.x_dict, graph.edge_index_dict)

        user_scores = outputs["user_scores"].cpu().numpy()
        hgt_raw     = float(user_scores[user_idx])

        likes = int((graph["user", "LIKES",  "post"].edge_index[0] == user_idx).sum())
        clubs = int((graph["user", "JOINED", "club"].edge_index[0] == user_idx).sum())

        total_score = (
            likes           * 20  * 0.40 +
            clubs           * 15  * 0.35 +
            max(0, hgt_raw) * 100 * 0.25
        )
        return round(max(0.0, total_score), 2)

    except Exception as e:
        logger.error(f"compute_user_score failed: {e}", exc_info=True)
        return 0


# ── Singleton service ─────────────────────────────────────────────────────────
class ScoringService:
    """
    One instance lives in FastAPI's app state.
    All endpoints call get_user_dashboard() / get_leaderboard().

    ID resolution chain
    ───────────────────
    HTTP request carries  →  Supabase user UUID
    Cache lookup via      →  self._cache.supabase_to_idx[supabase_uuid]
    Yields                →  int index into HGT embedding matrix
    """

    def __init__(
        self,
        neo4j_uri: str,
        neo4j_user: str,
        neo4j_password: str,
        config: HGTConfig = None,
        cache_ttl: int = 300,
    ):
        self._neo4j_uri      = neo4j_uri
        self._neo4j_user     = neo4j_user
        self._neo4j_password = neo4j_password
        self._config         = config or HGTConfig()
        self._cache_ttl      = cache_ttl
        self._cache          = GraphCache()
        self._model: Optional[TuneInHGT] = None
        self._lock           = asyncio.Lock()

    # ── Public API ───────────────────────────────────────────────────────────

    async def get_user_dashboard(self, user_uuid: str, top_k: int = 5) -> dict:
        """
        Main entry point. user_uuid is the Supabase auth UUID sent from the
        frontend — resolved to an HGT index via supabase_to_idx.
        """
        await self._ensure_fresh_cache()

        # ── Resolve Supabase UUID → HGT matrix index ─────────────────────────
        idx = self._cache.supabase_to_idx.get(user_uuid)
        if idx is None:
            raise ValueError(
                f"Supabase UUID '{user_uuid}' has no matching node in the graph. "
                "Run `MATCH (u:User) SET u.supabase_id = u.id` in Neo4j if you "
                "haven't done the one-time migration yet."
            )

        scores     = self._cache.user_scores      # [N_users]
        embeddings = self._cache.user_embeddings  # [N_users, out_channels]
        data       = self._cache.data

        # ── 1. Blended leaderboard score ─────────────────────────────────────
        hgt_raw     = float(scores[idx])
        likes_count = self._count_edges(data, ("user", "LIKES",  "post"), idx, side=0)
        clubs_count = self._count_edges(data, ("user", "JOINED", "club"), idx, side=0)

        cfg = self._config
        total_score = round(max(0.0,
            cfg.weight_likes      * likes_count       * 20  +
            cfg.weight_clubs      * clubs_count       * 15  +
            cfg.weight_hgt_signal * max(0, hgt_raw)   * 100
        ), 1)

        # ── 2. Global rank (among ALL graph users) ───────────────────────────
        all_scores_tensor = torch.tensor(scores)
        rank = int((all_scores_tensor > hgt_raw).sum().item()) + 1

        # ── 3. Cosine-similarity user recommendations ────────────────────────
        # cos(θ) = (A·B) / (‖A‖·‖B‖)
        # Users closest in embedding space share behavioral patterns across
        # music / cinema / fitness / tech domains simultaneously.
        target_vec = embeddings[idx].reshape(1, -1)
        sim_scores = cosine_similarity(target_vec, embeddings).flatten()
        sim_scores[idx] = -1  # exclude self

        top_indices = np.argsort(sim_scores)[::-1][:top_k]
        supa_ids    = data["user"].supabase_ids   # parallel list of supabase UUIDs

        recommendations = []
        for sim_idx in top_indices:
            sim_idx = int(sim_idx)
            sim_val = float(sim_scores[sim_idx])
            if sim_val < 0.1:
                continue
            rec_supabase_id = supa_ids[sim_idx]
            recommendations.append({
                "id":           rec_supabase_id,
                "type":         "user",
                "title":        f"User @{rec_supabase_id[:8]}",
                "subtitle":     "Similar multi-domain behavior",
                "impact":       f"+{int(sim_val * 40)} Pts",
                "match_score":  int(sim_val * 100),
                "match_reason": "HGT Graph Proximity",
                "actionPath":   f"/user/{rec_supabase_id}",
            })

        # ── 4. Per-domain breakdown (grows as APIs connect) ──────────────────
        # Each connected API adds more edges to the graph which increases the
        # relevant count here automatically — no code changes needed.
        api_connections = [
            {
                "id":        "social",
                "name":      "Clubs Joined",
                "points":    clubs_count * 15,
                "connected": clubs_count > 0,
                "icon":      "users",
            },
            {
                "id":        "posts",
                "name":      "Posts Liked",
                "points":    likes_count * 20,
                "connected": likes_count > 0,
                "icon":      "heart",
            },
        ]

        return {
            "user_id":         user_uuid,
            "total_score":     total_score,
            "rank":            rank,
            "total_users":     len(supa_ids),
            "hgt_raw_signal":  round(hgt_raw, 4),
            "api_connections": api_connections,
            "recommendations": recommendations,
        }

    async def get_leaderboard(self, top_k: int = 20) -> list[dict]:
        """
        Returns top-k users ranked by blended HGT influence score.
        user_id in each row is the Supabase UUID so the frontend can
        link directly to /user/:id.
        """
        await self._ensure_fresh_cache()

        scores   = self._cache.user_scores
        data     = self._cache.data
        cfg      = self._config
        supa_ids = data["user"].supabase_ids   # parallel to int indices

        results = []
        for idx, raw_score in enumerate(scores):
            likes = self._count_edges(data, ("user", "LIKES",  "post"), idx, side=0)
            clubs = self._count_edges(data, ("user", "JOINED", "club"), idx, side=0)
            blended = round(max(0.0,
                cfg.weight_likes      * likes                    * 20  +
                cfg.weight_clubs      * clubs                    * 15  +
                cfg.weight_hgt_signal * max(0, float(raw_score)) * 100
            ), 1)
            results.append({
                "rank":        0,             # filled after sort
                "user_id":     supa_ids[idx], # Supabase UUID for frontend links
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
        """Returns posts ranked by HGT post quality score."""
        await self._ensure_fresh_cache()

        post_scores = self._cache.post_scores
        post_ids    = self._cache.data["post"].node_ids

        ranked = sorted(
            [(post_ids[i], float(s)) for i, s in enumerate(post_scores)],
            key=lambda x: x[1],
            reverse=True,
        )
        return [
            {"post_id": pid, "hgt_score": round(score, 4), "rank": i + 1}
            for i, (pid, score) in enumerate(ranked[:top_k])
        ]

    async def invalidate_cache(self):
        """Call this when you add new nodes/edges to Neo4j."""
        async with self._lock:
            self._cache = GraphCache()
        logger.info("Graph cache invalidated.")

    # ── Internal ─────────────────────────────────────────────────────────────

    async def _ensure_fresh_cache(self):
        """Thread-safe cache refresh with TTL."""
        if not self._cache.is_stale(self._cache_ttl):
            return
        async with self._lock:
            if not self._cache.is_stale(self._cache_ttl):
                return  # another coroutine refreshed while we waited
            await self._rebuild_cache()

    async def _rebuild_cache(self):
        logger.info("Rebuilding HGT graph cache from Neo4j …")
        t0 = time.time()

        builder = Neo4jGraphBuilder(
            self._neo4j_uri, self._neo4j_user, self._neo4j_password
        )
        await builder.connect()
        try:
            data, id_maps = await builder.build()
        finally:
            await builder.close()

        # ── Lazy-init model on first run ──────────────────────────────────────
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
            # Copy the supabase→idx map built by the graph builder so every
            # public method can resolve a Supabase UUID in O(1).
            supabase_to_idx = dict(builder.supabase_to_idx),
            user_embeddings = outputs["user_embeddings"].cpu().numpy(),
            user_scores     = outputs["user_scores"].cpu().numpy(),
            post_scores     = outputs["post_scores"].cpu().numpy(),
            built_at        = time.time(),
        )

        logger.info(f"Cache rebuilt in {time.time() - t0:.2f}s")

    @staticmethod
    def _count_edges(data, edge_type: tuple, node_idx: int, side: int) -> int:
        """
        Counts edges of `edge_type` involving node_idx on `side` (0=src, 1=dst).
        Works for any edge type — so when GitHub/Spotify/Strava edges are added
        to the graph, passing the right edge_type here picks them up for free.
        """
        try:
            edge_index = data[edge_type].edge_index
            return int((edge_index[side] == node_idx).sum().item())
        except (KeyError, AttributeError):
            return 0