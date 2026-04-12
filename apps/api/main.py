from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import igdb


feed_router = None
update_exploit_data = None
try:
    from routers import feed
    feed_router = feed.router
except Exception as e:
    print(f"[WARN] Feed router unavailable (missing env vars?): {e}")

try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from scripts.update_exploit import update_exploit_data as _update
    update_exploit_data = _update
except Exception as e:
    print(f"[WARN] Exploit scheduler unavailable: {e}")

# Initialize the background scheduler only if exploit is available
scheduler = None
if update_exploit_data:
    scheduler = BackgroundScheduler()
    scheduler.add_job(update_exploit_data, 'interval', minutes=15)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the trending data scheduler if available
    if scheduler:
        scheduler.start()
        print("[OK] Exploit engine scheduler started -- updating every 15 minutes.")
    else:
        print("[OK] Running in IGDB-only mode (feed/exploit dependencies not loaded).")
    yield
    # Shutdown: Stop the scheduler if running
    if scheduler:
        scheduler.shutdown()
        print("[OK] Scheduler shut down.")

app = FastAPI(
    title="Tune-In AI Backend",
    description="Unified API for discovery (IGDB/TMDB) and personalized feeds.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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