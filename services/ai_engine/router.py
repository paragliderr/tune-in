"""
FastAPI Router — TuneIn HGT Endpoints
======================================
Mount this in your main.py with:
    from ai_engine.router import router as hgt_router
    app.include_router(hgt_router)

Endpoints
─────────
GET /api/tune-in/dashboard/{user_uuid}   → Tune-In dashboard (scores + recs)
GET /api/tune-in/leaderboard             → Global leaderboard
GET /api/tune-in/feed                    → HGT-ranked post feed
POST /api/tune-in/invalidate             → Force graph cache rebuild
GET /api/tune-in/health                  → Model + cache status
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from .scoring_service import ScoringService, HGTConfig

logger = logging.getLogger(__name__)

# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/tune-in", tags=["Tune-In HGT"])

@router.get("/leaderboard")
async def leaderboard():
    users = await get_all_users()

    result = []
    for user in users:
        try:
            score = await compute_user_score(user["id"])
        except:
            score = 0

        result.append({
            "user_id": user["id"],
            "score": score or 0
        })

    return sorted(result, key=lambda x: x["score"], reverse=True)

# ── Service factory (injected into FastAPI app state in main.py) ─────────────
def get_scoring_service(request: Request) -> ScoringService:
    svc = getattr(request.app.state, "scoring_service", None)
    if svc is None:
        raise HTTPException(500, "Scoring service not initialised.")
    return svc


# ── Response models ───────────────────────────────────────────────────────────
class DashboardResponse(BaseModel):
    user_id:          str
    total_score:      float
    rank:             int
    total_users:      int
    hgt_raw_signal:   float
    api_connections:  list[dict]
    recommendations:  list[dict]


class LeaderboardEntry(BaseModel):
    rank:         int
    user_id:      str
    total_score:  float
    likes_count:  int
    clubs_count:  int
    hgt_signal:   float


class PostFeedEntry(BaseModel):
    post_id:    str
    hgt_score:  float
    rank:       int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dashboard/{user_uuid}", response_model=DashboardResponse)
async def get_tune_in_dashboard(
    user_uuid: str,
    top_k: int = 5,
    svc: ScoringService = Depends(get_scoring_service),
):
    """
    Returns HGT-computed scores and user recommendations for the Tune-In page.

    - total_score     : blended leaderboard score (likes × 0.4 + clubs × 0.35 + HGT × 0.25)
    - rank            : global rank among all users in the graph
    - recommendations : top-k most similar users by cosine similarity of HGT embeddings
    - hgt_raw_signal  : raw HGT output (useful for debugging)
    """
    try:
        return await svc.get_user_dashboard(user_uuid, top_k=top_k)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.exception("Dashboard error")
        raise HTTPException(500, f"HGT inference failed: {e}")


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    top_k: int = 20,
    svc: ScoringService = Depends(get_scoring_service),
):
    """
    Returns the global leaderboard: all users ranked by HGT influence score.
    Result is cached — refreshes every 5 minutes or on /invalidate call.
    """
    try:
        return await svc.get_leaderboard(top_k=top_k)
    except Exception as e:
        logger.exception("Leaderboard error")
        raise HTTPException(500, str(e))


@router.get("/feed", response_model=list[PostFeedEntry])
async def get_ranked_feed(
    top_k: int = 30,
    svc: ScoringService = Depends(get_scoring_service),
):
    """
    Returns posts ranked by the HGT post quality score head.
    Use this to power the Cinema/feed page ordering.
    """
    try:
        return await svc.get_post_feed(top_k=top_k)
    except Exception as e:
        logger.exception("Feed error")
        raise HTTPException(500, str(e))


@router.post("/invalidate")
async def invalidate_cache(svc: ScoringService = Depends(get_scoring_service)):
    """
    Forces a graph cache rebuild from Neo4j.
    Call this from your Supabase webhook / Neo4j trigger when new data arrives.
    """
    await svc.invalidate_cache()
    return {"status": "ok", "message": "Graph cache cleared. Next request will rebuild."}


@router.get("/health")
async def health(request: Request):
    """Returns model and cache status."""
    svc: ScoringService = getattr(request.app.state, "scoring_service", None)
    if svc is None:
        return {"status": "not_initialised"}

    cache = svc._cache
    return {
        "status":       "ok",
        "cache_built":  cache.built_at > 0,
        "cache_age_s":  round(__import__("time").time() - cache.built_at, 1) if cache.built_at else None,
        "num_users":    len(cache.id_maps.get("user", {})),
        "num_posts":    len(cache.id_maps.get("post", {})),
        "num_clubs":    len(cache.id_maps.get("club", {})),
    }


# ── Lifespan helper (call from your main.py lifespan) ────────────────────────
def create_scoring_service() -> ScoringService:
    """
    Creates a ScoringService from env vars.
    Add to your FastAPI lifespan:

        @asynccontextmanager
        async def lifespan(app: FastAPI):
            from ai_engine.router import create_scoring_service
            app.state.scoring_service = create_scoring_service()
            yield

    Required env vars:
        NEO4J_URI       e.g. bolt://localhost:7687
        NEO4J_USER      e.g. neo4j
        NEO4J_PASSWORD  your password
    """
    return ScoringService(
        neo4j_uri      = os.environ["NEO4J_URI"],
        neo4j_user     = os.environ.get("NEO4J_USER", "neo4j"),
        neo4j_password = os.environ["NEO4J_PASSWORD"],
        config         = HGTConfig(
            hidden_channels = int(os.environ.get("HGT_HIDDEN", "128")),
            out_channels    = int(os.environ.get("HGT_OUT", "64")),
            num_heads       = int(os.environ.get("HGT_HEADS", "4")),
            num_layers      = int(os.environ.get("HGT_LAYERS", "2")),
        ),
        cache_ttl = int(os.environ.get("HGT_CACHE_TTL", "300")),
    )