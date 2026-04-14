import os
import time
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

CLIENT_ID = os.getenv("IGDB_CLIENT_ID")
CLIENT_SECRET = os.getenv("IGDB_CLIENT_SECRET")

print("IGDB_CLIENT_ID:", CLIENT_ID)
print("IGDB_CLIENT_SECRET:", "SET" if CLIENT_SECRET else "MISSING")

router = APIRouter(prefix="/v1/igdb")

token_cache = {
    "access_token": None,
    "expires_at": 0
}


async def get_igdb_token():
    now = time.time()

    if token_cache["access_token"] and token_cache["expires_at"] > now + 60:
        return token_cache["access_token"]

    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="IGDB credentials missing")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://id.twitch.tv/oauth2/token",
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


class IGDBQuery(BaseModel):
    endpoint: str
    query: str


@router.post("/")  # 🔥 FIXED (IMPORTANT)
async def igdb_proxy(payload: IGDBQuery):
    token = await get_igdb_token()

    endpoint = payload.endpoint.strip("/")

    # 🔥 FIXED: allow ALL endpoints used by frontend
    allowed_endpoints = [
        "games", "games/count", "game_reviews",
        "covers", "artworks", "screenshots",
        "genres", "platforms",
        "involved_companies", "companies", "websites"
    ]

    if endpoint not in allowed_endpoints:
        raise HTTPException(status_code=400, detail=f"Endpoint not allowed: {endpoint}")

    url = f"https://api.igdb.com/v4/{endpoint}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            headers={
                "Client-ID": CLIENT_ID,
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            },
            content=payload.query
        )

        if resp.status_code != 200:
            print(f"IGDB ERROR {resp.status_code}:", resp.text)
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

        return resp.json()