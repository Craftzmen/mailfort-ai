"""Search endpoint for email logs."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EmailLog

router = APIRouter(prefix="/api")


@router.get("/search")
def search_emails(
    q: str = Query(..., min_length=1, description="Search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    verdict: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Search email logs by sender, subject, body, or verdict."""
    normalized_query = q.strip().lower()
    search_term = f"%{normalized_query}%"

    base_query = db.query(EmailLog).filter(
        or_(
            func.lower(EmailLog.sender).like(search_term),
            func.lower(EmailLog.subject).like(search_term),
            func.lower(EmailLog.body).like(search_term),
            func.lower(EmailLog.verdict).like(search_term),
        )
    )

    if verdict:
        base_query = base_query.filter(EmailLog.verdict == verdict)

    relevance_score = case(
        (func.lower(EmailLog.sender) == normalized_query, 0),
        (func.lower(EmailLog.subject) == normalized_query, 1),
        (func.lower(EmailLog.sender).like(f"{normalized_query}%"), 2),
        (func.lower(EmailLog.subject).like(f"{normalized_query}%"), 3),
        (func.lower(EmailLog.verdict) == normalized_query, 4),
        else_=5,
    )

    total = base_query.count()

    results = (
        base_query
        .order_by(relevance_score.asc(), EmailLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": email.id,
                "sender": email.sender,
                "subject": email.subject,
                "verdict": email.verdict,
                "created_at": email.created_at,
            }
            for email in results
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
    }
