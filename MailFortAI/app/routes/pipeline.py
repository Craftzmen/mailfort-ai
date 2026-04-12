"""Data preprocessing pipeline endpoint."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from app.config import PROJECT_ROOT

router = APIRouter()


@router.post("/phase1/run")
def run_phase1_endpoint() -> dict:
    """Execute dataset collection and preprocessing pipeline."""
    # Lazy import to avoid loading heavy preprocessing deps at startup
    from preprocessing.preprocess_pipeline import run_phase1

    summary = run_phase1(
        project_root=PROJECT_ROOT,
    )
    return {"message": "Phase 1 completed", "summary": summary}
