from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def collect_datasets(
    raw_data_dir: Path,
) -> None:
    """Prepare public datasets in data/raw for preprocessing."""
    raw_data_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Using datasets present in %s", raw_data_dir)


