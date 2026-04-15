"""
strava_data.py
Fetches athletic data from Strava and syncs it to Supabase.
Stores both calculated "Good Data" and full "Raw Data".
"""

import requests
import os
from datetime import datetime, timezone, timedelta
from supabase import create_client
from dotenv import load_dotenv

# Load credentials from .env - specifically targeting the apps/api folder
load_dotenv(os.path.join(os.getcwd(), "apps", "api", ".env"))

# CONFIGURATION
# Your Strava API credentials
CLIENT_ID     = "225004"
CLIENT_SECRET = "c101390750a746eb58ec38176b5954926b92beef"
REFRESH_TOKEN = "f40ff68986e1a61751aae96a17a52dfe4add2726"

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

# Create Supabase client
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("[WARNING] Supabase credentials missing. Will only print to console.")
    supabase = None

# STEP 1 — get a fresh access token
def get_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """Exchange a refresh token for a short-lived access token."""
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id":     client_id,
            "client_secret": client_secret,
            "grant_type":    "refresh_token",
            "refresh_token": refresh_token,
        },
    )
    response.raise_for_status()
    token_data = response.json()
    return token_data["access_token"]

# STEP 2 — fetch all activities from Strava
def fetch_all_activities(access_token: str, window_days: int = 365) -> list:
    """Fetch activities within the time window."""
    headers    = {"Authorization": f"Bearer {access_token}"}
    activities = []
    page       = 1
    after = int((datetime.now(timezone.utc) - timedelta(days=window_days)).timestamp())

    while True:
        url = f"https://www.strava.com/api/v3/athlete/activities?after={after}&page={page}&per_page=100"
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"      [API ERROR] Status {response.status_code}: {response.text}")
            break
            
        data = response.json()
        if not data:
            if page == 1:
                print(f"      [DEBUG] No activities found in the last {window_days} days.")
            break
        activities.extend(data)
        page += 1
    return activities

# STEP 3 — Calculate Stats ("Good Data") with Categorization
def calculate_metrics(activities: list):
    """Calculate scores and categorized totals from raw activities."""
    categorized = {}
    
    now = datetime.now(timezone.utc).date()
    week_ago = now - timedelta(days=7)

    # Group activities by type
    for act in activities:
        a_type = act.get("type", "Other")
        if a_type not in categorized:
            categorized[a_type] = []
        categorized[a_type].append(act)

    # Build summaries per sport
    summary = {}
    total_weekly_score = 0
    
    for a_type, acts in categorized.items():
        type_dist = sum(a.get("distance", 0) for a in acts) / 1000
        type_elev = sum(a.get("total_elevation_gain", 0) for a in acts)
        type_time = sum(a.get("moving_time", 0) for a in acts) / 3600
        
        # Weekly slice for scoring
        weekly_acts = [a for a in acts if datetime.strptime(a["start_date"], "%Y-%m-%dT%H:%M:%SZ").date() >= week_ago]
        weekly_dist = sum(a.get("distance", 0) for a in weekly_acts) / 1000
        
        summary[a_type] = {
            "count": len(acts),
            "total_distance_km": round(type_dist, 2),
            "total_elevation_m": round(type_elev, 1),
            "total_moving_time_hrs": round(type_time, 1),
            "weekly_distance_km": round(weekly_dist, 2)
        }
        
        # Simple scoring logic
        total_weekly_score += (weekly_dist * 10)

    return {
        "weekly_score": round(total_weekly_score, 1),
        "overall_score": round(sum(s["total_distance_km"] for s in summary.values()) * 2, 1),
        "categories": summary,
        "activity_count": len(activities)
    }

# STEP 4 — Upload to Supabase
def upload_to_supabase(user_id: str, username: str, metrics: dict, raw_activities: list):
    if not supabase:
        return

    print(f"[4/4] Uploading to Supabase for @{username}...")
    stats_entry = {
        "user_id": user_id,
        "username": username,
        "total_distance_km": sum(s["total_distance_km"] for s in metrics["categories"].values()),
        "total_elevation_m": sum(s["total_elevation_m"] for s in metrics["categories"].values()),
        "total_moving_time_hrs": sum(s["total_moving_time_hrs"] for s in metrics["categories"].values()),
        "score": metrics["weekly_score"],
        "raw_data": { 
            "categorized": metrics["categories"],
            "raw_activities": raw_activities,
            "fetched_at": datetime.now(timezone.utc).isoformat()
        },
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        supabase.table("strava_stats").upsert(stats_entry, on_conflict="user_id").execute()
        print("      SUCCESS: Data and Raw JSON saved to Supabase.")
    except Exception as e:
        print(f"      FAILED: {e}")

# MAIN
def main(user_id: str = None):
    # If no user_id, try to find the first profile
    if not user_id and supabase:
        res = supabase.table("profiles").select("id, username").limit(1).execute()
        if res.data:
            user_id = res.data[0]["id"]
            username = res.data[0]["username"] or "unknown"
            print(f"Targeting profile: @{username} ({user_id})")
        else:
            print("No profiles found in database.")
            return

    print("[1/4] Refreshing access token ...")
    access_token = get_access_token(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

    print("[2/4] Fetching raw activities from Strava ...")
    activities = fetch_all_activities(access_token)
    print(f"      Retrieved {len(activities)} activities total.")

    print("[3/4] Calculating metrics ...")
    metrics = calculate_metrics(activities)
    
    print("\nSYNC SUMMARY")
    if not metrics["categories"]:
        print("      No activities recorded.")
    else:
        for sport, stats in metrics["categories"].items():
            print(f"  [{sport}]")
            print(f"      Distance    : {stats['total_distance_km']} km")
            print(f"      Count       : {stats['count']} activities")
    
    print(f"\nWeekly Score : {metrics['weekly_score']} pts")
    print(f"Overall Score: {metrics['overall_score']} pts")

    if supabase:
        upload_to_supabase(user_id, username, metrics, activities)

if __name__ == "__main__":
    # You can pass a specific user_id here if needed
    main()
