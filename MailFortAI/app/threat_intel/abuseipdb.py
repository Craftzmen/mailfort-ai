from __future__ import annotations

import os
import urllib.error
from typing import Any, Optional

from app.threat_intel.http_client import ResilientHTTPClient

ABUSEIPDB_CHECK_URL = "https://api.abuseipdb.com/api/v2/check"
ABUSEIPDB_REPORT_URL = "https://api.abuseipdb.com/api/v2/report"

# AbuseIPDB category codes for common email-related abuse
ABUSE_CATEGORIES = {
    "spam": 11,
    "phishing": 9,
    "email_spam": 11,
    "brute_force": 18,
    "port_scan": 14,
    "hacking": 15,
}


class AbuseIPDBService:
    """AbuseIPDB client for IP reputation checks and abuse reporting."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        http_client: Optional[ResilientHTTPClient] = None,
    ) -> None:
        self._api_key = api_key or os.getenv("ABUSEIPDB_API_KEY", "")
        self._client = http_client or ResilientHTTPClient()

    @property
    def is_configured(self) -> bool:
        """Check if the API key is configured."""
        return bool(self._api_key)

    def check_ip(self, ip: str) -> dict[str, Any]:
        """Check IP reputation against AbuseIPDB."""
        if not self._api_key:
            return self._unknown_response("Missing ABUSEIPDB_API_KEY")

        try:
            payload = self._client.get_json(
                url=ABUSEIPDB_CHECK_URL,
                headers={
                    "Key": self._api_key,
                    "Accept": "application/json",
                },
                params={
                    "ipAddress": ip,
                    "maxAgeInDays": "90",
                },
            )
            data = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(data, dict):
                return self._unknown_response("AbuseIPDB response missing data payload")

            abuse_score = int(data.get("abuseConfidenceScore", 0) or 0)
            total_reports = int(data.get("totalReports", 0) or 0)
            return {
                "abuse_score": abuse_score,
                "is_malicious": abuse_score >= 60,
                "country": str(data.get("countryCode") or ""),
                "isp": str(data.get("isp") or ""),
                "domain": str(data.get("domain") or ""),
                "total_reports": total_reports,
                "is_whitelisted": bool(data.get("isWhitelisted")),
                "usage_type": str(data.get("usageType") or ""),
            }
        except urllib.error.HTTPError as exc:
            return self._unknown_response(f"AbuseIPDB check failed: HTTP {exc.code}")
        except Exception as exc:
            return self._unknown_response(f"AbuseIPDB check failed: {exc}")

    def report_ip(
        self,
        ip: str,
        categories: list[str] | None = None,
        comment: str = "",
    ) -> dict[str, Any]:
        """Report an abusive IP to AbuseIPDB.

        Args:
            ip: The IP address to report.
            categories: List of abuse category names (e.g., ["phishing", "spam"]).
            comment: Optional comment describing the abuse.

        Returns:
            Report result with the abuse confidence score.
        """
        if not self._api_key:
            return {"success": False, "error": "Missing ABUSEIPDB_API_KEY"}

        # Resolve category names to numeric codes
        category_codes = []
        for cat in (categories or ["phishing"]):
            code = ABUSE_CATEGORIES.get(cat.lower())
            if code:
                category_codes.append(str(code))

        if not category_codes:
            category_codes = [str(ABUSE_CATEGORIES["phishing"])]

        try:
            payload = self._client.post_form_json(
                url=ABUSEIPDB_REPORT_URL,
                form_data={
                    "ip": ip,
                    "categories": ",".join(category_codes),
                    "comment": comment or f"Reported by MailFort AI threat analysis pipeline",
                },
                headers={
                    "Key": self._api_key,
                    "Accept": "application/json",
                },
            )
            data = payload.get("data") if isinstance(payload, dict) else None
            if isinstance(data, dict):
                return {
                    "success": True,
                    "abuse_score": int(data.get("abuseConfidenceScore", 0) or 0),
                    "ip": ip,
                }
            return {"success": True, "ip": ip, "raw": payload}

        except urllib.error.HTTPError as exc:
            return {"success": False, "error": f"AbuseIPDB report failed: HTTP {exc.code}"}
        except Exception as exc:
            return {"success": False, "error": f"AbuseIPDB report failed: {exc}"}

    def _unknown_response(self, error: str) -> dict[str, Any]:
        return {
            "abuse_score": 0,
            "is_malicious": False,
            "country": "",
            "isp": "",
            "domain": "",
            "total_reports": 0,
            "is_whitelisted": False,
            "usage_type": "",
            "error": error,
        }
