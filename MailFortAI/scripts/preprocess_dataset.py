from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Tuple

# Ensure `app` imports resolve when this script is executed directly.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.preprocessing.dataset_loader import iter_dataset
from app.preprocessing.email_processor import parse_dataset_row, parse_email
from app.preprocessing.labeler import label_email

logger = logging.getLogger(__name__)
RAW_EMAIL_EXTENSIONS = {".eml", ".txt"}


def preprocess_dataset(
    input_path: Path,
    output_path: Path,
    batch_size: int = 500,
) -> Dict[str, int]:
    """Preprocess raw email data into a structured JSON array."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    stats = {
        "processed": 0,
        "skipped": 0,
        "failed": 0,
    }

    with output_path.open("w", encoding="utf-8") as output_file:
        output_file.write("[\n")
        first_record = True

        for batch in _iter_batches(input_path=input_path, batch_size=batch_size, stats=stats):
            for record in batch:
                if not first_record:
                    output_file.write(",\n")

                json.dump(record, output_file, ensure_ascii=False)
                first_record = False
                stats["processed"] += 1

            logger.info(
                "Progress | processed=%s skipped=%s failed=%s",
                stats["processed"],
                stats["skipped"],
                stats["failed"],
            )

        output_file.write("\n]\n")

    logger.info("Preprocessing complete. Output saved to %s", output_path)
    return stats


def _iter_batches(
    input_path: Path,
    batch_size: int,
    stats: Dict[str, int],
) -> Iterator[List[Dict[str, Any]]]:
    batch: List[Dict[str, Any]] = []

    if input_path.is_dir():
        source_iterable = _iter_from_email_directory(input_path)
    else:
        source_iterable = _iter_from_dataset_file(input_path)

    for record, has_failed in source_iterable:
        if record is None:
            if has_failed:
                stats["failed"] += 1
            else:
                stats["skipped"] += 1
            continue

        batch.append(record)
        if len(batch) >= batch_size:
            yield batch
            batch = []

    if batch:
        yield batch


def _iter_from_email_directory(input_dir: Path) -> Iterable[Tuple[Dict[str, Any] | None, bool]]:
    email_files = [
        path
        for path in input_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in RAW_EMAIL_EXTENSIONS
    ]

    logger.info("Discovered %s raw email files in %s", len(email_files), input_dir)

    for file_path in email_files:
        try:
            parsed = parse_email(str(file_path))
            parsed["label"] = _infer_label_from_path(file_path)
            labeled = label_email(parsed)
            yield _to_output_record(labeled), False
        except Exception as exc:
            logger.warning("Skipping corrupted email file %s: %s", file_path, exc)
            yield None, True


def _iter_from_dataset_file(dataset_path: Path) -> Iterable[Tuple[Dict[str, Any] | None, bool]]:
    logger.info("Streaming dataset from %s", dataset_path)

    for row in iter_dataset(str(dataset_path)):
        try:
            parsed = parse_dataset_row(row)
            labeled = label_email(parsed)
            yield _to_output_record(labeled), False
        except Exception as exc:
            logger.warning("Skipping invalid dataset row: %s", exc)
            yield None, True


def _to_output_record(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "sender": str(record.get("sender", "")),
        "subject": str(record.get("subject", "")),
        "body": str(record.get("body", "")),
        "clean_body": str(record.get("clean_body", "")),
        "urls": _safe_list(record.get("urls", [])),
        "attachments": _safe_list(record.get("attachments", [])),
        "headers": record.get("headers", {}) if isinstance(record.get("headers", {}), dict) else {},
        "label": int(record.get("label", 0)) if str(record.get("label", "")).strip() else 0,
    }


def _safe_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if value in (None, ""):
        return []

    return [str(value).strip()]


def _infer_label_from_path(file_path: Path) -> int:
    parts = {part.lower() for part in file_path.parts}
    if "phishing" in parts or "phish" in parts:
        return 1
    return 0


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="MailFort AI Phase 2 dataset preprocessing")
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input dataset path (.csv/.json/.jsonl) or directory of .eml/.txt files",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/emails.json"),
        help="Output JSON file path (default: data/processed/emails.json)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Number of processed records per write batch (default: 500)",
    )
    parser.add_argument(
        "--remove-stopwords",
        action="store_true",
        help="Enable stopword removal in text normalization",
    )
    parser.add_argument(
        "--stopwords-file",
        type=Path,
        default=None,
        help="Optional stopword file path (one word per line)",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log verbosity (default: INFO)",
    )
    return parser


def main() -> None:
    args = _build_arg_parser().parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if args.batch_size <= 0:
        raise ValueError("--batch-size must be a positive integer")

    if args.remove_stopwords:
        os.environ["MAILFORT_REMOVE_STOPWORDS"] = "true"

    if args.stopwords_file:
        os.environ["MAILFORT_STOPWORDS_FILE"] = str(args.stopwords_file)

    stats = preprocess_dataset(
        input_path=args.input,
        output_path=args.output,
        batch_size=args.batch_size,
    )
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
