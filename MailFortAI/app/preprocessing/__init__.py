"""Phase 2 preprocessing utilities for MailFort AI."""

from app.preprocessing.dataset_loader import iter_dataset, load_dataset
from app.preprocessing.email_processor import (
    clean_text,
    extract_urls,
    normalize_text,
    parse_email,
    parse_dataset_row,
)
from app.preprocessing.labeler import label_email

__all__ = [
    "parse_email",
    "parse_dataset_row",
    "extract_urls",
    "clean_text",
    "normalize_text",
    "load_dataset",
    "iter_dataset",
    "label_email",
]
