"""Email log CRUD endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EmailLog
from app.blockchain.service import BlockchainService
from app.reports.forensics import ForensicReportGenerator

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
    report_generated = False
    report_updated = False

    if not isinstance(report, dict) or not report:
        analysis_payload: Any = email.analysis_result
        if not isinstance(analysis_payload, dict) or not analysis_payload:
            raise HTTPException(status_code=404, detail="Forensic report not found for this email")

        nested_report = analysis_payload.get("forensic_report")
        if isinstance(nested_report, dict) and nested_report:
            report = dict(nested_report)
        else:
            report = ForensicReportGenerator.generate_report(analysis_payload)
            report_generated = True

    blockchain_tx_id = str(email.blockchain_tx_id or report.get("blockchain_tx") or "").strip()
    if blockchain_tx_id:
        if report.get("blockchain_tx") != blockchain_tx_id:
            report["blockchain_tx"] = blockchain_tx_id
            report_updated = True
        if report.get("blockchain_verified") is not True:
            report["blockchain_verified"] = True
            report_updated = True
    else:
        if "blockchain_tx" not in report:
            report["blockchain_tx"] = None
            report_updated = True
        if "blockchain_verified" not in report:
            report["blockchain_verified"] = False
            report_updated = True

    if "blockchain_status" not in report:
        report["blockchain_status"] = {
            "connected": False,
            "contract_ready": bool(blockchain_tx_id),
            "contract_address": None,
            "account": None,
            "rpc_url": None,
            "auto_deploy_enabled": False,
            "reason": "legacy_record" if blockchain_tx_id else "not_available",
        }
        report_updated = True

    # Keep blockchain runtime status fresh so the dashboard reflects live RPC/contract state.
    try:
        live_blockchain_status = BlockchainService(auto_deploy=False).get_status()
        if report.get("blockchain_status") != live_blockchain_status:
            report["blockchain_status"] = live_blockchain_status
            report_updated = True
    except Exception:
        # Fall back to the stored snapshot if live status retrieval fails.
        pass

    if report_generated or report_updated or email.forensic_report != report:
        email.forensic_report = report
        db.add(email)
        db.commit()
        db.refresh(email)

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
