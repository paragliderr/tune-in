import requests
from datetime import datetime, timezone, timedelta


class StravaService:
    def __init__(self, client_id, client_secret, refresh_token=None, code=None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token

        # 🔥 IMPORTANT: normalize empty string → None
        self.code = code if code else None

        self.access_token = None
        self.expires_at = None

    # =========================
    # TOKEN MANAGEMENT
    # =========================
    def _get_access_token(self):
        print("[STRAVA] Refreshing access token...")

        if not self.refresh_token:
            raise Exception("No refresh token available. Please authenticate first.")

        response = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
            },
        )

        response.raise_for_status()
        token_data = response.json()

        print("[DEBUG TOKEN - REFRESH]", token_data)

        self.access_token = token_data["access_token"]
        self.expires_at = token_data["expires_at"]

        if "refresh_token" in token_data:
            self.refresh_token = token_data["refresh_token"]

        return self.access_token

    def exchange_code(self):
        print("[STRAVA] Exchanging authorization code...")

        if not self.code:
            raise Exception("Authorization code not provided.")

        response = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "authorization_code",
                "code": self.code,
            },
        )

        response.raise_for_status()
        token_data = response.json()

        print("[DEBUG TOKEN - CODE]", token_data)

        self.access_token = token_data["access_token"]
        self.refresh_token = token_data["refresh_token"]
        self.expires_at = token_data["expires_at"]

        return token_data

    def _ensure_token(self):
        """
        Decide whether to:
        - Exchange code (first-time setup)
        - Refresh token (normal flow)
        """

        # ✅ ONLY run exchange_code if code exists AND no refresh_token yet
        if self.code and not self.refresh_token:
            self.exchange_code()
            self.code = None  # prevent reuse
            return

        # ✅ Normal flow
        now = datetime.now(timezone.utc).timestamp()

        if not self.access_token or not self.expires_at or now >= self.expires_at - 60:
            self._get_access_token()

    def _headers(self):
        self._ensure_token()
        return {"Authorization": f"Bearer {self.access_token}"}

    # =========================
    # SAFE REQUEST WRAPPER
    # =========================
    def _safe_get(self, url):
        response = requests.get(url, headers=self._headers())

        if response.status_code == 401:
            print("[STRAVA] 401 → refreshing token and retrying...")
            self._get_access_token()
            response = requests.get(url, headers=self._headers())

        response.raise_for_status()
        return response.json()

    # =========================
    # USER INFO
    # =========================
    def _get_username(self):
        data = self._safe_get("https://www.strava.com/api/v3/athlete")
        return f"{data.get('firstname', '')} {data.get('lastname', '')}".strip()

    # =========================
    # ACTIVITIES
    # =========================
    def fetch_activities(self, window="week"):
        now = datetime.now(timezone.utc)

        if window == "week":
            after = int((now - timedelta(days=7)).timestamp())
        elif window == "overall":
            after = 0
        else:
            after = int((now - timedelta(days=7)).timestamp())

        activities = []
        page = 1

        while True:
            url = f"https://www.strava.com/api/v3/athlete/activities?after={after}&page={page}&per_page=100"

            data = self._safe_get(url)

            if not data:
                break

            activities.extend(data)
            page += 1

        return activities

    # =========================
    # SCORING
    # =========================
    def calculate_score(self, activities):
        total_dist_km = 0
        total_elev_m = 0
        total_time_hrs = 0
        score = 0

        WEIGHTS = {
            "Run": 10,
            "Ride": 2,
            "Swim": 40,
            "Walk": 5,
            "Hike": 8,
            "Yoga": 15,
            "Workout": 20,
        }

        for activity in activities:
            dist_km = activity.get("distance", 0) / 1000
            elev_m = activity.get("total_elevation_gain", 0)
            time_hrs = activity.get("moving_time", 0) / 3600
            act_type = activity.get("type", "Workout")

            total_dist_km += dist_km
            total_elev_m += elev_m
            total_time_hrs += time_hrs

            points = dist_km * WEIGHTS.get(act_type, 1)
            points += elev_m / 10

            if dist_km == 0:
                points += time_hrs * WEIGHTS.get(act_type, 10)

            score += points

        return {
            "total_distance_km": round(total_dist_km, 2),
            "total_elevation_m": round(total_elev_m, 1),
            "total_moving_time_hrs": round(total_time_hrs, 1),
            "score": round(score, 1),
            "count": len(activities),
        }

    # =========================
    # MAIN
    # =========================
    def get_user_data(self):
        print("[STRAVA] Starting full sync...")

        username = self._get_username()
        all_activities = self.fetch_activities(window="overall")

        categorized = {}
        for act in all_activities:
            categorized.setdefault(act.get("type", "Other"), []).append(act)

        summary = {}
        for a_type, acts in categorized.items():
            stats = self.calculate_score(acts)
            summary[a_type] = {
                "count": stats["count"],
                "distance_km": stats["total_distance_km"],
                "elevation_m": stats["total_elevation_m"],
            }

        weekly_activities = self.fetch_activities(window="week")

        return {
            "username": username,
            "weekly": self.calculate_score(weekly_activities),
            "overall": self.calculate_score(all_activities),
            "categorized": categorized,
            "summary": summary,
            "refresh_token": self.refresh_token,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }