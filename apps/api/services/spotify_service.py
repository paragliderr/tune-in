import requests
from datetime import datetime, timezone


class SpotifyService:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str):
        self.client_id = client_id.strip() if client_id else ""
        self.client_secret = client_secret.strip() if client_secret else ""
        self.refresh_token = refresh_token.strip() if refresh_token else ""
        self._access_token = None
        self._cached_headers = None

    def _get_access_token(self) -> str:
        """Exchange refresh token for a short-lived access token."""
        response = requests.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
            },
            auth=(self.client_id, self.client_secret),
        )
        response.raise_for_status()
        token_data = response.json()

        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError(f"Token refresh failed: {token_data}")

        self._access_token = access_token
        return access_token

    def _headers(self) -> dict:
        if self._cached_headers:
            return self._cached_headers

        token = self._access_token or self._get_access_token()
        self._cached_headers = {"Authorization": f"Bearer {token}"}
        return self._cached_headers

    def fetch_liked_songs(self) -> list:
        """Return all saved/liked tracks from the user's library."""
        songs = []
        url = "https://api.spotify.com/v1/me/tracks?limit=50"

        while url:
            response = requests.get(url, headers=self._headers())
            if response.status_code != 200:
                raise ConnectionError(f"Spotify API error: {response.text}")

            data = response.json()
            for item in data.get("items", []):
                track = item["track"]
                songs.append(
                    {
                        "id": track["id"],
                        "name": track["name"],
                        "artist": ", ".join(a["name"] for a in track["artists"]),
                        "album": track["album"]["name"],
                        "added_at": item["added_at"],
                        "duration_ms": track["duration_ms"],
                        "uri": track["uri"],
                    }
                )

            url = data.get("next")

        return songs

    def fetch_playlist_tracks(self, playlist_id: str) -> list:
        """Return all tracks in a specific playlist."""
        tracks = []
        url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit=100"

        while url:
            response = requests.get(url, headers=self._headers())
            if response.status_code != 200:
                break

            data = response.json()
            for item in data.get("items", []):
                track = item.get("track")
                if not track or track.get("type") != "track":
                    continue

                tracks.append(
                    {
                        "id": track["id"],
                        "name": track["name"],
                        "artist": ", ".join(a["name"] for a in track["artists"]),
                        "album": track["album"]["name"],
                        "duration_ms": track["duration_ms"],
                        "uri": track["uri"],
                    }
                )

            url = data.get("next")

        return tracks

    def fetch_playlists(self) -> list:
        """Return all user playlists, each with their full track list."""
        playlists = []
        url = "https://api.spotify.com/v1/me/playlists?limit=50"

        while url:
            response = requests.get(url, headers=self._headers())
            if response.status_code != 200:
                raise ConnectionError(f"Spotify API error: {response.text}")

            data = response.json()
            for item in data.get("items", []):
                if item is None:
                    continue

                tracks = self.fetch_playlist_tracks(item["id"])
                playlists.append(
                    {
                        "id": item["id"],
                        "name": item["name"],
                        "description": item.get("description", ""),
                        "public": item.get("public", False),
                        "track_count": item["tracks"]["total"],
                        "tracks": tracks,
                    }
                )

            url = data.get("next")

        return playlists

    def get_user_data(self) -> dict:
        liked_songs = self.fetch_liked_songs()
        playlists = self.fetch_playlists()

        return {
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "liked_songs": liked_songs,
            "playlists": playlists,
            "summary": {
                "total_liked_songs": len(liked_songs),
                "total_playlists": len(playlists),
                "total_playlist_tracks": sum(len(p["tracks"]) for p in playlists),
            },
        }
