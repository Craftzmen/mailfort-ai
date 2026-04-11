"""Email analysis endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EmailLog
from app.schemas import EmailAnalysisRequest
from app.pipeline.analyzer import analyze_email

router = APIRouter()


@router.post("/analyze/email")
def analyze_email_endpoint(
    payload: EmailAnalysisRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Run the full analysis pipeline on a submitted email and persist the result."""
    analysis_result = analyze_email(payload.model_dump())

    verdict = analysis_result.get("final_verdict", analysis_result.get("verdict", "Unknown"))

    email_log = EmailLog(
        sender=payload.sender,
        subject=payload.subject,
        body=payload.body,
        analysis_result=analysis_result,
        verdict=verdict,
        blockchain_tx_id=analysis_result.get("blockchain_tx_id"),
        evidence_hash=analysis_result.get("evidence_hash"),
        forensic_report=analysis_result.get("forensic_report"),
    )
    db.add(email_log)
    db.commit()
    db.refresh(email_log)

    return {
        "message": "Email analysis completed",
        "result": analysis_result,
        "log_id": email_log.id,
    }
