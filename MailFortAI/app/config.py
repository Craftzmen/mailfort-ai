"""Centralized configuration loaded from environment / .env file."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# ── Paths ────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[1]

_env_path = PROJECT_ROOT / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

# ── Database ─────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{PROJECT_ROOT / 'mailfort.db'}",
)

# ── CORS ─────────────────────────────────────────────────────────────────
CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

# ── Threat-Intel API Keys ────────────────────────────────────────────────
VIRUSTOTAL_API_KEY: str = os.getenv("VIRUSTOTAL_API_KEY", "")
ABUSEIPDB_API_KEY: str = os.getenv("ABUSEIPDB_API_KEY", "")

# ── Blockchain ─────────────────────────────────────────────────────────────
BLOCKCHAIN_RPC_URL: str = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:7545")
BLOCKCHAIN_CONTRACT_ADDRESS: str = os.getenv("BLOCKCHAIN_CONTRACT_ADDRESS", "").strip()
BLOCKCHAIN_AUTO_DEPLOY: bool = os.getenv("BLOCKCHAIN_AUTO_DEPLOY", "false").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
BLOCKCHAIN_STATE_FILE: Path = Path(
    os.getenv("BLOCKCHAIN_STATE_FILE", str(PROJECT_ROOT / "data" / "blockchain_contract.json"))
)

# ── App Meta ─────────────────────────────────────────────────────────────
APP_TITLE = "MailFort AI"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = (
    "Email threat intelligence and phishing detection API. "
    "Provides AI-driven analysis, URL/attachment scanning, and IP reputation checks."
)
