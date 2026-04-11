from __future__ import annotations

import logging
import tarfile
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

ENRON_DATASET_URL = "https://www.cs.cmu.edu/~enron/enron_mail_20150507.tar.gz"


def collect_datasets(
    raw_data_dir: Path,
    download_enron: bool = False,
) -> None:
    """Download public datasets into data/raw for preprocessing."""
    raw_data_dir.mkdir(parents=True, exist_ok=True)

    if download_enron:
        _download_and_extract_enron(raw_data_dir / "enron")
    else:
        logger.info("Skipping Enron download (download_enron=False).")


def _download_and_extract_enron(enron_dir: Path) -> None:
    enron_dir.mkdir(parents=True, exist_ok=True)
    archive_path = enron_dir / "enron_mail_20150507.tar.gz"

    if not archive_path.exists():
        logger.info("Downloading Enron dataset from %s", ENRON_DATASET_URL)
        urllib.request.urlretrieve(ENRON_DATASET_URL, archive_path)
        logger.info("Enron archive downloaded: %s", archive_path)
    else:
        logger.info("Enron archive already exists: %s", archive_path)

    extract_dir = enron_dir / "maildir"
    if extract_dir.exists():
        logger.info("Enron dataset already extracted in: %s", extract_dir)
        return

    logger.info("Extracting Enron dataset...")
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(path=enron_dir)
    logger.info("Enron dataset extracted to: %s", enron_dir)

