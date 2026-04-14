"""
Neo4j → PyTorch Geometric Graph Builder
========================================
Reads your REAL Neo4j data (User, Post, Club nodes + LIKES/JOINED/BELONGS_TO edges)
and converts them into a HeteroData object the HGT model can process.

This is where the math starts: every UUID is mapped to an integer index,
every node gets a feature vector (E5 embedding or fallback heuristic),
and every relationship becomes an edge_index tensor.
"""

import logging
from typing import Optional

import torch
import numpy as np
from torch_geometric.data import HeteroData
from neo4j import AsyncGraphDatabase, AsyncDriver

logger = logging.getLogger(__name__)


# ── Lazy E5 loader (avoids import crash if sentence-transformers not installed) ──
_E5_MODEL = None

def _get_e5_model():
    global _E5_MODEL
    if _E5_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            _E5_MODEL = SentenceTransformer("intfloat/e5-small-v2")
            logger.info("E5-small-v2 loaded for embedding generation.")
        except Exception as exc:
            logger.warning(f"E5 model unavailable ({exc}). Using random embeddings.")
    return _E5_MODEL


def _embed(texts: list[str]) -> torch.Tensor:
    """
    Converts a list of text strings into E5-small-v2 embeddings (dim=384).
    Falls back to random unit-normalised vectors if model is unavailable.
    """
    model = _get_e5_model()
    if model is not None:
        vecs = model.encode(
            [f"passage: {t}" for t in texts],
            normalize_embeddings=True,
            batch_size=64,
            show_progress_bar=False,
        )
        return torch.tensor(vecs, dtype=torch.float)
    else:
        # Reproducible random fallback — same text → same random vec via hash
        dim = 384
        out = []
        for t in texts:
            rng = np.random.default_rng(abs(hash(t)) % (2**31))
            vec = rng.standard_normal(dim).astype(np.float32)
            vec /= np.linalg.norm(vec) + 1e-8
            out.append(vec)
        return torch.tensor(np.stack(out), dtype=torch.float)


# ────────────────────────────────────────────────────────────────────────────
class Neo4jGraphBuilder:
    """
    Usage
    ─────
    builder = Neo4jGraphBuilder(uri, user, password)
    await builder.connect()
    data, id_maps = await builder.build()
    await builder.close()

    id_maps          →  {"user": {neo4j_id: int_idx}, "post": {...}, "club": {...}}
    user_id_map      →  neo4j_id → int_idx
    user_supabase_map→  neo4j_id → supabase_id  (used for API-side lookups)
    supabase_to_idx  →  supabase_id → int_idx   (direct fast lookup)
    """

    def __init__(self, uri: str, user: str, password: str):
        self._uri      = uri
        self._user     = user
        self._password = password
        self._driver: Optional[AsyncDriver] = None

        # ── ID mapping tables (populated during build) ───────────────────────
        self.user_id_map:       dict[str, int] = {}   # neo4j_id   → int index
        self.user_supabase_map: dict[str, str] = {}   # neo4j_id   → supabase_id
        self.supabase_to_idx:   dict[str, int] = {}   # supabase_id → int index  ← fast path

    async def connect(self):
        self._driver = AsyncGraphDatabase.driver(
            self._uri, auth=(self._user, self._password)
        )
        await self._driver.verify_connectivity()
        logger.info("Connected to Neo4j.")

    async def close(self):
        if self._driver:
            await self._driver.close()

    # ── Main build method ────────────────────────────────────────────────────
    async def build(self) -> tuple[HeteroData, dict]:
        """
        Runs Cypher queries → builds PyG HeteroData.
        Returns (data, id_maps).
        """
        async with self._driver.session() as session:
            users   = await self._fetch_users(session)
            posts   = await self._fetch_posts(session)
            clubs   = await self._fetch_clubs(session)
            likes   = await self._fetch_edges(session, "LIKES",      "User", "Post")
            joined  = await self._fetch_edges(session, "JOINED",     "User", "Club")
            belongs = await self._fetch_edges(session, "BELONGS_TO", "Post", "Club")

        # ── Build UUID → int index maps ──────────────────────────────────────
        # For users we also store the supabase_id mapping so the scoring
        # service can look up any user by their Supabase auth UUID.
        self.user_id_map       = {}
        self.user_supabase_map = {}
        self.supabase_to_idx   = {}

        for i, r in enumerate(users):
            neo4j_id    = r["id"]
            # If supabase_id was stored on the node use it; otherwise fall back
            # to treating neo4j_id == supabase_id (works after the one-time
            # `SET u.supabase_id = u.id` migration).
            supabase_id = r.get("supabase_id") or neo4j_id

            self.user_id_map[neo4j_id]            = i
            self.user_supabase_map[neo4j_id]       = supabase_id
            self.supabase_to_idx[supabase_id]      = i

        post_map = {r["id"]: i for i, r in enumerate(posts)}
        club_map = {r["id"]: i for i, r in enumerate(clubs)}

        id_maps = {
            "user": self.user_id_map,
            "post": post_map,
            "club": club_map,
        }

        # ── Generate node feature tensors ────────────────────────────────────
        # Each node's text is embedded via E5-small-v2
        user_texts = [f"{r.get('username', '')} {r.get('bio', '')}" for r in users]
        post_texts = [r.get("content", r.get("caption", ""))        for r in posts]
        club_texts = [f"{r.get('name', '')} {r.get('description', '')}" for r in clubs]

        logger.info(
            f"Embedding {len(users)} users, {len(posts)} posts, {len(clubs)} clubs …"
        )

        data = HeteroData()
        data["user"].x = _embed(user_texts) if users else torch.zeros(0, 384)
        data["post"].x = _embed(post_texts) if posts else torch.zeros(0, 384)
        data["club"].x = _embed(club_texts) if clubs else torch.zeros(0, 384)

        # Store node IDs for later lookup (uuid list, ordered by int index)
        data["user"].node_ids = [r["id"] for r in users]
        data["post"].node_ids = [r["id"] for r in posts]
        data["club"].node_ids = [r["id"] for r in clubs]

        # Also expose supabase_ids in the same index order for easy resolution
        data["user"].supabase_ids = [
            self.user_supabase_map[r["id"]] for r in users
        ]

        # ── Build edge_index tensors ─────────────────────────────────────────
        # edge_index shape: [2, num_edges]  →  [src_indices, dst_indices]
        data["user", "LIKES",      "post"].edge_index = self._make_edge_index(likes,   self.user_id_map, post_map)
        data["user", "JOINED",     "club"].edge_index = self._make_edge_index(joined,  self.user_id_map, club_map)
        data["post", "BELONGS_TO", "club"].edge_index = self._make_edge_index(belongs, post_map,         club_map)

        # ── Add reverse edges so message passing is bidirectional ────────────
        data["post", "LIKED_BY",   "user"].edge_index = self._reverse(data["user", "LIKES",      "post"].edge_index)
        data["club", "HAS_POST",   "post"].edge_index = self._reverse(data["post", "BELONGS_TO", "club"].edge_index)
        data["club", "HAS_MEMBER", "user"].edge_index = self._reverse(data["user", "JOINED",     "club"].edge_index)

        logger.info(
            f"Graph built: {len(users)} users | {len(posts)} posts | {len(clubs)} clubs | "
            f"{len(likes)} LIKES | {len(joined)} JOINED | {len(belongs)} BELONGS_TO"
        )
        return data, id_maps

    # ── Cypher helpers ───────────────────────────────────────────────────────

    async def _fetch_users(self, session) -> list[dict]:
        """
        Fetch users including supabase_id.
        After running the one-time migration:
            MATCH (u:User) SET u.supabase_id = u.id
        supabase_id will equal the Supabase auth UUID on every node.
        """
        result = await session.run(
            """
            MATCH (u:User)
            RETURN
                u.id          AS id,
                u.supabase_id AS supabase_id,
                u.username    AS username,
                u.bio         AS bio
            """
        )
        return [dict(r) async for r in result]

    async def _fetch_posts(self, session) -> list[dict]:
        result = await session.run(
            "MATCH (p:Post) RETURN p.id AS id, p.content AS content, p.caption AS caption"
        )
        return [dict(r) async for r in result]

    async def _fetch_clubs(self, session) -> list[dict]:
        result = await session.run(
            "MATCH (c:Club) RETURN c.id AS id, c.name AS name, c.description AS description"
        )
        return [dict(r) async for r in result]

    async def _fetch_edges(
        self, session, rel_type: str, src_label: str, dst_label: str
    ) -> list[dict]:
        cypher = (
            f"MATCH (a:{src_label})-[:{rel_type}]->(b:{dst_label}) "
            f"RETURN a.id AS src, b.id AS dst"
        )
        result = await session.run(cypher)
        return [dict(r) async for r in result]

    # ── Tensor helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _make_edge_index(
        edges: list[dict], src_map: dict, dst_map: dict
    ) -> torch.Tensor:
        """
        Converts list of {src: uuid, dst: uuid} to a [2, E] int64 tensor.
        Skips edges where either endpoint is missing from the map (data quality guard).
        """
        rows, cols = [], []
        for e in edges:
            s = src_map.get(e["src"])
            d = dst_map.get(e["dst"])
            if s is not None and d is not None:
                rows.append(s)
                cols.append(d)
        if not rows:
            return torch.zeros((2, 0), dtype=torch.long)
        return torch.tensor([rows, cols], dtype=torch.long)

    @staticmethod
    def _reverse(edge_index: torch.Tensor) -> torch.Tensor:
        """Flip src↔dst to create reverse edges."""
        return edge_index.flip(0)