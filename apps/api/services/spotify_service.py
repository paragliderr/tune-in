import requests
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


class SpotifyService:
    BASE_URL = "https://api.spotify.com/v1"
    TOKEN_URL = "https://accounts.spotify.com/api/token"

    def __init__(self, client_id: str, client_secret: str, refresh_token: str):
        self.client_id = client_id.strip()
        self.client_secret = client_secret.strip()
        self.refresh_token = refresh_token.strip()
        self._access_token = None

    # =========================
    # AUTH
    # =========================
    def _refresh_access_token(self):
        res = requests.post(
            self.TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
            },
            auth=(self.client_id, self.client_secret),
        )

        if res.status_code != 200:
            raise Exception(f"Token refresh failed: {res.text}")

        data = res.json()
        self._access_token = data["access_token"]

        # handle refresh token rotation
        if "refresh_token" in data:
            self.refresh_token = data["refresh_token"]

    def _get_headers(self):
        if not self._access_token:
            self._refresh_access_token()
        return {"Authorization": f"Bearer {self._access_token}"}

    def _request(self, method, endpoint, params=None):
        url = endpoint if endpoint.startswith("http") else f"{self.BASE_URL}/{endpoint}"

        res = requests.request(method, url, headers=self._get_headers(), params=params)

        # Handle expired token
        if res.status_code == 401:
            self._refresh_access_token()
            res = requests.request(method, url, headers=self._get_headers(), params=params)

        # Handle rate limit
        if res.status_code == 429:
            retry_after = int(res.headers.get("Retry-After", 1))
            time.sleep(retry_after)
            return self._request(method, endpoint, params)

        if res.status_code not in [200, 201]:
            raise Exception(f"Spotify API Error {res.status_code}: {res.text}")

        return res.json()

    # =========================
    # PAGINATION HELPER
    # =========================
    def _get_all_items(self, endpoint, key="items", limit=50):
        items = []
        url = f"{self.BASE_URL}/{endpoint}?limit={limit}"

        while url:
            data = self._request("GET", url)
            items.extend(data.get(key, []))
            url = data.get("next")

        return items

    # =========================
    # USER DATA
    # =========================
    def fetch_profile(self):
        return self._request("GET", "me")

    def fetch_currently_playing(self):
        try:
            data = self._request("GET", "me/player/currently-playing")
            if not data or not data.get("item"):
                return None

            track = data["item"]
            return {
                "name": track["name"],
                "artist": ", ".join(a["name"] for a in track["artists"]),
                "is_playing": data.get("is_playing"),
                "progress_ms": data.get("progress_ms"),
            }
        except:
            return None

    def fetch_recent_tracks(self):
        data = self._request("GET", "me/player/recently-played", {"limit": 50})
        return data.get("items", [])

    def fetch_top_tracks(self):
        return self._request("GET", "me/top/tracks", {"limit": 50}).get("items", [])

    def fetch_top_artists(self):
        return self._request("GET", "me/top/artists", {"limit": 50}).get("items", [])

    def fetch_saved_tracks_count(self):
        data = self._request("GET", "me/tracks", {"limit": 1})
        return data.get("total", 0)

    def fetch_playlists(self):
        return self._get_all_items("me/playlists")

    def fetch_followed_artists(self):
        data = self._request("GET", "me/following", {"type": "artist"})
        return data.get("artists", {}).get("items", [])

    def fetch_audio_features(self, track_ids: List[str]):
        if not track_ids:
            return []

        ids = ",".join(track_ids[:100])
        data = self._request("GET", "audio-features", {"ids": ids})
        return data.get("audio_features", [])

    # =========================
    # MAIN WRAPPER
    # =========================
    def get_user_data(self):
        profile = self.fetch_profile()
        top_tracks = self.fetch_top_tracks()
        top_artists = self.fetch_top_artists()
        playlists = self.fetch_playlists()
        currently_playing = self.fetch_currently_playing()

        saved_tracks = self.fetch_saved_tracks_count()

        # vibe calculation
        top_ids = [t["id"] for t in top_tracks[:20]]
        features = self.fetch_audio_features(top_ids)

        vibe = {}
        if features:
            metrics = ["danceability", "energy", "valence"]
            vibe = {
                m: round(sum(f[m] for f in features if f) / len(features), 2)
                for m in metrics
            }

        return {
            "username": profile.get("display_name"),
            "followers": profile.get("followers", {}).get("total"),
            "product": profile.get("product"),

            "stats": {
                "saved_tracks": saved_tracks,
                "playlist_count": len(playlists),
                "top_artist_count": len(top_artists),
                "top_track_count": len(top_tracks),
                "vibe": vibe,
            },

            "currently_playing": currently_playing,
            "top_tracks": top_tracks[:10],
            "top_artists": top_artists[:10],
            "playlists": [{"name": p["name"], "tracks": p["tracks"]["total"]} for p in playlists[:10]],

            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }