import os
from supabase import create_client
from dotenv import load_dotenv

# Use the absolute path to ensure we hit the right .env
load_dotenv(os.path.join(os.getcwd(), ".env"))

url = os.environ.get("SUPABASE_URL")
# Your .env uses SUPABASE_SERVICE_KEY
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print(f"Error: SUPABASE_URL ({url}) or SUPABASE_SERVICE_KEY ({key}) missing")
    exit(1)

supabase = create_client(url, key)

print(f"Connecting to: {url}")

try:
    # 1. Check for any data to find columns
    res = supabase.table("strava_stats").select("*").limit(1).execute()
    if len(res.data) > 0:
        print(f"\nSUCCESS! Columns found in strava_stats: {list(res.data[0].keys())}")
    else:
        print("\nTable 'strava_stats' is EMPTY. Trying to detect columns via dummy insert...")
        # (We skip actual insert to avoid side effects, but we can verify table existence)
        print("Table exists (Select worked).")
        
    # 2. Check for profiles table to see if user_id exists
    res_profiles = supabase.table("profiles").select("id, username").limit(5).execute()
    print(f"\nSample Profiles: {res_profiles.data}")

except Exception as e:
    print(f"\nError occurred: {e}")
