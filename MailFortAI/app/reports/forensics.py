from __future__ import annotations

from typing import Any

class ForensicReportGenerator:
    """Generates detailed forensic reports explaining threat analysis results."""

    @staticmethod
    def generate_report(analysis_data: dict[str, Any]) -> dict[str, Any]:
        """
        Produce a categorized report for the dashboard.
        Based on behavioral social engineering patterns and ML module scores.
        """
        report = {
            "summary": "",
            "risk_factors": [],
            "forensic_details": {
                "nlp": [],
                "url": [],
                "header": [],
                "attachment": []
            },
            "blockchain_verified": False
        }

        # 1. NLP Factors (BERT)
        nlp = analysis_data.get("ai_analysis", {})
        if nlp.get("label") == 1:
            report["forensic_details"]["nlp"].append("Social engineering tactics detected in email body.")
            if nlp.get("confidence", 0) > 0.8:
                report["risk_factors"].append("High-confidence phishing language detected.")
        
        # 2. URL Factors (XGBoost)
        urls = analysis_data.get("url_analysis", {}).get("results", [])
        for url_res in urls:
            ml_res = url_res.get("ml_analysis", {})
            if ml_res.get("score", 0) > 50:
                report["forensic_details"]["url"].append(f"Suspicious URL behavior: {url_res.get('url')}")
                if ml_res.get("features", {}).get("entropy", 0) > 3.5:
                    report["forensic_details"]["url"].append("- High entropy detected (potential obfuscation).")
        
        # 3. Header Factors (XGBoost)
        header_ml = analysis_data.get("header_analysis", {}).get("ml_analysis", {})
        if header_ml.get("score", 0) > 50:
            feat = header_ml.get("features", {})
            if feat.get("spf_pass") == 0:
                report["forensic_details"]["header"].append("SPF authentication failure.")
            if feat.get("dkim_pass") == 0:
                report["forensic_details"]["header"].append("DKIM authentication failure.")
            if feat.get("mismatch_from_reply") == 1:
                report["forensic_details"]["header"].append("Sender/Reply-To address mismatch (Spoofing indicator).")
        
        # 4. Attachment Factors (Random Forest)
        attachments = analysis_data.get("attachment_analysis", {}).get("results", [])
        for att_res in attachments:
            ml_res = att_res.get("ml_analysis", {})
            if ml_res.get("score", 0) > 50:
                report["forensic_details"]["attachment"].append(f"Malicious patterns in attachment: {att_res.get('filename')}")
                if ml_res.get("features", {}).get("is_executable") == 1:
                    report["risk_factors"].append("Executable attachment embedded in email.")

        # Summary generation
        verdict = analysis_data.get("final_verdict", "Safe")
        if verdict == "Malicious":
            report["summary"] = "Critical threat detected. Multiple forensic indicators confirm high-risk malicious activity."
        elif verdict == "Suspicious":
            report["summary"] = "Caution required. Anomalous behavioral patterns suggest potential social engineering."
        else:
            report["summary"] = "No significant threats detected. Email metrics fall within normal behavioral baselines."

        return report
