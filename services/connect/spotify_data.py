import requests
from datetime import datetime


# CONFIGURATION  –  paste your credentials here
CLIENT_ID     = "YOUR_CLIENT_ID"
CLIENT_SECRET = "YOUR_CLIENT_SECRET"
REFRESH_TOKEN = "YOUR_REFRESH_TOKEN"   # from spotify_auth.py


# STEP 1 — get a fresh access token
def get_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """Exchange refresh token for a short-lived access token."""
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type":    "refresh_token",
            "refresh_token": refresh_token,
        },
        auth=(client_id, client_secret),
    )
    response.raise_for_status()
    token_data = response.json()

    if "access_token" not in token_data:
        raise ValueError(f"Token refresh failed: {token_data}")

    return token_data["access_token"]


# STEP 2 — fetch liked / saved songs
def fetch_liked_songs(access_token: str) -> list:
    """Return all saved/liked tracks from the user's library."""
    headers  = {"Authorization": f"Bearer {access_token}"}
    songs    = []
    url      = "https://api.spotify.com/v1/me/tracks?limit=50"

    while url:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise ConnectionError(f"Spotify API error: {response.text}")

        data = response.json()

        for item in data.get("items", []):
            track = item["track"]
            songs.append({
                "id":         track["id"],
                "name":       track["name"],
                "artist":     ", ".join(a["name"] for a in track["artists"]),
                "album":      track["album"]["name"],
                "added_at":   item["added_at"],
                "duration_ms": track["duration_ms"],
                "uri":        track["uri"],
            })

        url = data.get("next")   # None when no more pages

    return songs


# STEP 3 — fetch playlists + their tracks
def fetch_playlists(access_token: str) -> list:
    """Return all user playlists, each with their full track list."""
    headers   = {"Authorization": f"Bearer {access_token}"}
    playlists = []
    url       = "https://api.spotify.com/v1/me/playlists?limit=50"

    while url:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            raise ConnectionError(f"Spotify API error: {response.text}")

        data = response.json()

        for item in data.get("items", []):
            if item is None:
                continue

            tracks = fetch_playlist_tracks(access_token, item["id"])

            playlists.append({
                "id":          item["id"],
                "name":        item["name"],
                "description": item.get("description", ""),
                "public":      item.get("public", False),
                "track_count": item["tracks"]["total"],
                "tracks":      tracks,
            })

        url = data.get("next")

    return playlists


def fetch_playlist_tracks(access_token: str, playlist_id: str) -> list:
    """Return all tracks in a specific playlist."""
    headers = {"Authorization": f"Bearer {access_token}"}
    tracks  = []
    url     = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks?limit=100"

    while url:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            break   # skip playlists we can't read

        data = response.json()

        for item in data.get("items", []):
            track = item.get("track")
            if not track or track.get("type") != "track":
                continue   # skip episodes / null entries

            tracks.append({
                "id":          track["id"],
                "name":        track["name"],
                "artist":      ", ".join(a["name"] for a in track["artists"]),
                "album":       track["album"]["name"],
                "duration_ms": track["duration_ms"],
                "uri":         track["uri"],
            })

        url = data.get("next")

    return tracks


# MAIN  –  run the full pipeline
def main() -> dict:
    print("[1/4] Refreshing Spotify access token ...")
    access_token = get_access_token(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)

    print("[2/4] Fetching liked songs ...")
    liked_songs = fetch_liked_songs(access_token)
    print(f"      Found {len(liked_songs)} liked songs.")

    print("[3/4] Fetching playlists ...")
    playlists = fetch_playlists(access_token)
    print(f"      Found {len(playlists)} playlists.")

    print("[4/4] Building structured data ...")
    result = {
        "fetched_at":   datetime.utcnow().isoformat(),
        "liked_songs":  liked_songs,
        "playlists":    playlists,
        "summary": {
            "total_liked_songs": len(liked_songs),
            "total_playlists":   len(playlists),
            "total_playlist_tracks": sum(len(p["tracks"]) for p in playlists),
        }
    }

    print(f"  Liked Songs      : {result['summary']['total_liked_songs']}")
    print(f"  Playlists        : {result['summary']['total_playlists']}")
    print(f"  Playlist Tracks  : {result['summary']['total_playlist_tracks']}")

    return result   # import and call main() from Tune-In to get this dict


if __name__ == "__main__":
    main()
