from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from routers import feed
from scripts.update_exploit import update_exploit_data

scheduler = BackgroundScheduler()
scheduler.add_job(update_exploit_data, 'interval', minutes=15)

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    print("Exploit engine scheduler started — updating every 15 minutes.")
    yield
    scheduler.shutdown()
    print("Scheduler shut down.")

app = FastAPI(title="Tune-In AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(feed.router)

@app.get("/")
def health_check():
    return {"status": "The Matrix is online.", "engines": ["Explore", "Exploit"]}