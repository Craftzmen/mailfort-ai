from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict

from preprocessing.data_collection import collect_datasets
from preprocessing.preprocess_emails import process_dataset
from utils.logging_config import setup_logging

logger = logging.getLogger(__name__)


def run_phase1(
    project_root: Path,
    download_enron: bool = False,
) -> Dict[str, int]:
    """Run full Phase 1: data collection + preprocessing."""
    raw_dir = project_root / "data" / "raw"
    processed_dir = project_root / "data" / "processed"
    reports_dir = project_root / "reports"

    setup_logging(reports_dir)
    logger.info("Running Phase 1 pipeline from project root: %s", project_root)

    collect_datasets(
        raw_data_dir=raw_dir,
        download_enron=download_enron,
    )

    summary = process_dataset(raw_root=raw_dir, processed_root=processed_dir)
    logger.info("Phase 1 pipeline completed.")
    return summary
