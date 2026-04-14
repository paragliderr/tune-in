import requests

res = requests.post("https://www.strava.com/oauth/token", data={
    "client_id":     "225004",
    "client_secret": "c101390750a746eb58ec38176b5954926b92beef",
    "code":          "ef400a8552e62157163adb6bf54924bdc5ba8a00",
    "grant_type":    "authorization_code"
})

data = res.json()

if "refresh_token" in data:
    print("Access Token :", data["access_token"])
    print("Refresh Token:", data["refresh_token"])
    print("Expires At   :", data["expires_at"])
else:
    print("Error:", data)
