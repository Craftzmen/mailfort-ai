from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


SEVERITY_ORDER = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "info": 4,
}

class ForensicReportGenerator:
    """Generates detailed forensic reports explaining threat analysis results."""

    REPORT_VERSION = "2.0.0"

    @staticmethod
    def _to_float(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _severity_from_score(score: float) -> str:
        if score >= 85:
            return "critical"
        if score >= 70:
            return "high"
        if score >= 40:
            return "medium"
        if score > 0:
            return "low"
        return "info"

    @staticmethod
    def _safe_int(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _dedupe_keep_order(items: list[str]) -> list[str]:
        seen: set[str] = set()
        output: list[str] = []
        for item in items:
            normalized = item.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            output.append(normalized)
        return output

    @staticmethod
    def _extract_vt_hits(vt_payload: Any) -> int:
        if not isinstance(vt_payload, dict):
            return 0

        direct_keys = ["malicious", "positives", "detections", "detected", "hits"]
        for key in direct_keys:
            if key in vt_payload:
                return ForensicReportGenerator._safe_int(vt_payload.get(key))

        stats = vt_payload.get("stats")
        if isinstance(stats, dict):
            malicious = stats.get("malicious")
            if malicious is not None:
                return ForensicReportGenerator._safe_int(malicious)

        data = vt_payload.get("data")
        if isinstance(data, dict):
            attributes = data.get("attributes")
            if isinstance(attributes, dict):
                last_analysis_stats = attributes.get("last_analysis_stats")
                if isinstance(last_analysis_stats, dict):
                    malicious = last_analysis_stats.get("malicious")
                    if malicious is not None:
                        return ForensicReportGenerator._safe_int(malicious)

        return 0

    @staticmethod
    def _build_markdown(report: dict[str, Any]) -> str:
        lines: list[str] = [
            "# MailFort AI Forensic Report",
            "",
            f"Report ID: {report['report_id']}",
            f"Generated At: {report['generated_at']}",
            f"Verdict: {report['final_verdict']}",
            f"Severity: {report['severity'].upper()}",
            f"Overall Risk Score: {round(ForensicReportGenerator._to_float(report['risk_score']), 2)}",
            "",
            "## Executive Summary",
            report.get("summary", "No summary available."),
            "",
            "## Module Scores",
            f"- NLP: {round(ForensicReportGenerator._to_float(report.get('module_scores', {}).get('nlp')), 2)}",
            f"- URL: {round(ForensicReportGenerator._to_float(report.get('module_scores', {}).get('url')), 2)}",
            f"- Header: {round(ForensicReportGenerator._to_float(report.get('module_scores', {}).get('header')), 2)}",
            f"- Attachment: {round(ForensicReportGenerator._to_float(report.get('module_scores', {}).get('attachment')), 2)}",
            "",
            "## Risk Factors",
        ]

        risk_factors = report.get("risk_factors", [])
        if isinstance(risk_factors, list) and risk_factors:
            lines.extend([f"- {item}" for item in risk_factors])
        else:
            lines.append("- No material risk factors detected.")

        lines.extend(["", "## Key Findings"])
        findings = report.get("findings", [])
        if isinstance(findings, list) and findings:
            for finding in findings:
                if not isinstance(finding, dict):
                    continue
                title = str(finding.get("title", "Untitled finding"))
                severity = str(finding.get("severity", "info")).upper()
                module = str(finding.get("module", "unknown")).upper()
                evidence = finding.get("evidence", {})
                lines.append(f"- [{severity}] ({module}) {title}")
                if isinstance(evidence, dict) and evidence:
                    for key, value in evidence.items():
                        lines.append(f"  - {key}: {value}")
                recommendation = finding.get("recommendation")
                if recommendation:
                    lines.append(f"  - Recommendation: {recommendation}")
        else:
            lines.append("- No high-confidence indicators identified.")

        lines.extend(["", "## Recommendations"])
        recommendations = report.get("recommendations", [])
        if isinstance(recommendations, list) and recommendations:
            lines.extend([f"- {item}" for item in recommendations])
        else:
            lines.append("- Continue routine monitoring and keep protections up to date.")

        return "\n".join(lines)

    @staticmethod
    def generate_report(analysis_data: dict[str, Any]) -> dict[str, Any]:
        """
        Produce a categorized report for the dashboard.
        Based on behavioral social engineering patterns and ML module scores.
        """
        forensic_details: dict[str, list[str]] = {
            "nlp": [],
            "url": [],
            "header": [],
            "attachment": [],
        }
        findings: list[dict[str, Any]] = []
        risk_factors: list[str] = []
        recommendations: list[str] = []
        suspicious_urls: list[str] = []
        suspicious_attachments: list[str] = []
        header_anomalies: list[str] = []

        verdict = str(analysis_data.get("final_verdict", "Safe"))
        final_score = ForensicReportGenerator._to_float(analysis_data.get("final_score", 0.0))

        ai_analysis = analysis_data.get("ai_analysis", {}) or {}
        ai_label = ai_analysis.get("label")
        ai_confidence = ForensicReportGenerator._to_float(ai_analysis.get("confidence", 0.0))
        ai_score = ai_confidence * 100 if ai_label == 1 else 0.0

        # 1. NLP findings
        if ai_label == 1:
            forensic_details["nlp"].append("Social engineering tactics detected in email body.")
            if ai_confidence >= 0.8:
                risk_factors.append("High-confidence phishing language detected.")

            findings.append(
                {
                    "module": "nlp",
                    "severity": ForensicReportGenerator._severity_from_score(ai_score),
                    "title": "Potential social engineering language",
                    "evidence": {
                        "confidence": round(ai_confidence, 4),
                        "model_label": ai_label,
                    },
                    "recommendation": "Verify sender identity and confirm intent through a secondary trusted channel.",
                }
            )
            recommendations.append("Enable user awareness prompts for urgent and reward-based email language.")

        # 2. URL findings
        urls = analysis_data.get("url_analysis", {}).get("results", []) or []
        url_scores: list[float] = []
        for url_res in urls:
            if not isinstance(url_res, dict):
                continue

            url = str(url_res.get("url", ""))
            ml_res = url_res.get("ml_analysis", {}) or {}
            ml_score = ForensicReportGenerator._to_float(ml_res.get("score", 0.0))
            url_scores.append(ml_score)

            openphish_hit = bool((url_res.get("openphish") or {}).get("is_phishing", False))
            vt_hits = ForensicReportGenerator._extract_vt_hits(url_res.get("virustotal", {}))
            entropy = ForensicReportGenerator._to_float((ml_res.get("features") or {}).get("entropy", 0.0))

            if ml_score >= 45 or openphish_hit or vt_hits > 0:
                suspicious_urls.append(url)
                forensic_details["url"].append(f"Suspicious URL behavior observed: {url}")
                if entropy > 3.5:
                    forensic_details["url"].append("High entropy in URL string suggests obfuscation.")

                if openphish_hit:
                    risk_factors.append("OpenPhish flagged at least one embedded URL.")
                if vt_hits > 0:
                    risk_factors.append("VirusTotal reported malicious detections for one or more URLs.")

                findings.append(
                    {
                        "module": "url",
                        "severity": ForensicReportGenerator._severity_from_score(max(ml_score, vt_hits * 10)),
                        "title": "Suspicious URL indicator",
                        "evidence": {
                            "url": url,
                            "ml_score": round(ml_score, 2),
                            "openphish_flagged": openphish_hit,
                            "virustotal_hits": vt_hits,
                            "entropy": round(entropy, 4),
                        },
                        "recommendation": "Block navigation to this URL and inspect destination host infrastructure.",
                    }
                )

        # 3. Header findings
        header_ml = analysis_data.get("header_analysis", {}).get("ml_analysis", {}) or {}
        header_score = ForensicReportGenerator._to_float(header_ml.get("score", 0.0))
        header_features = header_ml.get("features", {}) or {}

        spf_failed = ForensicReportGenerator._safe_int(header_features.get("spf_pass", 1)) == 0
        dkim_failed = ForensicReportGenerator._safe_int(header_features.get("dkim_pass", 1)) == 0
        dmarc_failed = ForensicReportGenerator._safe_int(header_features.get("dmarc_pass", 1)) == 0
        from_reply_mismatch = ForensicReportGenerator._safe_int(header_features.get("mismatch_from_reply", 0)) == 1

        if spf_failed:
            forensic_details["header"].append("SPF authentication failure detected.")
            header_anomalies.append("SPF failed")
        if dkim_failed:
            forensic_details["header"].append("DKIM authentication failure detected.")
            header_anomalies.append("DKIM failed")
        if dmarc_failed:
            forensic_details["header"].append("DMARC policy check failed.")
            header_anomalies.append("DMARC failed")
        if from_reply_mismatch:
            forensic_details["header"].append("Sender and Reply-To mismatch indicates possible spoofing.")
            header_anomalies.append("From/Reply-To mismatch")

        if header_score >= 40 or header_anomalies:
            risk_factors.append("Email authentication anomalies present in transport headers.")
            findings.append(
                {
                    "module": "header",
                    "severity": ForensicReportGenerator._severity_from_score(header_score),
                    "title": "Header trust and sender-authentication anomalies",
                    "evidence": {
                        "header_score": round(header_score, 2),
                        "spf_failed": spf_failed,
                        "dkim_failed": dkim_failed,
                        "dmarc_failed": dmarc_failed,
                        "from_reply_mismatch": from_reply_mismatch,
                    },
                    "recommendation": "Reject or quarantine this message until sender domain controls are validated.",
                }
            )
            recommendations.append("Enforce SPF, DKIM, and DMARC alignment in mail gateway policies.")

        # 4. Attachment findings
        attachment_data = analysis_data.get("attachment_analysis", {}) or {}
        attachments = attachment_data.get("files") or attachment_data.get("results") or []
        attachment_scores: list[float] = []
        for att_res in attachments:
            if not isinstance(att_res, dict):
                continue

            filename = str(att_res.get("filename") or "unknown")
            ml_res = att_res.get("ml_analysis", {}) or {}
            ml_score = ForensicReportGenerator._to_float(ml_res.get("score", 0.0))
            attachment_scores.append(ml_score)

            features = ml_res.get("features", {}) or {}
            is_executable = ForensicReportGenerator._safe_int(features.get("is_executable", 0)) == 1
            suspicious_ext = bool(features.get("is_suspicious_ext", False))
            double_ext = bool(features.get("has_double_ext", False))
            vt_hits = ForensicReportGenerator._extract_vt_hits(att_res.get("vt_result", {}))

            if ml_score >= 45 or is_executable or suspicious_ext or double_ext or vt_hits > 0:
                suspicious_attachments.append(filename)
                forensic_details["attachment"].append(f"Attachment risk signal detected: {filename}")

                if is_executable:
                    risk_factors.append("Executable attachment embedded in email.")
                if double_ext:
                    risk_factors.append("Attachment contains a double extension pattern.")
                if vt_hits > 0:
                    risk_factors.append("VirusTotal reported malicious detections for at least one attachment.")

                findings.append(
                    {
                        "module": "attachment",
                        "severity": ForensicReportGenerator._severity_from_score(max(ml_score, vt_hits * 10)),
                        "title": "Suspicious attachment artifact",
                        "evidence": {
                            "filename": filename,
                            "ml_score": round(ml_score, 2),
                            "is_executable": is_executable,
                            "is_suspicious_ext": suspicious_ext,
                            "has_double_ext": double_ext,
                            "virustotal_hits": vt_hits,
                        },
                        "recommendation": "Quarantine attachment and scan in an isolated malware analysis environment.",
                    }
                )
                recommendations.append("Block high-risk attachment extensions and enforce attachment detonation policy.")

        module_scores = {
            "nlp": round(ai_score, 2),
            "url": round(max(url_scores + [0.0]), 2),
            "header": round(header_score, 2),
            "attachment": round(max(attachment_scores + [0.0]), 2),
            "final": round(final_score, 2),
        }

        if verdict == "Malicious":
            summary = (
                "Critical threat detected. Multiple forensic indicators confirm high-risk malicious activity."
            )
        elif verdict == "Suspicious":
            summary = (
                "Caution required. Anomalous behavioral patterns suggest potential social engineering or spoofing."
            )
        else:
            summary = "No significant threats detected. Email metrics fall within normal behavioral baselines."

        if findings:
            summary = f"{summary} {len(findings)} key indicator(s) were recorded in this report."

        findings.sort(key=lambda item: SEVERITY_ORDER.get(str(item.get("severity", "info")), 4))
        for index, finding in enumerate(findings, start=1):
            finding["id"] = f"F-{index:03d}"

        report = {
            "report_id": f"MFR-{uuid4().hex[:12].upper()}",
            "report_version": ForensicReportGenerator.REPORT_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "final_verdict": verdict,
            "severity": ForensicReportGenerator._severity_from_score(final_score),
            "risk_score": round(final_score, 2),
            "summary": summary,
            "risk_factors": ForensicReportGenerator._dedupe_keep_order(risk_factors),
            "module_scores": module_scores,
            "findings": findings,
            "recommendations": ForensicReportGenerator._dedupe_keep_order(recommendations),
            "forensic_details": forensic_details,
            "indicators": {
                "suspicious_urls": ForensicReportGenerator._dedupe_keep_order(suspicious_urls),
                "suspicious_attachments": ForensicReportGenerator._dedupe_keep_order(suspicious_attachments),
                "header_anomalies": ForensicReportGenerator._dedupe_keep_order(header_anomalies),
            },
            "blockchain_verified": False,
        }

        report["markdown_report"] = ForensicReportGenerator._build_markdown(report)
        return report
