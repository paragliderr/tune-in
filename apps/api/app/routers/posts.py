from fastapi import APIRouter, HTTPException
from typing import Optional

from pydantic import BaseModel
import os
from supabase import create_client, Client
# from dotenv import load_dotenv 

# load_dotenv() 

router = APIRouter(prefix="/posts", tags=["posts"])


def get_supabase():
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY")
    )

class PostCreate(BaseModel):
    title: str
    content: str
    club_id: str
    user_id: str
    image_url: Optional[str] = None

@router.post("/")
def create_new_post(post: PostCreate):
    try:
        supabase = get_supabase()   # 🔥 ADD THIS LINE

        print("\n--- NEW POST INCOMING ---")
        print(f"Title: {post.title}\n")

        new_post_data = {
            "user_id": post.user_id,
            "club_id": post.club_id,
            "title": post.title,
            "content": post.content,
            "embedding": None,
        }

        if post.image_url:
            new_post_data["image_url"] = post.image_url
        
        response = supabase.table("posts").insert(new_post_data).execute()
        
        return {
            "status": "success", 
            "message": "Post published!", 
            "post_id": response.data[0]['id']
        }
        
    except Exception as e:
        print(f"\nSERVER ERROR: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))