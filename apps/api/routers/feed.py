import os
from fastapi import APIRouter, HTTPException
from supabase import create_client
from upstash_redis import Redis
from dotenv import load_dotenv

load_dotenv()

print("🔥 FEED ROUTER LOADING...")

router = APIRouter(prefix="/v1")

NUM_POSTS = 20
POSTS_PER_ENGINE = 15

# =========================
# SAFE INITIALIZATION
# =========================

supabase = None
try:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Missing Supabase env")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase connected (feed)")
except Exception as e:
    print("❌ Supabase init failed:", e)

redis_client = None
try:
    redis_client = Redis.from_env()
    redis_client.ping()
    print("✅ Redis connected")
except Exception as e:
    print(f"[WARN] Redis unavailable: {e}")

print("🔥 FEED ROUTER READY")

# =========================
# ROUTE
# =========================

@router.get("/feed/{user_id}")
def generate_blended_feed(user_id: str):

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    print(f"Generating Feed for {user_id}")

    exploit_posts = []
    if redis_client:
        try:
            exploit_posts = redis_client.lrange(f"exploit_feed:{user_id}", 0, POSTS_PER_ENGINE - 1)
            if not exploit_posts:
                exploit_posts = redis_client.lrange("global_trending", 0, POSTS_PER_ENGINE - 1)
        except Exception as e:
            print(f"[WARN] Redis error: {e}")

    explore_posts = []
    try:
        user_data = supabase.table("profiles").select("explore_embedding").eq("id", user_id).execute()

        if user_data.data and user_data.data[0].get("explore_embedding"):
            user_vector = user_data.data[0]["explore_embedding"]

            matches = supabase.rpc("match_explore_posts", {
                "query_embedding": user_vector,
                "match_limit": POSTS_PER_ENGINE
            }).execute()

            explore_posts = [m["id"] for m in matches.data]
    except Exception as e:
        print("Explore error:", e)

    # fallback
    if not exploit_posts and not explore_posts:
        recent = supabase.table("posts").select("id").order("created_at", desc=True).limit(NUM_POSTS).execute()
        final_feed_meta = [{"post_id": r["id"], "source": "explore"} for r in recent.data]
    else:
        final_feed_meta = []
        seen = set()

        for i in range(max(len(exploit_posts), len(explore_posts))):
            if i < len(exploit_posts):
                p = exploit_posts[i]
                if p not in seen:
                    final_feed_meta.append({"post_id": p, "source": "exploit"})
                    seen.add(p)

            if i < len(explore_posts):
                p = explore_posts[i]
                if p not in seen:
                    final_feed_meta.append({"post_id": p, "source": "explore"})
                    seen.add(p)

            if len(final_feed_meta) >= NUM_POSTS:
                break

    if not final_feed_meta:
        return {"user_id": user_id, "feed": []}

    post_ids = [p["post_id"] for p in final_feed_meta]

    rows = supabase.table("posts").select("*").in_("id", post_ids).execute()

    return {
        "user_id": user_id,
        "feed_length": len(rows.data),
        "feed": rows.data
    }