# main.py

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import supabase
import httpx
from dotenv import load_dotenv

load_dotenv()

print("SUPABASE VERSION:", supabase.__version__)
print("HTTPX VERSION:", httpx.__version__)

# =========================
# ROUTERS IMPORT
# =========================
from routers import auth, users, posts, igdb, feed, tunein, connect

print("🔥 ALL ROUTERS IMPORTED")

update_exploit_data = None

# =========================
# SCHEDULER IMPORT
# =========================
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
    # This acts as a universal wildcard, accepting your frontend no matter the port/IP
    allow_origin_regex=".*", 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTERS
# =========================

# Core APIs
app.include_router(auth.router,   prefix="/api")
app.include_router(users.router,  prefix="/api")
app.include_router(posts.router,  prefix="/api")
app.include_router(tunein.router, prefix="/api")

# ✅ Preserve BOTH old and new feed routes
app.include_router(feed.router, prefix="/api")  # new
app.include_router(feed.router, prefix="/v1")   # old (safe backward compatibility)

# Other routers
app.include_router(igdb.router,   prefix="/api")
app.include_router(connect.router, prefix="/api")

# =========================
# HEALTH
# =========================

@app.get("/")
def health_check():
    return {
        "status": "online",
        "modules": ["IGDB", "Auth", "Users", "Posts", "Feed", "TuneIn", "Connect"],
    }

@app.get("/health")
def health():
    return {"health": "healthy"}