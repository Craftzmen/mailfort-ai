from __future__ import annotations

import re
import string
from typing import Iterable

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS


PUNCT_TRANSLATION_TABLE = str.maketrans("", "", string.punctuation)
STOP_WORDS = set(ENGLISH_STOP_WORDS)


def normalize_text(text: str, extra_stopwords: Iterable[str] | None = None) -> str:
    """Lowercase, remove punctuation, remove stopwords, and normalize whitespace."""
    if not text:
        return ""

    tokens = text.lower().translate(PUNCT_TRANSLATION_TABLE)
    tokens = re.sub(r"\s+", " ", tokens).strip().split(" ")

    effective_stopwords = STOP_WORDS.union(set(extra_stopwords or []))
    cleaned_tokens = [token for token in tokens if token and token not in effective_stopwords]

    return " ".join(cleaned_tokens).strip()
