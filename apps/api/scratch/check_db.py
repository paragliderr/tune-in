import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def check_strava_stats():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)

    print("--- Checking strava_stats table ---")
    try:
        # Try to fetch one row to see columns
        res = supabase.table("strava_stats").select("*").limit(1).execute()
        if res.data:
            print("Found existing data. Columns:", res.data[0].keys())
        else:
            print("Table exists but is empty.")
    except Exception as e:
        print(f"Error checking table: {e}")

    print("\n--- Checking strava_tokens table ---")
    try:
        res = supabase.table("strava_tokens").select("*").limit(1).execute()
        if res.data:
            print("Found tokens. Columns:", res.data[0].keys())
        else:
            print("No tokens found in strava_tokens.")
    except Exception as e:
        print(f"Error checking tokens: {e}")

if __name__ == "__main__":
    check_strava_stats()
