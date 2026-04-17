# tunein.py — Fixed routes
#
# Changes vs previous version:
#   1. Singleton ScoringService — cache persists across requests
#   2. get_user_dashboard is async — called directly (no run_in_executor deadlock)
#   3. /leaderboard now accepts requesting_user_id so similarity_to_me is populated
#   4. /dashboard returns top_similar (top 3 by match_pct with full activity)

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
import os
import logging

logger = logging.getLogger(__name__)

router   = APIRouter(prefix="/api/tune-in")
security = HTTPBearer()

# ── Singleton ─────────────────────────────────────────────────────────────────
_scoring_service = None

def get_scoring_service():
    global _scoring_service
    if _scoring_service is None:
        from scoring_service import ScoringService
        _scoring_service = ScoringService(
            neo4j_uri=os.getenv("NEO4J_URI", "neo4j://localhost:7687"),
            neo4j_user=os.getenv("NEO4J_USER", "neo4j"),
            neo4j_password=os.getenv("NEO4J_PASSWORD", "password"),
        )
        logger.info("ScoringService singleton created.")
    return _scoring_service


# ── Auth ──────────────────────────────────────────────────────────────────────

def verify_token(token: str) -> str:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    result = sb.auth.get_user(token)
    if not result or not result.user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return result.user.id


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Returns total_score, rank, total_users, top_similar (top 3 by match_pct
    with full activity), mentors, mentees.
    """
    user_id = verify_token(credentials.credentials)
    svc     = get_scoring_service()
    data    = await svc.get_user_dashboard(user_id)

    # Diagnostic log — remove once confirmed working
    logger.info(
        f"/dashboard → user={user_id} score={data['total_score']} "
        f"rank={data['rank']}/{data['total_users']} "
        f"top_similar={[u['username'] for u in data['top_similar']]}"
    )
    return data


@router.get("/leaderboard")
async def get_leaderboard(
    top_k: int = 50,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Returns leaderboard with similarity_to_me populated for each entry
    so the frontend can show how close each leader is to the current user.
    """
    user_id = verify_token(credentials.credentials)
    svc     = get_scoring_service()
    return await svc.get_leaderboard(top_k=top_k, requesting_user_id=user_id)


@router.get("/user-activity/{target_user_id}")
async def get_user_activity(
    target_user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    verify_token(credentials.credentials)
    svc = get_scoring_service()
    return svc.get_user_activity(target_user_id)


@router.post("/invalidate-cache")
async def invalidate_cache(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Call this after any write (new club join, post like, etc.) to
    force a fresh score computation on the next request."""
    verify_token(credentials.credentials)
    svc = get_scoring_service()
    svc.invalidate_scores_cache()
    return {"ok": True}