from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import feed

app = FastAPI(title="Tune-In AI Backend")
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