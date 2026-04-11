"""Health-check endpoint."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok", "service": "MailFort AI"}
