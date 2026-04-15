import requests
import os
from datetime import datetime, timezone, timedelta

class StravaService:
    def __init__(self, client_id, client_secret, refresh_token):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.access_token = None
        self.expires_at = None
        self._cached_headers = None

    def _get_access_token(self):
        """Exchange a refresh token for a short-lived access token."""
        print(f"[STRAVA_SERVICE] Refreshing access token...")
        response = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id":     self.client_id,
                "client_secret": self.client_secret,
                "grant_type":    "refresh_token",
                "refresh_token": self.refresh_token,
            },
        )
        response.raise_for_status()
        token_data = response.json()
        self.access_token = token_data["access_token"]
        self.expires_at = token_data["expires_at"] # Epoch time
        return self.access_token

    def exchange_code(self, code):
        """Exchange initial authorization code for tokens."""
        print(f"[STRAVA_SERVICE] Exchanging authorization code...")
        response = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id":     self.client_id,
                "client_secret": self.client_secret,
                "grant_type":    "authorization_code",
                "code":          code,
            },
        )
        response.raise_for_status()
        token_data = response.json()
        self.access_token = token_data["access_token"]
        self.refresh_token = token_data["refresh_token"]
        self.expires_at = token_data["expires_at"]
        return token_data

    def _headers(self):
        if self._cached_headers:
            return self._cached_headers
            
        token = self._get_access_token()
        self._cached_headers = {"Authorization": f"Bearer {token}"}
        return self._cached_headers

    def _get_username(self):
        """Get athlete profile."""
        response = requests.get("https://www.strava.com/api/v3/athlete", headers=self._headers())
        response.raise_for_status()
        data = response.json()
        return f"{data.get('firstname', '')} {data.get('lastname', '')}".strip()

    def fetch_activities(self, window="week"):
        """Fetch activities within the time window."""
        now = datetime.now(timezone.utc)
        
        if window == "week":
            after = int((now - timedelta(days=7)).timestamp())
        elif window == "overall":
            after = int((now - timedelta(days=365)).timestamp())
        else:
            after = int((now - timedelta(days=7)).timestamp())

        activities = []
        page = 1
        while True:
            url = f"https://www.strava.com/api/v3/athlete/activities?after={after}&page={page}&per_page=100"
            response = requests.get(url, headers=self._headers())
            response.raise_for_status()
            data = response.json()
            if not data:
                break
            activities.extend(data)
            page += 1
        
        return activities

    def calculate_score(self, activities):
        """Calculate score based on distance and type."""
        total_dist_km = 0
        total_elev_m = 0
        total_time_hrs = 0
        score = 0

        # Scoring Weights
        WEIGHTS = {
            "Run": 10,     # per km
            "Ride": 2,     # per km
            "Swim": 40,    # per km
            "Walk": 5,     # per km
            "Hike": 8,     # per km
            "Yoga": 15,    # per hour
            "Workout": 20, # per hour
        }

        for activity in activities:
            dist_km = activity.get("distance", 0) / 1000
            elev_m = activity.get("total_elevation_gain", 0)
            time_hrs = activity.get("moving_time", 0) / 3600
            act_type = activity.get("type", "Workout")

            total_dist_km += dist_km
            total_elev_m += elev_m
            total_time_hrs += time_hrs

            # Distance Score
            points = dist_km * WEIGHTS.get(act_type, 1)
            # Elevation Bonus (1 pt per 10m)
            points += elev_m / 10
            # Time Bonus for non-distance sports (Yoga etc)
            if dist_km == 0:
                points += time_hrs * WEIGHTS.get(act_type, 10)

            score += points

        return {
            "total_distance_km": round(total_dist_km, 2),
            "total_elevation_m": round(total_elev_m, 1),
            "total_moving_time_hrs": round(total_time_hrs, 1),
            "score": round(score, 1),
            "count": len(activities)
        }

    def get_user_data(self):
        """Fetch both weekly and overall stats with comprehensive categorization."""
        username = self._get_username()
        
        all_activities = self.fetch_activities(window="overall")
        
        # Categorize activities by type (Spotify-style)
        categorized = {}
        for act in all_activities:
            a_type = act.get("type", "Other")
            if a_type not in categorized:
                categorized[a_type] = []
            categorized[a_type].append(act)

        # Build sport-specific summaries
        summary = {}
        for a_type, acts in categorized.items():
            stats = self.calculate_score(acts)
            summary[a_type] = {
                "count": stats["count"],
                "distance_km": stats["total_distance_km"],
                "elevation_m": stats["total_elevation_m"]
            }

        # Original score logic (for global ranking)
        weekly_activities = self.fetch_activities(window="week")
        scores = self.calculate_score(weekly_activities)
        overall_scores = self.calculate_score(all_activities)

        return {
            "username": username,
            "weekly": scores,
            "overall": overall_scores,
            "categorized": categorized,
            "summary": summary,
            "fetched_at": datetime.now(timezone.utc).isoformat()
        }
