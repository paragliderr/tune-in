from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import supabase
import httpx

print("SUPABASE VERSION:", supabase.__version__)
print("HTTPX VERSION:", httpx.__version__)

# =========================
# ROUTERS IMPORT
# =========================
# FIX 1: Use "from routers import ..." NOT "from apps.api.routers import ..."
#         because this file lives at apps/api/main.py — Python resolves
#         "routers" relative to that directory already.

from routers import auth, users, posts, igdb, feed, tunein
print("🔥 ALL ROUTERS IMPORTED")

update_exploit_data = None

# Scheduler import (graceful fallback)
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from scripts.update_exploit import update_exploit_data as _update
    update_exploit_data = _update
except Exception as e:
    print(f"[WARN] Exploit scheduler unavailable: {e}")

# =========================
# SCHEDULER SETUP
# =========================

scheduler = None
if update_exploit_data:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        update_exploit_data,
        trigger="interval",
        hours=2,
        max_instances=1,
        coalesce=True,
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    if scheduler:
        scheduler.start()
        print("[OK] Scheduler started — running every 2 hours.")
    else:
        print("[OK] Running without scheduler")

    yield

    if scheduler:
        scheduler.shutdown()
        print("[OK] Scheduler stopped")

# =========================
# APP INIT
# =========================

app = FastAPI(
    title="Tune-In Unified Backend",
    lifespan=lifespan,
)

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://tune-in-three.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTERS
# FIX 2: Removed duplicate feed.router registration.
# FIX 3: Removed the undefined `feed_router` variable — was never set.
# =========================

app.include_router(auth.router,   prefix="/api")
app.include_router(users.router,  prefix="/api")
app.include_router(posts.router,  prefix="/api")
app.include_router(tunein.router, prefix="/api")
app.include_router(feed.router,   prefix="/api")
app.include_router(igdb.router,   prefix="/api")

# =========================
# HEALTH
# =========================

@app.get("/")
def health_check():
    return {
        "status": "online",
        "modules": ["IGDB", "Auth", "Users", "Posts", "Feed", "TuneIn"],
    }

@app.get("/health")
def health():
    return {"health": "healthy"}