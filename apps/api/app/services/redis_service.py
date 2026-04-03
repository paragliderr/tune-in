import os
from upstash_redis import Redis
from dotenv import load_dotenv

load_dotenv()
redis_client = Redis(
    url=os.getenv("UPSTASH_REDIS_REST_URL"),
    token=os.getenv("UPSTASH_REDIS_REST_TOKEN")
)

def track_user_interaction(user_id: str, post_id: str, interaction_type: str = "like"):
    """
    Pushes a post ID to the front of the user's recent interactions list in Redis.
    Caps the list at 50 to save memory and keep the "mood" current.
    """
    redis_key = f"user:{user_id}:recent_{interaction_type}s"

    redis_client.lpush(redis_key, post_id)

    redis_client.ltrim(redis_key, 0, 49)
    
    return True

def get_recent_interactions(user_id: str, interaction_type: str = "like") -> list[str]:
    """Retrieves the list of recent post IDs the user interacted with."""
    redis_key = f"user:{user_id}:recent_{interaction_type}s"
  
    return redis_client.lrange(redis_key, 0, -1)