import os
from fastapi import APIRouter
from supabase import create_client
from upstash_redis import Redis
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, "..", ".env")
load_dotenv(dotenv_path=env_path)

router = APIRouter()

NUM_POSTS = 20
POSTS_PER_ENGINE = 15

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
redis_client = Redis.from_env()

@router.get("/api/v1/feed/{user_id}")
def generate_blended_feed(user_id: str):
    print(f"Generating Blended Feed for User: {user_id}")

    exploit_posts = redis_client.lrange(f"exploit_feed:{user_id}", 0, POSTS_PER_ENGINE - 1)
    if not exploit_posts:
        exploit_posts = redis_client.lrange("global_trending", 0, POSTS_PER_ENGINE - 1)

    explore_posts = []
    user_data = supabase.table("profiles").select("explore_embedding").eq("id", user_id).execute()

    if user_data.data and user_data.data[0].get("explore_embedding"):
        user_vector = user_data.data[0]["explore_embedding"]
        matches = supabase.rpc("match_explore_posts", {
            "query_embedding": user_vector,
            "match_limit": POSTS_PER_ENGINE
        }).execute()
        explore_posts = [match["id"] for match in matches.data]

    if not exploit_posts and not explore_posts:
        print(f"No Redis or explore data for {user_id}, using Supabase fallback")
        recent = supabase.table("posts").select("id").order("created_at", desc=True).limit(NUM_POSTS).execute()
        final_feed_meta = [{"post_id": r["id"], "source": "explore"} for r in recent.data]
    else:
        final_feed_meta = []
        seen_posts = set()
        max_len = max(len(exploit_posts), len(explore_posts))

        for i in range(max_len):
            if i < len(exploit_posts):
                post_id = exploit_posts[i]
                if post_id not in seen_posts:
                    final_feed_meta.append({"post_id": post_id, "source": "exploit"})
                    seen_posts.add(post_id)

            if i < len(explore_posts):
                post_id = explore_posts[i]
                if post_id not in seen_posts:
                    final_feed_meta.append({"post_id": post_id, "source": "explore"})
                    seen_posts.add(post_id)

            if len(final_feed_meta) >= NUM_POSTS:
                break

    if not final_feed_meta:
        return {"user_id": user_id, "feed_length": 0, "feed": []}

    post_ids = [item["post_id"] for item in final_feed_meta]
    source_map = {item["post_id"]: item["source"] for item in final_feed_meta}

    rows = supabase.table("posts").select(
        "id, title, content, image_url, like_count, dislike_count, comment_count, created_at, user_id, club_id"
    ).in_("id", post_ids).execute()

    if not rows.data:
        return {"user_id": user_id, "feed_length": 0, "feed": []}

    club_ids = list({row["club_id"] for row in rows.data if row.get("club_id")})
    club_map = {}
    if club_ids:
        clubs = supabase.table("clubs").select("id, name, slug").in_("id", club_ids).execute()
        club_map = {c["id"]: c for c in clubs.data}

    user_ids = list({row["user_id"] for row in rows.data if row.get("user_id")})
    username_map = {}
    if user_ids:
        profiles = supabase.table("profiles").select("id, username, avatar_url").in_("id", user_ids).execute()
        username_map = {p["id"]: p for p in profiles.data}

    post_map = {row["id"]: row for row in rows.data}

    enriched_feed = []
    for item in final_feed_meta:
        post = post_map.get(item["post_id"])
        if not post:
            continue

        club = club_map.get(post.get("club_id"), {})
        profile = username_map.get(post.get("user_id"), {})

        enriched_feed.append({
            "id": post["id"],
            "ai_source": source_map[post["id"]],
            "title": post.get("title", ""),
            "content": post.get("content", ""),
            "image": post.get("image_url"),
            "likes": post.get("like_count", 0),
            "dislikes": post.get("dislike_count", 0),
            "commentCount": post.get("comment_count", 0),
            "created_at": post.get("created_at"),
            "time": post.get("created_at", ""),
            "clubName": club.get("name", "Unknown Club"),
            "clubSlug": club.get("slug", ""),
            "clubColor": "from-purple-600 to-indigo-700",
            "username": profile.get("username", "user"),
            "avatar_url": profile.get("avatar_url"),
        })

    return {
        "user_id": user_id,
        "feed_length": len(enriched_feed),
        "feed": enriched_feed
    }