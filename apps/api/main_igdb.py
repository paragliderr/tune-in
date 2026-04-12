"""
Lightweight IGDB-only FastAPI server.
Use this when the full main.py can't start due to missing ML/DB dependencies.
Run: python -m uvicorn main_igdb:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import igdb

app = FastAPI(title="Tune-In IGDB Proxy")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(igdb.router)

@app.get("/")
def health_check():
    return {"status": "IGDB proxy online"}
