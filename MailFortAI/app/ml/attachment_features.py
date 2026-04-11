from __future__ import annotations

import os
from typing import Any

SUSPICIOUS_EXTENSIONS = {'.exe', '.zip', '.scr', '.html', '.htm', '.vbs', '.js', '.jar'}

def extract_attachment_features(attachment_info: dict[str, Any]) -> dict[str, Any]:
    """Extract metadata features for Random Forest attachment analysis."""
    filename = str(attachment_info.get("filename") or "").lower()
    content_type = str(attachment_info.get("content_type") or "").lower()
    size = int(attachment_info.get("size") or 0)
    
    _, ext = os.path.splitext(filename)
    
    features = {
        "file_size": size,
        "is_suspicious_ext": 1 if ext in SUSPICIOUS_EXTENSIONS else 0,
        "is_executable": 1 if ext in {'.exe', '.scr', '.vbs'} else 0,
        "is_archive": 1 if ext in {'.zip', '.rar', '.7z'} else 0,
        "has_double_ext": 1 if filename.count('.') > 1 else 0,
        "is_html_attachment": 1 if ext in {'.html', '.htm'} else 0,
    }
    
    return features
