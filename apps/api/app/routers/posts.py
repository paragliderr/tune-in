from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from supabase import create_client, Client
from dotenv import load_dotenv 

from app.services.alignment_service import generate_post_embedding

load_dotenv() 

router = APIRouter(prefix="/posts", tags=["posts"])

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

class PostCreate(BaseModel):
    title: str
    content: str
    club_id: str
    user_id: str

@router.post("/")
def create_new_post(post: PostCreate):
    try:
        vector_list = generate_post_embedding(post.title, post.content)
        
        # --- X-RAY VISION ---
        print("\n--- NEW POST INCOMING ---")
        print(f"Title: {post.title}")
        print(f"Vector Length: {len(vector_list)} dimensions")
        print(f"Sample values: {vector_list[:3]}\n")
        
        new_post_data = {
            "user_id": post.user_id,
            "club_id": post.club_id,
            "title": post.title,
            "content": post.content,
            "embedding": str(vector_list)
        }
        
        response = supabase.table("posts").insert(new_post_data).execute()
        
        return {
            "status": "success", 
            "message": "Post aligned and published!", 
            "post_id": response.data[0]['id']
        }
        
    except Exception as e:
        print(f"\nSERVER ERROR: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))