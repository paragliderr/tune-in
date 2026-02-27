from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users

from app.database import engine, Base
from app.models.user import User
from app.routers import auth  

app = FastAPI(title="Tune-In API")
app.include_router(auth.router)
app.include_router(users.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router, tags=["auth"])

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/health")
def health():
    return {"health": "healthy"}
