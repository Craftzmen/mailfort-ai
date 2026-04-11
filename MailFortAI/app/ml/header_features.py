from __future__ import annotations

from typing import Any

def extract_header_features(email_record: dict[str, Any]) -> dict[str, Any]:
    """Extract authentication and infrastructure features for XGBoost Header analysis."""
    headers = email_record.get("headers", {})
    
    # Map authentication results to numerical values
    # 2: Pass, 1: Softfail/Neutral, 0: Fail/None
    def auth_to_int(status: str) -> int:
        status = str(status).lower()
        if "pass" in status: return 2
        if any(s in status for s in ["fail", "error"]): return 0
        return 1

    features = {
        "spf_pass": auth_to_int(email_record.get("spf_result", "none")),
        "dkim_pass": auth_to_int(email_record.get("dkim_result", "none")),
        "dmarc_pass": auth_to_int(email_record.get("dmarc_result", "none")),
        "num_received": int(email_record.get("num_received_headers") or 0),
        "has_reply_to": 1 if email_record.get("reply_to") else 0,
        "mismatch_from_reply": 1 if email_record.get("from_address") != email_record.get("reply_to") and email_record.get("reply_to") else 0,
    }
    
    return features
