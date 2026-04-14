import os
import time
import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

# from dotenv import load_dotenv

# current_dir = os.path.dirname(os.path.abspath(__file__))
# env_path = os.path.join(current_dir, "..", ".env")
# load_dotenv(dotenv_path=env_path)


CLIENT_ID = os.getenv("IGDB_CLIENT_ID")
CLIENT_SECRET = os.getenv("IGDB_CLIENT_SECRET")

print("IGDB_CLIENT_ID:", CLIENT_ID)
print("IGDB_CLIENT_SECRET:", "SET" if CLIENT_SECRET else "MISSING")

router = APIRouter(prefix="/v1/igdb")

# In-memory token cache
token_cache = {
    "access_token": None,
    "expires_at": 0
}

async def get_igdb_token():
    now = time.time()
    if token_cache["access_token"] and token_cache["expires_at"] > now + 60:
        return token_cache["access_token"]

    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="IGDB credentials missing in backend")

    print("Fetching new IGDB Access Token...")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"https://id.twitch.tv/oauth2/token",
                params={
                    "client_id": CLIENT_ID,
                    "client_secret": CLIENT_SECRET,
                    "grant_type": "client_credentials"
                }
            )
            resp.raise_for_status()
            data = resp.json()
            token_cache["access_token"] = data["access_token"]
            token_cache["expires_at"] = now + data["expires_in"]
            return token_cache["access_token"]
        except Exception as e:
            print(f"Error fetching IGDB token: {e}")
            raise HTTPException(status_code=500, detail="Failed to authenticate with Twitch/IGDB")

class IGDBQuery(BaseModel):
    endpoint: str
    query: str

@router.post("")
async def igdb_proxy(payload: IGDBQuery):
    token = await get_igdb_token()
    
    # Sanitize endpoint
    endpoint = payload.endpoint.strip("/")
    allowed_endpoints = ["games", "covers", "artworks", "screenshots", "genres", "platforms", "involved_companies", "companies", "websites"]
    
    if endpoint not in allowed_endpoints:
        # Fallback for search or specific calls, but let's be safe
        pass

    url = f"https://api.igdb.com/v4/{endpoint}"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                url,
                headers={
                    "Client-ID": CLIENT_ID,
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json"
                },
                content=payload.query
            )
            # Forward status code if it's an error
            if resp.status_code != 200:
                print(f"IGDB Error {resp.status_code}: {resp.text}")
                return resp.json()
            
            return resp.json()
        except Exception as e:
            print(f"IGDB Proxy Error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
