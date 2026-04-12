"""Email log CRUD endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EmailLog

router = APIRouter(prefix="/api")


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Return aggregate verdict statistics."""
    total = db.query(EmailLog).count()
    safe = db.query(EmailLog).filter(EmailLog.verdict == "Safe").count()
    suspicious = db.query(EmailLog).filter(EmailLog.verdict == "Suspicious").count()
    malicious = db.query(EmailLog).filter(EmailLog.verdict == "Malicious").count()

    return {
        "total": total,
        "breakdown": {
            "Safe": safe,
            "Suspicious": suspicious,
            "Malicious": malicious,
        },
    }


@router.get("/emails")
def get_emails(
    skip: int = Query(0),
    limit: int = Query(50),
    verdict: str = Query(None),
    db: Session = Depends(get_db),
):
    """List email logs with optional verdict filter."""
    query = db.query(EmailLog)
    if verdict:
        query = query.filter(EmailLog.verdict == verdict)

    emails = query.order_by(EmailLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": email.id,
            "sender": email.sender,
            "subject": email.subject,
            "verdict": email.verdict,
            "created_at": email.created_at,
        }
        for email in emails
    ]


@router.get("/emails/{email_id}")
def get_email(email_id: int, db: Session = Depends(get_db)):
    """Return full detail for a single email analysis log."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return {
        "id": email.id,
        "sender": email.sender,
        "subject": email.subject,
        "body": email.body,
        "verdict": email.verdict,
        "analysis_result": email.analysis_result,
        "blockchain_tx_id": email.blockchain_tx_id,
        "evidence_hash": email.evidence_hash,
        "forensic_report": email.forensic_report,
        "created_at": email.created_at,
    }


@router.get("/emails/{email_id}/report")
def get_email_report(
    email_id: int,
    format: str = Query("json", pattern="^(json|markdown)$"),
    db: Session = Depends(get_db),
):
    """Return a generated forensic report in JSON or markdown format."""
    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    report: Any = email.forensic_report
    if not isinstance(report, dict) or not report:
        raise HTTPException(status_code=404, detail="Forensic report not found for this email")

    if format == "markdown":
        markdown_report = report.get("markdown_report")
        if not isinstance(markdown_report, str) or not markdown_report.strip():
            markdown_report = (
                "# MailFort AI Forensic Report\n\n"
                f"Email ID: {email.id}\n"
                f"Verdict: {email.verdict}\n\n"
                f"Summary: {report.get('summary', 'No summary available.')}\n"
            )

        return PlainTextResponse(markdown_report, media_type="text/markdown")

    return {
        "email_id": email.id,
        "sender": email.sender,
        "subject": email.subject,
        "verdict": email.verdict,
        "created_at": email.created_at,
        "report": report,
    }


@router.post("/emails/{email_id}/report")
def report_malicious_ips(email_id: int, db: Session = Depends(get_db)):
    """Extract IPs from an email log and report them to AbuseIPDB."""
    from app.threat_intel.abuseipdb import AbuseIPDBService

    email = db.query(EmailLog).filter(EmailLog.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    analysis = email.analysis_result or {}
    ip_results = analysis.get("ip_analysis", {}).get("results", [])

    if not ip_results:
        return {"message": "No IP addresses found in this log to report", "reported": []}

    abuse_service = AbuseIPDBService()
    reported = []

    for res in ip_results:
        ip = res.get("ip")
        if ip:
            # Report as phishing/spam
            report_res = abuse_service.report_ip(
                ip=ip,
                categories=["phishing", "email_spam"],
                comment=f"Malicious email from {email.sender} with subject '{email.subject}'",
            )
            reported.append({"ip": ip, "status": "reported", "details": report_res})

    return {
        "message": f"Successfully processed {len(reported)} IP reports",
        "results": reported,
    }


@router.delete("/emails")
def clear_all_emails(db: Session = Depends(get_db)):
    """Delete all email analysis logs (used by settings page for DB management)."""
    count = db.query(EmailLog).count()
    db.query(EmailLog).delete()
    db.commit()
    return {"message": f"Deleted {count} email logs", "deleted": count}
