from fastapi import APIRouter, Header, HTTPException, status, BackgroundTasks
import os
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client
from pydantic import BaseModel
from services.github_service import GitHubService
from services.strava_service import StravaService
from services.letterboxd_service import LetterboxdService

router = APIRouter(prefix="/connect", tags=["connect"])

class ConnectRequest(BaseModel):
    token: str

class StravaConnectRequest(BaseModel):
    client_id: str
    client_secret: str
    refresh_token: str
    code: Optional[str] = None

def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise Exception("Missing SUPABASE env variables")
    return create_client(url, key)

async def verify_supabase_user(auth_header: str):
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    jwt = auth_header.split(" ")[1]
    supabase = get_supabase()
    
    # Verify JWT with Supabase
    user_res = supabase.auth.get_user(jwt)
    if not user_res.user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    return user_res.user

def process_github_sync(user_id: str, token: str):
    """Heavy lifting: Fetch stats from GitHub."""
    try:
        print(f"\n[SYNC] Starting GitHub sync for user {user_id}...")
        gh_service = GitHubService(token)
        
        username = gh_service._get_username()
        supabase = get_supabase()
        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        if profile_res.data:
            connections = profile_res.data.get("connections", {}) or {}
            connections["github"] = username
            supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        weekly_data = gh_service.get_user_data(window="week")
        overall_data = gh_service.get_user_data(window="overall")

        stats_entry = {
            "user_id": user_id,
            "username": weekly_data["username"],
            "total_commits": max(weekly_data["summary"]["total_commits"], overall_data["summary"]["total_commits"]),
            "total_additions": weekly_data["summary"]["total_additions"],
            "total_deletions": weekly_data["summary"]["total_deletions"],
            "score": weekly_data["score"]["total_score"],
            "streak_days": weekly_data["score"]["streak_days"],
            "total_commits_overall": overall_data["summary"]["total_commits"],
            "score_overall": overall_data["score"]["total_score"],
            "raw_data": {"weekly": weekly_data, "overall": overall_data},
            "updated_at": weekly_data["fetched_at"]
        }
        supabase.table("github_stats").upsert(stats_entry, on_conflict="user_id").execute()
    except Exception as e:
        print(f"❌ [ERROR] GitHub Sync Failed for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()

def process_strava_sync(user_id: str, client_id: str, client_secret: str, refresh_token: str):
    """Heavy lifting: Fetch stats from Strava."""
    try:
        print(f"\n[SYNC] Starting Strava sync for user {user_id}...")
        strava = StravaService(client_id, client_secret, refresh_token)
        data = strava.get_user_data()
        
        supabase = get_supabase()

        # 1. Update Profile Handle
        print(f"[SYNC] Updating Strava handle to @{data['username']}")
        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        if profile_res.data:
            connections = profile_res.data.get("connections", {}) or {}
            connections["strava"] = data["username"]
            supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        # 2. Update stats table
        stats_entry = {
            "user_id": user_id,
            "username": data["username"],
            "total_distance_km": data.get("overall", {}).get("total_distance_km", 0),
            "total_elevation_m": data.get("overall", {}).get("total_elevation_m", 0),
            "total_moving_time_hrs": data.get("overall", {}).get("total_moving_time_hrs", 0),
            "score": data.get("weekly", {}).get("score", 0),
            "raw_data": data,
            "updated_at": data.get("fetched_at", datetime.now(timezone.utc).isoformat())
        }
        supabase.table("strava_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print(f"✅ [OK] Strava sync completed for {data['username']}")
    except Exception as e:
        print(f"❌ [ERROR] Strava Sync Failed for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        # No re-raise needed in task, just log to console

@router.post("/github")
async def connect_github(req: ConnectRequest, background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()
    supabase.table("github_tokens").upsert({"user_id": user_id, "token": req.token}, on_conflict="user_id").execute()
    
    # Run sync in background to prevent timeout
    background_tasks.add_task(process_github_sync, user_id, req.token)
    
    return {"status": "success", "message": "GitHub linked! Syncing in background..."}

@router.post("/github/sync")
async def sync_github(background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()
    token_res = supabase.table("github_tokens").select("token").eq("user_id", user_id).single().execute()
    if not token_res.data: raise HTTPException(400, "Not linked")
    
    background_tasks.add_task(process_github_sync, user_id, token_res.data["token"])
    
    return {"status": "success", "message": "Background sync started!"}

@router.post("/strava")
async def connect_strava(req: StravaConnectRequest, background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()
    
    try:
        strava = StravaService(req.client_id, req.client_secret, req.refresh_token)
        
        # If code is provided, perform initial exchange
        if req.code:
            print(f"[SYNC] Exchanging initial code for @{user_id}")
            strava.code = req.code  # set it on the instance
            token_data = strava.exchange_code()  # now it will use the instance code
            current_refresh_token = token_data["refresh_token"]
            current_access_token = token_data["access_token"]
            current_expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc).isoformat()
        else:
            print(f"[SYNC] Using existing refresh token for @{user_id}")
            current_access_token = strava._get_access_token()
            current_refresh_token = req.refresh_token
            current_expires_at = datetime.fromtimestamp(strava.expires_at, tz=timezone.utc).isoformat()

        token_entry = {
            "user_id": user_id,
            "client_id": req.client_id,
            "client_secret": req.client_secret,
            "access_token": current_access_token,
            "refresh_token": current_refresh_token,
            "expires_at": current_expires_at
        }
        supabase.table("strava_tokens").upsert(token_entry, on_conflict="user_id").execute()
        
        # Trigger immediate sync using the final refresh_token
        background_tasks.add_task(process_strava_sync, user_id, req.client_id, req.client_secret, current_refresh_token)
    except Exception as e:
        print(f"[ERROR] Strava Link Failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "success", "message": "Strava linked! Syncing metrics in background..."}

@router.post("/strava/sync")
async def sync_strava(background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()
    
    token_res = supabase.table("strava_tokens").select("*").eq("user_id", user_id).single().execute()
    if not token_res.data: raise HTTPException(400, "Strava not linked")
    
    d = token_res.data
    background_tasks.add_task(process_strava_sync, user_id, d["client_id"], d["client_secret"], d["refresh_token"])
    
    return {"status": "success", "message": "Strava background sync started!"}

@router.get("/letterboxd/feed")
def get_letterboxd_feed(username: str):
    """Proxy Letterboxd RSS for a username — returns parsed reviews as JSON."""
    try:
        service = LetterboxdService(username)
        reviews = service.get_reviews()
        return {"username": username, "reviews": reviews, "count": len(reviews)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Letterboxd feed: {str(e)}")
