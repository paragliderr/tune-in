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
# HELPERS
# =========================

def enrich_posts(raw_posts: list, source_map: dict) -> list:
    """
    Given raw post rows from Supabase, attach:
      - username + avatar from profiles table  (keyed by user_id)
      - clubName + clubSlug + clubColor        (keyed by club_id)
      - ai_source label from source_map        (keyed by post id)
    Returns a list of dicts ready for the frontend.
    """
    if not raw_posts:
        return []

    # --- collect unique ids to batch-fetch ---
    user_ids = list({p["user_id"] for p in raw_posts if p.get("user_id")})
    club_ids = list({p["club_id"] for p in raw_posts if p.get("club_id")})

    # --- fetch profiles ---
    profiles_map = {}
    try:
        if user_ids:
            res = supabase.table("profiles") \
                .select("id, username, avatar_url") \
                .in_("id", user_ids) \
                .execute()
            profiles_map = {r["id"]: r for r in (res.data or [])}
    except Exception as e:
        print("[WARN] profiles fetch failed:", e)

    # --- fetch clubs ---
    clubs_map = {}
    try:
        if club_ids:
            # ✅ FIX: removed "color" column (does not exist in DB)
            res = supabase.table("clubs") \
                .select("id, name, slug") \
                .in_("id", club_ids) \
                .execute()
            clubs_map = {r["id"]: r for r in (res.data or [])}
    except Exception as e:
        print("[WARN] clubs fetch failed:", e)

    # --- merge ---
    enriched = []
    for p in raw_posts:
        profile = profiles_map.get(p.get("user_id"), {})
        club    = clubs_map.get(p.get("club_id"), {})

        enriched.append({
            # core post fields
            "id":           p.get("id"),
            "title":        p.get("title", ""),
            "content":      p.get("content", ""),
            "image":        p.get("image_url"),          # frontend expects "image"
            "time":         p.get("created_at"),         # frontend expects "time"
            "likes":        p.get("likes", 0),
            "dislikes":     p.get("dislikes", 0),
            "commentCount": p.get("comment_count", 0),

            # user info
            "username":     profile.get("username") or "user",
            "avatar_url":   profile.get("avatar_url"),

            # club info
            "clubName":     club.get("name")  or "Unknown Club",
            "clubSlug":     club.get("slug")  or "",
            "clubColor":    club.get("color") or "from-purple-600 to-indigo-700",

            # AI feed label — "exploit" (trending) or "explore" (for you)
            "ai_source":    source_map.get(p.get("id"), "explore"),
        })

    return enriched


# =========================
# ROUTE
# =========================

@router.get("/feed/{user_id}")
def generate_blended_feed(user_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not initialized")

    print(f"Generating Blended Feed for User: {user_id}")

    # ---- exploit (trending / redis) ----
    exploit_ids = []
    if redis_client:
        try:
            exploit_ids = redis_client.lrange(f"exploit_feed:{user_id}", 0, POSTS_PER_ENGINE - 1)
            if not exploit_ids:
                exploit_ids = redis_client.lrange("global_trending", 0, POSTS_PER_ENGINE - 1)
        except Exception as e:
            print(f"[WARN] Redis error: {e}")

    # ---- explore (vector similarity) ----
    explore_ids = []
    try:
        user_data = supabase.table("profiles") \
            .select("explore_embedding") \
            .eq("id", user_id) \
            .execute()
        if user_data.data and user_data.data[0].get("explore_embedding"):
            user_vector = user_data.data[0]["explore_embedding"]
            matches = supabase.rpc("match_explore_posts", {
                "query_embedding": user_vector,
                "match_limit": POSTS_PER_ENGINE,
            }).execute()
            explore_ids = [m["id"] for m in (matches.data or [])]
    except Exception as e:
        print("Explore error:", e)

    # ---- fallback: recent posts ----
    if not exploit_ids and not explore_ids:
        recent = supabase.table("posts") \
            .select("id") \
            .order("created_at", desc=True) \
            .limit(NUM_POSTS) \
            .execute()
        final_feed_meta = [{"post_id": r["id"], "source": "explore"} for r in (recent.data or [])]
    else:
        final_feed_meta = []
        seen = set()
        for i in range(max(len(exploit_ids), len(explore_ids))):
            if i < len(exploit_ids):
                pid = exploit_ids[i]
                if pid not in seen:
                    final_feed_meta.append({"post_id": pid, "source": "exploit"})
                    seen.add(pid)
            if i < len(explore_ids):
                pid = explore_ids[i]
                if pid not in seen:
                    final_feed_meta.append({"post_id": pid, "source": "explore"})
                    seen.add(pid)
            if len(final_feed_meta) >= NUM_POSTS:
                break

    if not final_feed_meta:
        return {"user_id": user_id, "feed_length": 0, "feed": []}

    # ---- fetch full post rows ----
    post_ids   = [p["post_id"] for p in final_feed_meta]
    source_map = {p["post_id"]: p["source"] for p in final_feed_meta}

    rows = supabase.table("posts") \
        .select("*") \
        .in_("id", post_ids) \
        .execute()

    # ---- enrich with profile + club data ----
    enriched = enrich_posts(rows.data or [], source_map)

    return {
        "user_id":     user_id,
        "feed_length": len(enriched),
        "feed":        enriched,
    }