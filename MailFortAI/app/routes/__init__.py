"""Aggregate all route modules into a single APIRouter."""

from fastapi import APIRouter

from app.routes.health import router as health_router
from app.routes.emails import router as emails_router
from app.routes.analysis import router as analysis_router
from app.routes.pipeline import router as pipeline_router
from app.routes.search import router as search_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["Health"])
api_router.include_router(emails_router, tags=["Emails"])
api_router.include_router(search_router, tags=["Search"])
api_router.include_router(analysis_router, tags=["Analysis"])
api_router.include_router(pipeline_router, tags=["Pipeline"])
