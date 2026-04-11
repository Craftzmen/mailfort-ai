from __future__ import annotations

from typing import Any, Dict

PHISHING_LABELS = {
    "1",
    "phishing",
    "malicious",
    "fraud",
    "spam",
    "true",
    "yes",
}
SAFE_LABELS = {
    "0",
    "safe",
    "legitimate",
    "ham",
    "benign",
    "normal",
    "false",
    "no",
}


def label_email(record: Dict[str, Any]) -> Dict[str, Any]:
    """Assign integer ML label where 0=safe and 1=phishing."""
    labeled = dict(record)
    raw_label = _find_label_value(labeled)

    if isinstance(raw_label, bool):
        labeled["label"] = int(raw_label)
        return labeled

    if isinstance(raw_label, int):
        labeled["label"] = 1 if raw_label == 1 else 0
        return labeled

    if raw_label is None:
        labeled["label"] = 0
        return labeled

    value = str(raw_label).strip().lower()
    if value in PHISHING_LABELS:
        labeled["label"] = 1
    elif value in SAFE_LABELS:
        labeled["label"] = 0
    else:
        labeled["label"] = 0

    return labeled


def _find_label_value(record: Dict[str, Any]) -> Any:
    if "label" in record:
        return record["label"]

    for key in ("target", "class", "is_phishing", "phishing"):
        if key in record:
            return record[key]

    return None
