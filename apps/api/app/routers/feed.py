from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import random 
from supabase import create_client, Client
from dotenv import load_dotenv

from app.services.redis_service import get_recent_interactions
from app.services.alignment_service import build_session_vector

load_dotenv()
router = APIRouter(prefix="/feed", tags=["feed"])
supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

class FeedRequest(BaseModel):
    user_id: str
    limit: int = 20

@router.post("/")
def get_unified_feed(request: FeedRequest):
    try:
        # user data
        recent_post_ids = get_recent_interactions(request.user_id, "like")
        seen_ids = [pid.decode('utf-8') for pid in recent_post_ids] if recent_post_ids else []
        mood_vector = [0.0] * 128 
        
        if seen_ids:
            history_response = supabase.table("posts").select("embedding").in_("id", seen_ids).execute()
            if history_response.data:
                historical_vectors = [post['embedding'] for post in history_response.data if post['embedding']]
                if historical_vectors:
                    mood_vector = build_session_vector(historical_vectors)
                    
        clubs_response = supabase.table("club_members").select("club_id").eq("user_id", request.user_id).execute()
        target_clubs = [membership['club_id'] for membership in clubs_response.data]
        
        if not target_clubs:
             return {"feed": [], "message": "User is not in any clubs yet!"}

        # ENGINE 1: THE EXPLOIT FEED  

        exploit_limit = int(request.limit * 0.75)
        
        exploit_response = supabase.rpc(
            "generate_personalized_feed", 
            {
                "query_embedding": str(mood_vector),
                "target_club_ids": target_clubs,
                "seen_post_ids": seen_ids,
                "match_limit": exploit_limit
            }
        ).execute()
        
        exploit_posts = exploit_response.data if exploit_response.data else []

        
        # ENGINE 2: THE EXPLORE FEED 
        
        explore_limit = request.limit - exploit_limit
        
        # Lightcgn fetcher 
        explore_posts = [] 

        # THE BLENDER: Merge and format
       
        unified_feed = exploit_posts + explore_posts
        
        # Removing duplicates 
        unique_feed_dict = {post['id']: post for post in unified_feed}
        final_feed = list(unique_feed_dict.values())
        
        # Shuffle so the "Explore" posts are mixed naturally into the feed
        random.shuffle(final_feed)

        return {
            "status": "success",
            "feed": final_feed[:request.limit]
        }

    except Exception as e:
        print(f"FEED ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))