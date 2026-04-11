from __future__ import annotations

import re
import hashlib
import json
from typing import Any, Optional

from app.ml.model import predict as predict_nlp
from app.ml.url_model import URLAnalyzerML
from app.ml.header_model import HeaderAnalyzerML
from app.ml.attachment_model import AttachmentAnalyzerML
from app.ml.aggregator import RiskAggregator
from app.blockchain.service import BlockchainService
from app.reports.forensics import ForensicReportGenerator

from app.threat_intel.abuseipdb import AbuseIPDBService
from app.threat_intel.openphish import OpenPhishService
from app.threat_intel.virustotal import VirusTotalService
from app.pipeline.url_analyzer import analyze_urls
from app.pipeline.attachment_analyzer import analyze_attachments

def analyze_email(
    email_record: dict[str, Any],
    openphish: Optional[OpenPhishService] = None,
    virustotal: Optional[VirusTotalService] = None,
    abuseipdb: Optional[AbuseIPDBService] = None,
) -> dict[str, Any]:
    """
    Comprehensive forensic analysis of an email.
    Integrates NLP, XGBoost (URL/Header), Random Forest (Attachments), 
    and Blockchain evidence recording.
    """
    # 1. Initialize services
    openphish_service = openphish or OpenPhishService()
    virustotal_service = virustotal or VirusTotalService()
    abuseipdb_service = abuseipdb or AbuseIPDBService()
    
    url_ml = URLAnalyzerML()
    header_ml = HeaderAnalyzerML()
    att_ml = AttachmentAnalyzerML()
    aggregator = RiskAggregator()
    blockchain = BlockchainService()
    
    # 2. Module Analysis
    
    # NLP & Content (BERT)
    body_text = str(email_record.get("clean_body") or email_record.get("body") or "")
    ai_result = predict_nlp(body_text)
    nlp_score = ai_result.get("confidence", 0.0) * 100 if ai_result.get("label") == 1 else 0.0
    
    # URL Analysis (Local XGBoost + External Intel)
    urls = email_record.get("urls", []) or []
    url_data = analyze_urls(urls, openphish_service, virustotal_service, url_ml)
    # Get max score from URL list
    url_score = max([r["ml_analysis"]["score"] for r in url_data["results"]] + [0.0])
    
    # Attachment Analysis (Local RF + External Intel)
    att_data = analyze_attachments(email_record, virustotal_service, att_ml)
    att_score = max([r["ml_analysis"]["score"] for r in att_data["files"]] + [0.0])
    
    # Header Analysis (Local XGBoost)
    header_res = header_ml.predict(email_record)
    header_score = header_res["score"]
    
    # IP Reputation (AbuseIPDB)
    # (Kept as secondary signal for aggregator)
    
    # 3. Meta-Aggregation (Logistic Regression)
    agg_result = aggregator.aggregate({
        "nlp_score": nlp_score,
        "url_score": url_score,
        "header_score": header_score,
        "attachment_score": att_score
    })
    
    final_verdict = agg_result["verdict"]
    final_score = agg_result["final_score"]

    # 4. Forensic Report Generation
    full_analysis = {
        "ai_analysis": ai_result,
        "url_analysis": url_data,
        "attachment_analysis": att_data,
        "header_analysis": {"ml_analysis": header_res},
        "final_verdict": final_verdict,
        "final_score": final_score
    }
    forensic_report = ForensicReportGenerator.generate_report(full_analysis)

    # 5. Blockchain Evidence Recording
    evidence_data = {
        "subject": email_record.get("subject"),
        "sender": email_record.get("sender"),
        "verdict": final_verdict,
        "score": final_score
    }
    evidence_json = json.dumps(evidence_data, sort_keys=True)
    evidence_hash = hashlib.sha256(evidence_json.encode()).hexdigest()
    
    blockchain_tx = blockchain.record_evidence(evidence_hash, final_verdict)
    if blockchain_tx:
        forensic_report["blockchain_verified"] = True
        forensic_report["blockchain_tx"] = blockchain_tx

    return {
        **full_analysis,
        "forensic_report": forensic_report,
        "blockchain_tx_id": blockchain_tx,
        "evidence_hash": evidence_hash
    }
