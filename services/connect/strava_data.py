"""
strava_data.py
Fetches today's running activity from Strava and returns structured data.
Used by the Tune-In project.
"""

import requests
from datetime import datetime, timezone



# CONFIGURATION

CLIENT_ID     = "225004"
CLIENT_SECRET = "c101390750a746eb58ec38176b5954926b92beef"
REFRESH_TOKEN = "f40ff68986e1a61751aae96a17a52dfe4add2726"



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

    if "access_token" not in token_data:
        raise ValueError(f"Token exchange failed: {token_data}")

    return token_data["access_token"]



# STEP 2 — fetch all activities from Strava

def fetch_all_activities(access_token: str) -> list:
    """Page through the athlete's activity feed and return every activity."""
    headers    = {"Authorization": f"Bearer {access_token}"}
    activities = []
    page       = 1

    while True:
        response = requests.get(
            f"https://www.strava.com/api/v3/athlete/activities?page={page}&per_page=30",
            headers=headers,
        )

        if response.status_code != 200:
            raise ConnectionError(f"Strava API error: {response.text}")

        data = response.json()
        if not data:
            break                   # no more pages

        activities.extend(data)
        page += 1

    return activities



# STEP 3 — summarise today's runs

def get_todays_run_summary(activities: list) -> dict:
    """Filter to today's runs and return distance, time, and pace."""
    today          = datetime.now(timezone.utc).date()
    total_distance = 0   # metres
    total_time     = 0   # seconds

    for activity in activities:
        activity_date = datetime.strptime(
            activity["start_date"], "%Y-%m-%dT%H:%M:%SZ"
        ).date()

        if activity_date == today and activity["type"] == "Run":
            total_distance += activity["distance"]
            total_time     += activity["moving_time"]

    distance_km = total_distance / 1000
    time_min    = total_time / 60
    pace        = (time_min / distance_km) if distance_km > 0 else 0

    return {
        "date":          str(today),
        "distance_km":   round(distance_km, 2),
        "time_min":      round(time_min, 2),
        "avg_pace":      round(pace, 2),        # min / km
        "activity_type": "run",
    }



# MAIN  –  run the full pipeline

def main() -> dict:
    print("[1/3] Refreshing access token ...")
    access_token = get_access_token(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

    print("[2/3] Fetching activities from Strava ...")
    activities = fetch_all_activities(access_token)
    print(f"      Retrieved {len(activities)} activities total.")

    print("[3/3] Summarising today's runs ...")
    summary = get_todays_run_summary(activities)

    print("\nTODAY'S SUMMARY")
    print(f"Date        : {summary['date']}")
    print(f"Distance    : {summary['distance_km']} km")
    print(f"Time        : {summary['time_min']} min")
    print(f"Avg Pace    : {summary['avg_pace']} min/km")

    return summary   # import and call main() from Tune-In to get this dict


if __name__ == "__main__":
    main()
