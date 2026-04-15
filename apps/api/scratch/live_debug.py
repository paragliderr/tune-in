import os
from dotenv import load_dotenv
from supabase import create_client
from services.strava_service import StravaService

load_dotenv()

def run_debug_sync():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)

    print("--- Fetching a token to test ---")
    res = supabase.table("strava_tokens").select("*").limit(1).execute()
    if not res.data:
        print("No tokens found in strava_tokens. Please link Strava first.")
        return

    token = res.data[0]
    user_id = token["user_id"]
    print(f"Testing for user_id: {user_id}")

    try:
        print("\n[STEP 1] Initializing StravaService...")
        strava = StravaService(token["client_id"], token["client_secret"], token["refresh_token"])
        
        print("[STEP 2] Fetching User Data from Strava API...")
        data = strava.get_user_data()
        print(f"  - Username: {data['username']}")
        print(f"  - Weekly Score: {data['weekly']['score']}")

        print("[STEP 3] Updating Profiles Table...")
        profile_res = supabase.table("profiles").select("connections").eq("id", user_id).single().execute()
        connections = profile_res.data.get("connections", {}) or {}
        connections["strava"] = data["username"]
        supabase.table("profiles").update({"connections": connections}).eq("id", user_id).execute()
        print("  - Profile Updated!")

        print("[STEP 4] Upserting to strava_stats...")
        stats_entry = {
            "user_id": user_id,
            "username": data["username"],
            "total_distance_km": data["overall"]["total_distance_km"],
            "total_elevation_m": data["overall"]["total_elevation_m"],
            "total_moving_time_hrs": data["overall"]["total_moving_time_hrs"],
            "score": data["weekly"]["score"],
            "raw_data": data,
            "updated_at": data["fetched_at"]
        }
        print(f"  - Payload: {stats_entry.keys()}")
        db_res = supabase.table("strava_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print("  - Stats Upserted!")
        print("\n[OK] FULL SYNC SUCCESSFUL!")

    except Exception as e:
        print(f"\n[CRASH] Error during sync: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_debug_sync()
