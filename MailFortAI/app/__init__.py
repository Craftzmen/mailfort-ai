"""MailFort AI — FastAPI application factory."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import APP_TITLE, APP_VERSION, APP_DESCRIPTION, CORS_ORIGINS
from app.database import engine, Base
from app.routes import api_router

# Create tables on startup
Base.metadata.create_all(bind=engine)

# Build application
app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=APP_DESCRIPTION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
