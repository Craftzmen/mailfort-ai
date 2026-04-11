from __future__ import annotations

import re
import math
import urllib.parse
from typing import Any

def get_url_length(url: str) -> int:
    return len(url)

def get_subdomain_count(url: str) -> int:
    try:
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc
        # split by dots and ignore common TLDs or empty parts
        parts = [p for p in netloc.split('.') if p]
        return max(0, len(parts) - 2)
    except:
        return 0

def get_path_depth(url: str) -> int:
    try:
        parsed = urllib.parse.urlparse(url)
        return len([p for p in parsed.path.split('/') if p])
    except:
        return 0

def get_entropy(text: str) -> float:
    if not text:
        return 0.0
    prob = [float(text.count(c)) / len(text) for c in dict.fromkeys(list(text))]
    return - sum([p * math.log(p) / math.log(2.0) for p in prob])

def get_special_char_count(url: str) -> int:
    # Special characters often used in phishing
    special_chars = "@?=&-_%."
    return sum(url.count(c) for c in special_chars)

def get_digit_ratio(url: str) -> float:
    digits = sum(c.isdigit() for c in url)
    return digits / len(url) if len(url) > 0 else 0.0

def extract_url_features(url: str) -> dict[str, Any]:
    """Extract 65 engineered features for XGBoost URL analysis."""
    # For now, we'll implement the core ones. In a full implementation, we'd add more.
    features = {
        "url_length": get_url_length(url),
        "subdomain_count": get_subdomain_count(url),
        "path_depth": get_path_depth(url),
        "entropy": get_entropy(url),
        "special_char_count": get_special_char_count(url),
        "digit_ratio": get_digit_ratio(url),
        "has_ip": 1 if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', url) else 0,
        "use_https": 1 if url.startswith("https") else 0,
        "is_shortened": 1 if any(s in url for s in ["bit.ly", "goo.gl", "tinyurl.com", "t.co"]) else 0,
    }
    # Pad with placeholders to simulate the 65 features if needed, 
    # but for training we'll just use these solid ones.
    return features
