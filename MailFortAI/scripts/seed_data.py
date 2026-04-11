#!/usr/bin/env python3
"""Seed the MailFort AI database with rich demo email analysis results.

Run with:
    python scripts/seed_data.py

Requires the backend to be running at http://127.0.0.1:8000
"""

from __future__ import annotations

import base64
import json
import sys
import urllib.error
import urllib.request

API_URL = "http://127.0.0.1:8000/analyze/email"
TARGET_COUNT = 560

SAFE_URLS = [
    "https://intranet.company.com/wiki/security-guidelines",
    "https://status.company.com/overview",
    "https://docs.company.com/platform/release-notes",
]

SUSPICIOUS_URLS = [
    "https://account-review-portal.net/verify",
    "http://session-check-mailbox.info/login",
    "https://security-notice-center.biz/confirm",
]

MALICIOUS_URLS = [
    "https://moobiileleginds.xyz/",
    "http://emon-tb.shop/view-signin.php",
    "http://malicious-phishing-site.com/login",
    "https://verify-wallet-access.biz/recovery",
    "http://payment-auth-gateway.net/confirm",
    "https://office365-security-review.info/login",
]

SAFE_IPS = ["8.8.8.8", "1.1.1.1", "9.9.9.9", "13.107.42.16"]
SUSPICIOUS_IPS = ["45.83.23.19", "77.91.124.33", "103.133.214.44", "185.172.110.11"]
MALICIOUS_IPS = ["203.0.113.10", "198.51.100.6", "185.220.101.2", "194.26.192.12"]


def _attachment_payload(filename: str, text: str) -> dict[str, str]:
    encoded = base64.b64encode(text.encode("utf-8")).decode("utf-8")
    return {"filename": filename, "content": encoded}


def _headers_with_ip(ip_address: str) -> dict[str, list[str]]:
    return {
        "Received": [
            f"from relay.mailfort.ai (relay.mailfort.ai [{ip_address}]) by mx.company.com with ESMTPSA id seed-{ip_address.replace('.', '-')};"
        ]
    }


def _safe_email(i: int) -> dict[str, object]:
    safe_url = SAFE_URLS[i % len(SAFE_URLS)]
    safe_ip = SAFE_IPS[i % len(SAFE_IPS)]
    attachment_name = f"meeting-notes-{i:03d}.txt"

    return {
        "sender": f"ops{i:03d}@company.com",
        "subject": f"Platform Operations Summary #{i:03d}",
        "body": (
            f"Daily operational digest #{i:03d}. SLA targets were met and no suspicious activity was observed. "
            f"Internal reference: {safe_url}."
        ),
        "urls": [safe_url],
        "attachments": [
            _attachment_payload(
                attachment_name,
                f"Safe attachment payload for record {i:03d}.",
            )
        ],
        "headers": _headers_with_ip(safe_ip),
    }


def _suspicious_email(i: int) -> dict[str, object]:
    suspicious_url = SUSPICIOUS_URLS[i % len(SUSPICIOUS_URLS)]
    suspicious_ip = SUSPICIOUS_IPS[i % len(SUSPICIOUS_IPS)]
    attachment_name = f"urgent-invoice-{i:03d}.pdf.js"

    return {
        "sender": f"alerts{i:03d}@security-checkpoint.net",
        "subject": f"Action Required: Verify Session Token {i:03d}",
        "body": (
            f"A sign-in attempt from an unfamiliar browser was detected. Verify your account immediately at {suspicious_url}."
        ),
        "urls": [suspicious_url],
        "attachments": [
            _attachment_payload(
                attachment_name,
                f"Suspicious script-like attachment payload for record {i:03d}.",
            )
        ],
        "headers": _headers_with_ip(suspicious_ip),
    }


def _malicious_email(i: int) -> dict[str, object]:
    malicious_url = MALICIOUS_URLS[i % len(MALICIOUS_URLS)]
    malicious_ip = MALICIOUS_IPS[i % len(MALICIOUS_IPS)]
    attachment_name = f"payment-proof-{i:03d}.exe"

    return {
        "sender": f"no-reply{i:03d}@urgent-security-mail.com",
        "subject": f"Critical Notice: Unauthorized Access Attempt {i:03d}",
        "body": (
            f"Immediate verification is required to protect your account from permanent lock. Continue at {malicious_url} within 30 minutes."
        ),
        "urls": [malicious_url],
        "attachments": [
            _attachment_payload(
                attachment_name,
                f"Malicious executable-style attachment payload for record {i:03d}.",
            )
        ],
        "headers": _headers_with_ip(malicious_ip),
    }


def _build_dataset(total: int) -> list[dict[str, object]]:
    dataset: list[dict[str, object]] = []

    for i in range(total):
        mod = i % 10
        if mod <= 5:
            dataset.append(_safe_email(i + 1))
        elif mod <= 8:
            dataset.append(_suspicious_email(i + 1))
        else:
            dataset.append(_malicious_email(i + 1))

    return dataset


TEST_EMAILS = _build_dataset(TARGET_COUNT)


def seed() -> int:
    """Send all test emails to the analysis endpoint."""
    print("MailFort AI - Seeding database with dynamic test emails...")
    print(f"   Endpoint: {API_URL}")
    print(f"   Total emails: {len(TEST_EMAILS)}\n")

    success = 0
    errors = 0

    for i, email in enumerate(TEST_EMAILS, 1):
        payload = json.dumps(email).encode("utf-8")
        req = urllib.request.Request(
            API_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
                verdict = result.get("result", {}).get("final_verdict", "Unknown")
                log_id = result.get("log_id", "?")
                icon = {"Safe": "[SAFE]", "Suspicious": "[WARN]", "Malicious": "[ALERT]"}.get(verdict, "[UNK]")
                print(
                    f"  [{i:3d}/{len(TEST_EMAILS)}] {icon} {verdict:10s} | "
                    f"{str(email.get('sender', ''))[:35]:35s} | Log #{log_id}"
                )
                success += 1
        except urllib.error.HTTPError as exc:
            print(f"  [{i:3d}/{len(TEST_EMAILS)}] [ERR] HTTP {exc.code} | {str(email.get('sender', ''))[:35]}")
            errors += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i:3d}/{len(TEST_EMAILS)}] [ERR] Error: {exc}")
            errors += 1

    print(f"\n   Done: {success} succeeded, {errors} failed")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(seed())
