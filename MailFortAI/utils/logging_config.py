from __future__ import annotations

import logging
from pathlib import Path


def setup_logging(log_dir: Path, log_name: str = "preprocessing.log") -> None:
    """Configure console + file logging for preprocessing."""
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / log_name

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    if root_logger.handlers:
        root_logger.handlers.clear()

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    root_logger.addHandler(file_handler)
    root_logger.addHandler(stream_handler)
