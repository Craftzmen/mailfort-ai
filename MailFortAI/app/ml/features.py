from __future__ import annotations

import re
from typing import Iterable, List, Optional, Sequence, Tuple

import numpy as np
from scipy.sparse import csr_matrix, hstack
from sklearn.feature_extraction.text import TfidfVectorizer

URL_PATTERN = re.compile(r"(?:https?://|www\.)[^\s<>\"'()]+", re.IGNORECASE)
SUSPICIOUS_WORDS = {
    "urgent",
    "verify",
    "password",
    "account",
    "login",
    "confirm",
    "security",
    "bank",
    "invoice",
    "immediately",
    "suspended",
    "click",
}

_ACTIVE_VECTORIZER: Optional[TfidfVectorizer] = None


def _ensure_texts(texts: Sequence[str]) -> list[str]:
    return ["" if text is None else str(text) for text in texts]


def _optional_numeric_features(texts: Iterable[str]) -> csr_matrix:
    rows: list[list[float]] = []
    for text in texts:
        raw_text = "" if text is None else str(text)
        lowered = raw_text.lower()
        url_count = float(len(URL_PATTERN.findall(raw_text)))
        suspicious_hits = float(sum(1 for word in SUSPICIOUS_WORDS if word in lowered))
        rows.append([url_count, suspicious_hits])

    if not rows:
        return csr_matrix((0, 2), dtype=np.float32)

    return csr_matrix(np.asarray(rows, dtype=np.float32))


def extract_features(
    texts: List[str],
    vectorizer: Optional[TfidfVectorizer] = None,
    fit: bool = True,
) -> Tuple[csr_matrix, TfidfVectorizer]:
    """Extract TF-IDF n-gram features and optional phishing heuristics."""
    global _ACTIVE_VECTORIZER

    normalized_texts = _ensure_texts(texts)
    fitted_vectorizer = vectorizer or TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
        strip_accents="unicode",
        sublinear_tf=True,
    )

    tfidf = fitted_vectorizer.fit_transform(normalized_texts) if fit else fitted_vectorizer.transform(normalized_texts)
    optional = _optional_numeric_features(normalized_texts)
    combined = hstack([tfidf, optional], format="csr")

    _ACTIVE_VECTORIZER = fitted_vectorizer
    return combined, fitted_vectorizer


def transform_text(
    text: str,
    vectorizer: Optional[TfidfVectorizer] = None,
) -> csr_matrix:
    """Transform a single text using the fitted vectorizer and optional features."""
    fitted_vectorizer = vectorizer or _ACTIVE_VECTORIZER
    if fitted_vectorizer is None:
        raise ValueError("No fitted vectorizer available. Train or load the baseline model first.")

    safe_text = "" if text is None else str(text)
    tfidf = fitted_vectorizer.transform([safe_text])
    optional = _optional_numeric_features([safe_text])
    return hstack([tfidf, optional], format="csr")
