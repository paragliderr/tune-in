from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import random 
from supabase import create_client, Client
from dotenv import load_dotenv

from app.services.redis_service import get_recent_interactions, track_user_interaction
from app.services.alignment_service import build_session_vector

load_dotenv()
router = APIRouter(prefix="/feed", tags=["feed"])
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

class FeedRequest(BaseModel):
    user_id: str
    limit: int = 20


class TrackLikeRequest(BaseModel):
    user_id: str
    post_id: str


def _as_post_id(raw) -> str:
    if isinstance(raw, bytes):
        return raw.decode("utf-8")
    return str(raw)


@router.post("/track-like")
def track_like(body: TrackLikeRequest):
    try:
        track_user_interaction(body.user_id, body.post_id, "like")
        return {"status": "ok"}
    except Exception as e:
        print(f"TRACK LIKE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def get_unified_feed(request: FeedRequest):
    try:
        # ── Stage 1: Fetching user's recent interactions from Redis ──
        try:
            recent_post_ids = get_recent_interactions(request.user_id, "like") or []
        except Exception as redis_err:
            print(f"REDIS (feed history): {redis_err}")
            recent_post_ids = []
        seen_ids = [_as_post_id(pid) for pid in recent_post_ids]
        mood_vector = [0.0] * 128 
        
        # ── Stage 2: Building mood vector from history ──
        if seen_ids:
            try:
                history_response = supabase.table("posts").select("embedding").in_("id", seen_ids).execute()
                if history_response.data:
                    # Converting pgvector into lists of floats
                    import json
                    historical_vectors = []
                    for post in history_response.data:
                        emb = post.get('embedding')
                        if emb is None:
                            continue
                        if isinstance(emb, str):
                            emb = json.loads(emb)
                        if isinstance(emb, list) and len(emb) > 0:
                            historical_vectors.append(emb)
                    
                    if historical_vectors:
                        result_vec = build_session_vector(historical_vectors)
                        
                        mood_vector = list(result_vec) if not isinstance(result_vec, list) else result_vec
            except Exception as hist_err:
                print(f"HISTORY VECTOR BUILD ERROR: {hist_err}")
                # Continue with zero vector
                    
        # ── Stage 3: Fetch user's clubs ──
        clubs_response = supabase.table("club_members").select("club_id").eq("user_id", request.user_id).execute()
        target_clubs = [membership['club_id'] for membership in clubs_response.data]
        
        if not target_clubs:
             return {"feed": [], "message": "User is not in any clubs yet!"}

        # ── Stage 4: THE EXPLOIT FEED (pgvector similarity search) ──

        exploit_limit = int(request.limit * 0.75)
        
        embedding_str = "[" + ",".join(str(float(v)) for v in mood_vector) + "]"

        try:
            exploit_response = supabase.rpc(
                "generate_personalized_feed", 
                {
                    "query_embedding": embedding_str,
                    "target_club_ids": target_clubs,
                    "seen_post_ids": seen_ids if seen_ids else [],
                    "match_limit": exploit_limit
                }
            ).execute()
            
            exploit_posts = exploit_response.data if exploit_response.data else []
        except Exception as rpc_err:
            print(f"RPC ERROR: {rpc_err}")
            # Fallback: fetch recent posts sorted by like_count
            fallback = supabase.table("posts").select("id,title,content,club_id,user_id,image_url,like_count,dislike_count,comment_count,created_at").in_("club_id", target_clubs).order("like_count", desc=True).order("created_at", desc=True).limit(exploit_limit).execute()
            exploit_posts = fallback.data if fallback.data else []

        # ── Stage 5: THE EXPLORE FEED ──
        
        explore_limit = request.limit - exploit_limit
        explore_posts = [] 

        # ── Stage 6: THE BLENDER ──
       
        unified_feed = exploit_posts + explore_posts
        
        # Removing duplicates 
        unique_feed_dict = {post['id']: post for post in unified_feed}
        final_feed = list(unique_feed_dict.values())
        
        # Shuffling the feed
        random.shuffle(final_feed)

        return {
            "status": "success",
            "feed": final_feed[:request.limit]
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"FEED ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))