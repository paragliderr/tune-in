from fastapi import APIRouter, Header, HTTPException, status, BackgroundTasks
import os
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client
from pydantic import BaseModel
from services.github_service import GitHubService
from services.strava_service import StravaService
from services.letterboxd_service import LetterboxdService
from services.spotify_service import SpotifyService
from services.steam_service import SteamService

router = APIRouter(prefix="/connect", tags=["connect"])

class ConnectRequest(BaseModel):
    token: str

class SpotifyConnectRequest(BaseModel):
    client_id: str
    client_secret: str
    refresh_token: str

class StravaConnectRequest(BaseModel):
    client_id: str
    client_secret: str
    refresh_token: str
    code: Optional[str] = None

class SteamConnectRequest(BaseModel):
    api_key: str
    steam_id: str

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

    user_res = supabase.auth.get_user(jwt)
    if not user_res.user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return user_res.user


# ---------------------------------------------------------------------------
# GitHub
# ---------------------------------------------------------------------------

def process_github_sync(user_id: str, token: str):
    """Fetch stats from GitHub and persist to Supabase."""
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
            "updated_at": weekly_data["fetched_at"],
        }
        supabase.table("github_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print(f"✅ [OK] GitHub sync completed for {username}")
    except Exception as e:
        print(f"❌ [ERROR] GitHub Sync Failed for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Strava
# ---------------------------------------------------------------------------

def _persist_strava_tokens(
    supabase,
    user_id: str,
    client_id: str,
    client_secret: str,
    access_token: str,
    refresh_token: str,
    expires_at: str,
):
    token_entry = {
        "user_id": user_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("strava_tokens").upsert(token_entry, on_conflict="user_id").execute()


def process_strava_sync(user_id: str, client_id: str, client_secret: str, refresh_token: str):
    """Fetch stats from Strava, persist rotated tokens, and update stats table."""
    try:
        print(f"\n[SYNC] Starting Strava sync for user {user_id}...")
        supabase = get_supabase()
        strava = StravaService(client_id, client_secret, refresh_token)

        access_token = strava._get_access_token()
        new_refresh_token = getattr(strava, "refresh_token", refresh_token)
        expires_at = datetime.fromtimestamp(strava.expires_at, tz=timezone.utc).isoformat()

        _persist_strava_tokens(
            supabase, user_id, client_id, client_secret,
            access_token, new_refresh_token, expires_at,
        )

        data = strava.get_user_data()

        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        if profile_res.data:
            connections = profile_res.data.get("connections", {}) or {}
            connections["strava"] = data["username"]
            supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        stats_entry = {
            "user_id": user_id,
            "username": data["username"],
            "total_distance_km": data.get("overall", {}).get("total_distance_km", 0),
            "total_elevation_m": data.get("overall", {}).get("total_elevation_m", 0),
            "total_moving_time_hrs": data.get("overall", {}).get("total_moving_time_hrs", 0),
            "score": data.get("weekly", {}).get("score", 0),
            "raw_data": data,
            "updated_at": data.get("fetched_at", datetime.now(timezone.utc).isoformat()),
        }
        supabase.table("strava_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print(f"✅ [OK] Strava sync completed for {data['username']}")
    except Exception as e:
        print(f"❌ [ERROR] Strava Sync Failed for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Spotify
# ---------------------------------------------------------------------------

def _persist_spotify_tokens(supabase, user_id: str, client_id: str, client_secret: str, refresh_token: str):
    token_entry = {
        "user_id": user_id,
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("spotify_tokens").upsert(token_entry, on_conflict="user_id").execute()


def process_spotify_sync(user_id: str, client_id: str, client_secret: str, refresh_token: str):
    """Fetch stats from Spotify, persist tokens, and store FULL structured data."""
    try:
        print(f"\n[SYNC] Starting Spotify sync for user {user_id}...")
        supabase = get_supabase()
        spotify = SpotifyService(client_id, client_secret, refresh_token)

        spotify._refresh_access_token()
        access_token = spotify._access_token
        new_refresh_token = getattr(spotify, "refresh_token", refresh_token)

        _persist_spotify_tokens(supabase, user_id, client_id, client_secret, new_refresh_token)

        data = spotify.get_user_data()

        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        if profile_res.data:
            connections = profile_res.data.get("connections", {}) or {}
            connections["spotify"] = data["username"]
            supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        stats = data.get("stats", {})

        stats_entry = {
            "user_id": user_id,
            "username": data.get("username"),
            "followers": data.get("followers", 0),
            "product": data.get("product"),
            "playlist_count": stats.get("playlist_count", 0),
            "saved_tracks": stats.get("saved_tracks", 0),
            "top_artist_count": stats.get("top_artist_count", 0),
            "top_track_count": stats.get("top_track_count", 0),
            "vibe": stats.get("vibe", {}),
            "currently_playing": data.get("currently_playing"),
            "raw_data": data,
            "updated_at": data.get("fetched_at", datetime.now(timezone.utc).isoformat()),
        }

        supabase.table("spotify_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print(f"✅ [OK] Spotify sync completed for {data['username']}")
    except Exception as e:
        print(f"❌ [ERROR] Spotify Sync Failed for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Steam
# ---------------------------------------------------------------------------

def _persist_steam_tokens(supabase, user_id: str, api_key: str, steam_id: str):
    """Upsert Steam credentials into steam_tokens table."""
    token_entry = {
        "user_id": user_id,
        "api_key": api_key,
        "steam_id": steam_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("steam_tokens").upsert(token_entry, on_conflict="user_id").execute()


def process_steam_sync(user_id: str, api_key: str, steam_id: str):
    """Fetch stats from Steam and persist to steam_stats table."""
    try:
        print(f"\n[SYNC] Starting Steam sync for user {user_id}...")
        supabase = get_supabase()
        steam = SteamService(api_key, steam_id)

        data = steam.get_user_data()
        display_name = data["summary"].get("display_name", steam_id)

        # Update profile connections
        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        if profile_res.data:
            connections = profile_res.data.get("connections", {}) or {}
            connections["steam"] = display_name
            supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        summary = data.get("summary", {})
        score   = data.get("score", {})

        stats_entry = {
            "user_id":            user_id,
            "username":           display_name,
            "steam_id":           steam_id,
            "steam_level":        summary.get("steam_level"),
            "total_games":        summary.get("total_games", 0),
            "total_playtime_hrs": summary.get("total_playtime_hrs", 0),
            "total_badges":       summary.get("total_badges", 0),
            "total_achievements": summary.get("total_achievements", 0),
            "friend_count":       summary.get("friend_count", 0),
            "score":              score.get("total_score", 0),
            "raw_data":           data,
            "updated_at":         data.get("fetched_at", datetime.now(timezone.utc).isoformat()),
        }
        supabase.table("steam_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print(f"✅ [OK] Steam sync completed for {display_name}")
    except Exception as e:
        print(f"❌ [ERROR] Steam Sync Failed for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()


# ---------------------------------------------------------------------------
# Routes — GitHub
# ---------------------------------------------------------------------------

@router.post("/github")
async def connect_github(req: ConnectRequest, background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()
    supabase.table("github_tokens").upsert({"user_id": user_id, "token": req.token}, on_conflict="user_id").execute()

    background_tasks.add_task(process_github_sync, user_id, req.token)
    return {"status": "success", "message": "GitHub linked! Syncing in background..."}


@router.post("/github/sync")
async def sync_github(background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()

    token_res = supabase.table("github_tokens").select("token").eq("user_id", user_id).single().execute()
    if not token_res.data:
        raise HTTPException(400, "GitHub not linked")

    background_tasks.add_task(process_github_sync, user_id, token_res.data["token"])
    return {"status": "success", "message": "GitHub background sync started!"}


# ---------------------------------------------------------------------------
# Routes — Strava
# ---------------------------------------------------------------------------

@router.post("/strava")
async def connect_strava(req: StravaConnectRequest, background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()

    try:
        strava = StravaService(req.client_id, req.client_secret, req.refresh_token)

        if req.code:
            print(f"[SYNC] Exchanging initial code for user {user_id}")
            strava.code = req.code
            token_data = strava.exchange_code()
            current_refresh_token = token_data["refresh_token"]
            current_access_token = token_data["access_token"]
            current_expires_at = datetime.fromtimestamp(token_data["expires_at"], tz=timezone.utc).isoformat()
        else:
            print(f"[SYNC] Using existing refresh token for user {user_id}")
            current_access_token = strava._get_access_token()
            current_refresh_token = getattr(strava, "refresh_token", req.refresh_token)
            current_expires_at = datetime.fromtimestamp(strava.expires_at, tz=timezone.utc).isoformat()

        _persist_strava_tokens(
            supabase, user_id, req.client_id, req.client_secret,
            current_access_token, current_refresh_token, current_expires_at,
        )

        background_tasks.add_task(
            process_strava_sync, user_id, req.client_id, req.client_secret, current_refresh_token
        )
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
    if not token_res.data:
        raise HTTPException(400, "Strava not linked")

    d = token_res.data
    background_tasks.add_task(process_strava_sync, user_id, d["client_id"], d["client_secret"], d["refresh_token"])
    return {"status": "success", "message": "Strava background sync started!"}


# ---------------------------------------------------------------------------
# Routes — Spotify
# ---------------------------------------------------------------------------

@router.post("/spotify")
async def connect_spotify(req: SpotifyConnectRequest, background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()

    try:
        spotify = SpotifyService(req.client_id, req.client_secret, req.refresh_token)
        spotify._refresh_access_token()
        new_refresh_token = getattr(spotify, "refresh_token", req.refresh_token)

        _persist_spotify_tokens(supabase, user_id, req.client_id, req.client_secret, new_refresh_token)

        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        connections = (profile_res.data or {}).get("connections", {}) or {}
        connections["spotify"] = "connected"
        supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        background_tasks.add_task(process_spotify_sync, user_id, req.client_id, req.client_secret, new_refresh_token)
    except Exception as e:
        print(f"[ERROR] Spotify Link Failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "success", "message": "Spotify linked! Syncing in background..."}


@router.post("/spotify/sync")
async def sync_spotify(background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()

    token_res = supabase.table("spotify_tokens").select("*").eq("user_id", user_id).single().execute()
    if not token_res.data:
        raise HTTPException(400, "Spotify not linked")

    d = token_res.data
    background_tasks.add_task(process_spotify_sync, user_id, d["client_id"], d["client_secret"], d["refresh_token"])
    return {"status": "success", "message": "Spotify background sync started!"}


# ---------------------------------------------------------------------------
# Routes — Steam
# ---------------------------------------------------------------------------

@router.post("/steam")
async def connect_steam(req: SteamConnectRequest, background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()

    try:
        # Validate credentials by doing a quick player summary fetch
        steam = SteamService(req.api_key, req.steam_id)
        profile = steam.fetch_player_summary()
        if not profile:
            raise HTTPException(status_code=400, detail="Invalid Steam API key or Steam ID — could not fetch profile.")

        # Persist credentials
        _persist_steam_tokens(supabase, user_id, req.api_key, req.steam_id)

        # Immediately mark as connected so frontend shows Sync button right away
        display_name = profile.get("personaname", req.steam_id)
        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        connections = (profile_res.data or {}).get("connections", {}) or {}
        connections["steam"] = display_name
        supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()

        background_tasks.add_task(process_steam_sync, user_id, req.api_key, req.steam_id)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Steam Link Failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "success", "message": "Steam linked! Syncing in background..."}


@router.post("/steam/sync")
async def sync_steam(background_tasks: BackgroundTasks, authorization: str = Header(None)):
    user = await verify_supabase_user(authorization)
    user_id = user.id
    supabase = get_supabase()

    token_res = supabase.table("steam_tokens").select("*").eq("user_id", user_id).single().execute()
    if not token_res.data:
        raise HTTPException(400, "Steam not linked")

    d = token_res.data
    background_tasks.add_task(process_steam_sync, user_id, d["api_key"], d["steam_id"])
    return {"status": "success", "message": "Steam background sync started!"}


# ---------------------------------------------------------------------------
# Routes — Letterboxd (read-only proxy, no tokens)
# ---------------------------------------------------------------------------

@router.get("/letterboxd/feed")
def get_letterboxd_feed(username: str):
    """Proxy Letterboxd RSS for a username — returns parsed reviews as JSON."""
    try:
        service = LetterboxdService(username)
        reviews = service.get_reviews()
        return {"username": username, "reviews": reviews, "count": len(reviews)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Letterboxd feed: {str(e)}")
