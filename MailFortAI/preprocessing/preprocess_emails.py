from __future__ import annotations

import argparse
import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, List

from utils.email_parser import dump_email_json, parse_email_file

logger = logging.getLogger(__name__)
SUPPORTED_EMAIL_EXTENSIONS = {".eml", ".msg"}


def process_dataset(raw_root: Path, processed_root: Path) -> Dict[str, int]:
    """Process raw phishing and legitimate email folders to normalized JSON."""
    logger.info("Starting dataset preprocessing...")
    processed_root.mkdir(parents=True, exist_ok=True)

    summary = {
        "legitimate_count": 0,
        "phishing_count": 0,
        "total_count": 0,
        "failed_count": 0,
    }

    summary["legitimate_count"] = _process_directory(
        input_dir=raw_root / "enron",
        output_dir=processed_root / "legitimate",
        label="legitimate",
        summary=summary,
    )
    summary["phishing_count"] = _process_directory(
        input_dir=raw_root / "phishing",
        output_dir=processed_root / "phishing",
        label="phishing",
        summary=summary,
    )

    summary["total_count"] = summary["legitimate_count"] + summary["phishing_count"]
    _build_jsonl_index(processed_root)

    logger.info("Completed preprocessing. Summary: %s", summary)
    return summary


def _process_directory(
    input_dir: Path,
    output_dir: Path,
    label: str,
    summary: Dict[str, int],
) -> int:
    if not input_dir.exists():
        logger.warning("Input directory does not exist: %s", input_dir)
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0

    email_files = [
        p
        for p in input_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in SUPPORTED_EMAIL_EXTENSIONS
    ]

    logger.info("Found %d %s files in %s", len(email_files), label, input_dir)

    for email_path in email_files:
        try:
            record = parse_email_file(email_path, label=label)
            output_file = output_dir / _build_output_filename(email_path)
            dump_email_json(record, output_file)
            count += 1
        except Exception:
            summary["failed_count"] += 1
            logger.exception("Failed to parse email file: %s", email_path)

    logger.info("Processed %d %s emails", count, label)
    return count


def _build_output_filename(email_path: Path) -> str:
    file_hash = hashlib.sha256(str(email_path).encode("utf-8")).hexdigest()[:12]
    safe_stem = "".join(ch if ch.isalnum() else "_" for ch in email_path.stem)[:50]
    return f"{safe_stem}_{file_hash}.json"


def _build_jsonl_index(processed_root: Path) -> None:
    index_path = processed_root / "dataset.jsonl"
    records: List[Path] = sorted(processed_root.rglob("*.json"))

    with index_path.open("w", encoding="utf-8") as out:
        for record_path in records:
            if record_path.name == index_path.name:
                continue
            try:
                data = json.loads(record_path.read_text(encoding="utf-8"))
                out.write(json.dumps(data, ensure_ascii=False) + "\n")
            except Exception:
                logger.exception("Failed to include record in dataset index: %s", record_path)

    logger.info("Created dataset index: %s", index_path)


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="MailFort AI Phase 1 preprocessing")
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path("data/raw"),
        help="Path to raw dataset root (default: data/raw)",
    )
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=Path("data/processed"),
        help="Path to processed output directory (default: data/processed)",
    )
    return parser


def main() -> None:
    args = _build_arg_parser().parse_args()
    process_dataset(args.raw_dir, args.processed_dir)


if __name__ == "__main__":
    main()
