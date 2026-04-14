from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import igdb

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

# Initialize scheduler (OPTIMIZED: every 2 hours)
scheduler = None
if update_exploit_data:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        update_exploit_data,
        trigger='interval',
        hours=2,  #  Optimized 
        max_instances=1,  # prevents overlapping jobs
        coalesce=True     # merges missed runs
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
    title="Tune-In AI Backend",
    description="Unified API for discovery (IGDB/TMDB) and personalized feeds.",
    lifespan=lifespan
)

# ✅ FIXED CORS (no wildcard, no trailing slash)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "https://tune-in-three.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
if feed_router:
    app.include_router(feed_router)

app.include_router(igdb.router)

modules = ["IGDB Proxy"] + (["Feed"] if feed_router else [])

@app.get("/")
def health_check():
    return {
        "status": "The Matrix is online.",
        "engines": ["Explore", "Exploit"] if update_exploit_data else ["IGDB Only"],
        "modules": modules
    }