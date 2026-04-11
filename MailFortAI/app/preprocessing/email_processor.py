from __future__ import annotations

import html
import json
import logging
import os
import re
from email import policy
from email.message import Message
from email.parser import BytesParser
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping

logger = logging.getLogger(__name__)

URL_PATTERN = re.compile(r"((?:https?://|www\.)[^\s<>\"'()]+)", re.IGNORECASE)
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9\s]")
WHITESPACE_PATTERN = re.compile(r"\s+")

DEFAULT_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
}


def parse_email(file_path: str) -> Dict[str, Any]:
    """Parse a raw email file (.eml or .txt) into a structured dictionary."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Email file not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix == ".eml":
        record = _parse_eml(path)
    elif suffix == ".txt":
        record = _parse_text_email(path)
    else:
        raise ValueError(f"Unsupported email extension: {path.suffix}")

    body = str(record.get("body", ""))
    record["urls"] = extract_urls(body)
    record["clean_body"] = normalize_text(body)
    record.setdefault("attachments", [])
    record.setdefault("headers", {})
    return record


def parse_dataset_row(record: Mapping[str, Any]) -> Dict[str, Any]:
    """Parse a dataset row into a common structured email shape."""
    sender = _to_text(record.get("sender"))
    recipient = _to_text(record.get("recipient"))
    subject = _to_text(record.get("subject"))
    body = _to_text(record.get("body"))

    attachments = _coerce_list(record.get("attachments"))
    header_map = _coerce_headers(record.get("headers"))

    row_urls = _coerce_list(record.get("urls"))
    body_urls = extract_urls(body)
    urls = list(dict.fromkeys([*row_urls, *body_urls]))

    parsed: Dict[str, Any] = {
        "sender": sender,
        "recipient": recipient,
        "subject": subject,
        "body": body,
        "clean_body": normalize_text(body),
        "urls": urls,
        "attachments": attachments,
        "headers": header_map,
    }

    if "label" in record:
        parsed["label"] = record.get("label")

    return parsed


def extract_urls(text: str) -> List[str]:
    """Extract URLs from text while preserving order and removing duplicates."""
    if not text:
        return []
    return list(dict.fromkeys(URL_PATTERN.findall(text)))


def clean_text(text: str) -> str:
    """Backward-compatible text cleaner for preprocessing."""
    return normalize_text(text)


def normalize_text(text: str) -> str:
    """Normalize text for ML use by stripping HTML/noise and standardizing casing."""
    if not text:
        return ""

    cleaned = html.unescape(text)
    cleaned = HTML_TAG_PATTERN.sub(" ", cleaned)
    cleaned = cleaned.lower()
    cleaned = NON_ALNUM_PATTERN.sub(" ", cleaned)

    if _is_stopword_removal_enabled():
        stopwords = _load_stopwords()
        words = [word for word in cleaned.split() if word not in stopwords]
        cleaned = " ".join(words)

    cleaned = WHITESPACE_PATTERN.sub(" ", cleaned).strip()
    return cleaned


def _parse_eml(path: Path) -> Dict[str, Any]:
    with path.open("rb") as file_obj:
        message = BytesParser(policy=policy.default).parse(file_obj)

    sender = message.get("From", "") or ""
    recipient = message.get("To", "") or ""
    subject = message.get("Subject", "") or ""
    body = _extract_eml_body(message)
    attachments = _extract_eml_attachments(message)

    return {
        "sender": sender,
        "recipient": recipient,
        "subject": subject,
        "body": body,
        "attachments": attachments,
        "headers": _headers_to_dict(message),
    }


def _parse_text_email(path: Path) -> Dict[str, Any]:
    raw_content = path.read_text(encoding="utf-8", errors="ignore")
    header_block, body = _split_headers_body(raw_content)

    headers = _parse_headers_block(header_block)
    sender = headers.get("From", "")
    recipient = headers.get("To", "")
    subject = headers.get("Subject", "")

    return {
        "sender": sender,
        "recipient": recipient,
        "subject": subject,
        "body": body,
        "attachments": [],
        "headers": headers,
    }


def _extract_eml_body(message: Message) -> str:
    if message.is_multipart():
        text_parts: List[str] = []
        html_parts: List[str] = []
        for part in message.walk():
            disposition = (part.get("Content-Disposition") or "").lower()
            if "attachment" in disposition:
                continue

            content_type = part.get_content_type()
            content = part.get_content()
            if not isinstance(content, str):
                continue

            if content_type == "text/plain":
                text_parts.append(content)
            elif content_type == "text/html":
                html_parts.append(content)

        if text_parts:
            return "\n".join(text_parts)
        if html_parts:
            return "\n".join(html_parts)
        return ""

    payload = message.get_content()
    return payload if isinstance(payload, str) else ""


def _extract_eml_attachments(message: Message) -> List[str]:
    files: List[str] = []
    for part in message.walk():
        disposition = (part.get("Content-Disposition") or "").lower()
        filename = part.get_filename()
        if "attachment" in disposition and filename:
            files.append(filename)
    return files


def _headers_to_dict(message: Message) -> Dict[str, Any]:
    headers: Dict[str, Any] = {}
    for key in message.keys():
        values = message.get_all(key, failobj=[])
        if len(values) == 1:
            headers[key] = values[0]
        else:
            headers[key] = values
    return headers


def _split_headers_body(raw_content: str) -> tuple[str, str]:
    separator = "\n\n"
    if "\r\n\r\n" in raw_content:
        separator = "\r\n\r\n"

    if separator in raw_content:
        head, body = raw_content.split(separator, 1)
        return head, body

    return "", raw_content


def _parse_headers_block(header_block: str) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    for line in header_block.splitlines():
        if not line.strip() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        headers[key.strip()] = value.strip()
    return headers


def _coerce_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [_to_text(item) for item in value if _to_text(item)]
    if isinstance(value, tuple):
        return [_to_text(item) for item in value if _to_text(item)]
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return []
        if candidate.startswith("[") and candidate.endswith("]"):
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, list):
                    return [_to_text(item) for item in parsed if _to_text(item)]
            except json.JSONDecodeError:
                pass
        return [_to_text(item) for item in candidate.split(",") if _to_text(item)]
    return [_to_text(value)] if _to_text(value) else []


def _coerce_headers(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return {}

        if stripped.startswith("{") and stripped.endswith("}"):
            try:
                loaded = json.loads(stripped)
                if isinstance(loaded, dict):
                    return loaded
            except json.JSONDecodeError:
                logger.warning("Unable to decode header JSON text")

        return {"raw": stripped}

    return {}


def _to_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _is_stopword_removal_enabled() -> bool:
    return os.getenv("MAILFORT_REMOVE_STOPWORDS", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _load_stopwords() -> set[str]:
    custom_stopword_file = os.getenv("MAILFORT_STOPWORDS_FILE", "").strip()
    if not custom_stopword_file:
        return DEFAULT_STOPWORDS

    stopword_path = Path(custom_stopword_file)
    if not stopword_path.exists():
        logger.warning("Stopword file not found: %s", stopword_path)
        return DEFAULT_STOPWORDS

    lines: Iterable[str] = stopword_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    words = {line.strip().lower() for line in lines if line.strip()}
    return words or DEFAULT_STOPWORDS
