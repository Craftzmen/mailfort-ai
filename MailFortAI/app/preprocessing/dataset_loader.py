from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Any, Dict, Iterator, List, Mapping

logger = logging.getLogger(__name__)

COLUMN_MAP = {
    "from": "sender",
    "sender": "sender",
    "sender_email": "sender",
    "email_from": "sender",
    "to": "recipient",
    "recipient": "recipient",
    "receiver": "recipient",
    "email_to": "recipient",
    "subject": "subject",
    "title": "subject",
    "body": "body",
    "content": "body",
    "message": "body",
    "text": "body",
    "email_body": "body",
    "url": "urls",
    "urls": "urls",
    "link": "urls",
    "links": "urls",
    "attachment": "attachments",
    "attachments": "attachments",
    "file": "attachments",
    "files": "attachments",
    "header": "headers",
    "headers": "headers",
    "email_headers": "headers",
    "label": "label",
    "target": "label",
    "class": "label",
    "is_phishing": "label",
    "phishing": "label",
}


def load_dataset(file_path: str) -> List[Dict[str, Any]]:
    """Load an entire dataset file into memory with normalized column names."""
    return list(iter_dataset(file_path))


def iter_dataset(file_path: str) -> Iterator[Dict[str, Any]]:
    """Stream dataset rows from CSV/JSON/JSONL with normalized columns."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    suffix = path.suffix.lower()
    if suffix == ".csv":
        yield from _iter_csv(path)
        return

    if suffix == ".json":
        yield from _iter_json(path)
        return

    if suffix == ".jsonl":
        yield from _iter_jsonl(path)
        return

    raise ValueError(f"Unsupported dataset format: {path.suffix}")


def normalize_column_names(record: Mapping[str, Any]) -> Dict[str, Any]:
    """Normalize dataset column names to a shared schema."""
    normalized: Dict[str, Any] = {}

    for key, value in record.items():
        key_lower = str(key).strip().lower()
        canonical_key = COLUMN_MAP.get(key_lower, key_lower)

        if canonical_key in {"urls", "attachments"} and canonical_key in normalized:
            normalized[canonical_key] = _merge_values(normalized[canonical_key], value)
        elif canonical_key == "headers" and canonical_key in normalized:
            normalized[canonical_key] = _merge_headers(normalized[canonical_key], value)
        else:
            normalized[canonical_key] = value

    for required in ("sender", "recipient", "subject", "body", "urls", "attachments", "headers"):
        normalized.setdefault(required, "" if required in {"sender", "recipient", "subject", "body"} else [])

    if "headers" not in normalized or not isinstance(normalized["headers"], dict):
        normalized["headers"] = {}

    return normalized


def _iter_csv(path: Path) -> Iterator[Dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file_obj:
        reader = csv.DictReader(file_obj)
        for row_number, row in enumerate(reader, start=2):
            if row is None:
                continue
            try:
                yield normalize_column_names(row)
            except Exception as exc:
                logger.warning("Skipping invalid CSV row %s in %s: %s", row_number, path, exc)


def _iter_json(path: Path) -> Iterator[Dict[str, Any]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON dataset: {path}") from exc

    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("records") or payload.get("data") or payload.get("emails") or []
        if not isinstance(rows, list):
            logger.warning("JSON dataset did not contain a list under records/data/emails: %s", path)
            rows = []
    else:
        logger.warning("Unexpected JSON dataset type in %s", path)
        rows = []

    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            logger.warning("Skipping non-object JSON record at index %s in %s", index, path)
            continue
        try:
            yield normalize_column_names(row)
        except Exception as exc:
            logger.warning("Skipping invalid JSON record index %s in %s: %s", index, path, exc)


def _iter_jsonl(path: Path) -> Iterator[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file_obj:
        for line_number, line in enumerate(file_obj, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                row = json.loads(stripped)
            except json.JSONDecodeError:
                logger.warning("Skipping invalid JSONL line %s in %s", line_number, path)
                continue

            if not isinstance(row, dict):
                logger.warning("Skipping non-object JSONL line %s in %s", line_number, path)
                continue

            yield normalize_column_names(row)


def _merge_values(left: Any, right: Any) -> List[Any]:
    left_values = left if isinstance(left, list) else [left]
    right_values = right if isinstance(right, list) else [right]

    merged: List[Any] = []
    for item in [*left_values, *right_values]:
        if item in (None, ""):
            continue
        merged.append(item)
    return merged


def _merge_headers(left: Any, right: Any) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    if isinstance(left, dict):
        merged.update(left)
    if isinstance(right, dict):
        merged.update(right)
    return merged
