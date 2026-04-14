#EDITED THIS FILE

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# Routers
from routers import igdb
from app.routers import auth, users, posts

feed_router = None
update_exploit_data = None

# Try loading optional feed router
try:
    from routers import feed
    feed_router = feed.router
except Exception as e:
    print(f"[WARN] Feed router unavailable: {e}")

# Try loading scheduler + exploit updater
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from scripts.update_exploit import update_exploit_data as _update
    update_exploit_data = _update
except Exception as e:
    print(f"[WARN] Exploit scheduler unavailable: {e}")

# Initialize scheduler (every 2 hours)
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
    # Startup
    if scheduler:
        scheduler.start()
        print("[OK] Scheduler started — running every 2 hours.")
    else:
        print("[OK] Running without scheduler (IGDB-only mode).")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown()
        print("[OK] Scheduler shut down.")

app = FastAPI(
    title="Tune-In Unified Backend",
    description="IGDB + Feed + Auth + Posts + Users",
    lifespan=lifespan,
)

# CORS
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
# ROUTERS (UNIFIED)
# =========================

# Core app routes
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(posts.router, prefix="/api")

# Feed (optional)
if feed_router:
    app.include_router(feed_router, prefix="/api")

# IGDB
app.include_router(igdb.router, prefix="/api")

# =========================
# HEALTH
# =========================

modules = ["IGDB", "Auth", "Users", "Posts"] + (["Feed"] if feed_router else [])

@app.get("/")
def health_check():
    return {
        "status": "The Matrix is online.",
        "modules": modules,
        "scheduler": "enabled" if scheduler else "disabled",
    }

@app.get("/health")
def health():
    return {"health": "healthy"}