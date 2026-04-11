from __future__ import annotations

import json
import logging
import re
from email import policy
from email.parser import BytesParser
from email.message import Message
from pathlib import Path
from typing import Any, Dict, List

from utils.attachment_utils import extract_attachments_from_eml, extract_attachments_from_msg
from utils.text_utils import normalize_text
from utils.url_utils import extract_urls

logger = logging.getLogger(__name__)


def parse_email_file(file_path: Path, label: str) -> Dict[str, Any]:
    """Parse .eml/.msg file and convert it into the MailFort AI JSON schema."""
    suffix = file_path.suffix.lower()
    if suffix == ".eml":
        parsed = _parse_eml(file_path)
    elif suffix == ".msg":
        parsed = _parse_msg(file_path)
    else:
        raise ValueError(f"Unsupported email extension: {file_path.suffix}")

    parsed["subject"] = normalize_text(parsed.get("subject", ""))
    parsed["body"] = normalize_text(parsed.get("body", ""))
    parsed["urls"] = extract_urls(parsed.get("body", ""))
    parsed["label"] = label

    return {
        "sender": parsed.get("sender", ""),
        "subject": parsed.get("subject", ""),
        "body": parsed.get("body", ""),
        "attachments": parsed.get("attachments", []),
        "urls": parsed.get("urls", []),
        "headers": parsed.get(
            "headers",
            {
                "Received": [],
                "SPF": "",
                "DKIM": "",
                "DMARC": "",
            },
        ),
        "label": label,
    }


def _parse_eml(file_path: Path) -> Dict[str, Any]:
    with file_path.open("rb") as f:
        message = BytesParser(policy=policy.default).parse(f)

    sender = message.get("From", "")
    subject = message.get("Subject", "")
    body = _extract_eml_body(message)
    attachments = extract_attachments_from_eml(message)
    headers = _extract_header_features(message)

    logger.info("Parsed .eml file: %s", file_path)
    return {
        "sender": sender,
        "subject": subject,
        "body": body,
        "attachments": attachments,
        "headers": headers,
    }


def _parse_msg(file_path: Path) -> Dict[str, Any]:
    try:
        import extract_msg  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "extract-msg is required to parse .msg files. Install with: pip install extract-msg"
        ) from exc

    msg = extract_msg.Message(str(file_path))
    sender = getattr(msg, "sender", "") or ""
    subject = getattr(msg, "subject", "") or ""
    body = getattr(msg, "body", "") or ""
    attachments = extract_attachments_from_msg(msg)
    headers = _extract_msg_headers(msg)

    logger.info("Parsed .msg file: %s", file_path)
    return {
        "sender": sender,
        "subject": subject,
        "body": body,
        "attachments": attachments,
        "headers": headers,
    }


def _extract_eml_body(message: Message) -> str:
    if message.is_multipart():
        parts: List[str] = []
        for part in message.walk():
            content_type = part.get_content_type()
            disposition = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue
            if content_type == "text/plain":
                payload = part.get_content()
                if isinstance(payload, str):
                    parts.append(payload)
        if parts:
            return "\n".join(parts)

    payload = message.get_content()
    return payload if isinstance(payload, str) else ""


def _extract_header_features(message: Message) -> Dict[str, Any]:
    received = message.get_all("Received", []) or []
    received_spf = message.get("Received-SPF", "")
    auth_results = message.get("Authentication-Results", "")
    dkim_signature = message.get("DKIM-Signature", "")

    dkim = _find_auth_result(auth_results, "dkim")
    if not dkim and dkim_signature:
        dkim = "present"

    dmarc = _find_auth_result(auth_results, "dmarc")

    return {
        "Received": received,
        "SPF": received_spf,
        "DKIM": dkim,
        "DMARC": dmarc,
    }


def _extract_msg_headers(msg_obj: object) -> Dict[str, Any]:
    raw_headers = getattr(msg_obj, "header", "") or ""
    received = re.findall(r"^Received:\s*(.*)$", raw_headers, flags=re.MULTILINE)

    spf = _match_header_value(raw_headers, "Received-SPF")
    auth_results = _match_header_value(raw_headers, "Authentication-Results")

    dkim = _find_auth_result(auth_results, "dkim")
    dmarc = _find_auth_result(auth_results, "dmarc")

    return {
        "Received": received,
        "SPF": spf,
        "DKIM": dkim,
        "DMARC": dmarc,
    }


def _find_auth_result(auth_results_header: str, key: str) -> str:
    if not auth_results_header:
        return ""
    match = re.search(rf"{re.escape(key)}\s*=\s*([a-zA-Z]+)", auth_results_header, flags=re.IGNORECASE)
    return match.group(1) if match else ""


def _match_header_value(headers_block: str, header_name: str) -> str:
    match = re.search(rf"^{re.escape(header_name)}:\s*(.*)$", headers_block, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def dump_email_json(email_record: Dict[str, Any], destination_path: Path) -> None:
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.write_text(json.dumps(email_record, indent=2), encoding="utf-8")
