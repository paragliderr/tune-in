from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, posts,feed
app = FastAPI()
from app.letterboxd import router as letterboxd_router
app.include_router(letterboxd_router)

from app.database import engine, Base
from app.models.user import User

app = FastAPI(title="Tune-In API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router, tags=["auth"])
app.include_router(users.router, tags=["users"])
app.include_router(posts.router, tags=["posts"]) 
app.include_router(feed.router)

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"health": "healthy"}