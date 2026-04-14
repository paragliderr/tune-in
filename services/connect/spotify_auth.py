"""
spotify_auth.py
Run this ONCE to get your Spotify refresh token.
After you get the refresh token, you won't need this script again.
"""

import requests
import webbrowser
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading


# CONFIGURATION  –  paste your credentials here

CLIENT_ID     = "YOUR_CLIENT_ID"
CLIENT_SECRET = "YOUR_CLIENT_SECRET"
REDIRECT_URI  = "http://localhost:8888/callback"
SCOPES        = "user-library-read playlist-read-private playlist-read-collaborative"


# STEP 1 — open browser for user to authorize

auth_url = (
    "https://accounts.spotify.com/authorize?"
    + urllib.parse.urlencode({
        "client_id":     CLIENT_ID,
        "response_type": "code",
        "redirect_uri":  REDIRECT_URI,
        "scope":         SCOPES,
    })
)

print("Opening Spotify authorization in your browser ...")
print("If it doesn't open, paste this URL manually:\n")
print(auth_url)
print()
webbrowser.open(auth_url)


# STEP 2 — catch the callback code automatically

auth_code = None

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Authorization successful! You can close this tab.")
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Authorization failed. Check your credentials.")

    def log_message(self, format, *args):
        pass  # suppress server logs

server = HTTPServer(("localhost", 8888), CallbackHandler)
print("Waiting for Spotify callback on http://localhost:8888/callback ...")
server.handle_request()  # handle one request then stop

if not auth_code:
    print("ERROR: Did not receive authorization code.")
    exit(1)

# STEP 3 — exchange code for refresh token
response = requests.post(
    "https://accounts.spotify.com/api/token",
    data={
        "grant_type":   "authorization_code",
        "code":         auth_code,
        "redirect_uri": REDIRECT_URI,
    },
    auth=(CLIENT_ID, CLIENT_SECRET),
)

token_data = response.json()

if "refresh_token" not in token_data:
    print("ERROR:", token_data)
    exit(1)

print("\n-- SPOTIFY TOKENS ")
print(f"  Access Token  : {token_data['access_token']}")
print(f"  Refresh Token : {token_data['refresh_token']}")
print("\nCopy the Refresh Token into spotify_data.py as REFRESH_TOKEN")
