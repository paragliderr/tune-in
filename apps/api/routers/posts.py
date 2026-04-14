from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
import os
from supabase import create_client

router = APIRouter(prefix="/posts", tags=["posts"])


def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    print("SUPABASE_URL:", url)
    print("SUPABASE_KEY:", "SET" if key else "MISSING")

    if not url or not key:
        raise Exception("Missing SUPABASE env variables")

    return create_client(url, key)


class PostCreate(BaseModel):
    title: str
    content: str
    club_id: str
    user_id: str
    image_url: Optional[str] = None


@router.post("/")
def create_new_post(post: PostCreate):
    try:
        supabase = get_supabase()

        print("\n--- NEW POST INCOMING ---")
        print(f"Title: {post.title}")
        print(f"User: {post.user_id}")
        print(f"Club: {post.club_id}")

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

        print("SUPABASE RAW RESPONSE:", response)

        if not response.data:
            raise Exception(f"Insert failed: {response}")

        return {
            "status": "success",
            "message": "Post published!",
            "post_id": response.data[0]["id"],
        }

    except Exception as e:
        print(f"\nSERVER ERROR: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))