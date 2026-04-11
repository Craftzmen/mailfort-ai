from __future__ import annotations

import re
from typing import List


URL_PATTERN = re.compile(
    r"((?:https?://|www\.)[^\s<>\"'()]+)",
    re.IGNORECASE,
)


def extract_urls(text: str) -> List[str]:
    """Extract all URLs from text in occurrence order."""
    if not text:
        return []

    urls = URL_PATTERN.findall(text)
    # Preserve order while removing duplicates.
    return list(dict.fromkeys(urls))
