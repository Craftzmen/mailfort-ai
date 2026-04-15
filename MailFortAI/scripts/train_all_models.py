from __future__ import annotations

import argparse
import pandas as pd
import pickle
from pathlib import Path
import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from app.ml.url_features import extract_url_features
from app.ml.header_features import extract_header_features
from app.ml.attachment_features import extract_attachment_features
from app.config import PROJECT_ROOT

DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_URL_DATASET = DATA_DIR / "malicious_phish.csv"
DEFAULT_HEADER_DATASET = DATA_DIR / "header_auth_dataset.csv"
DEFAULT_ATTACHMENT_DATASET = DATA_DIR / "attachment_dataset.csv"


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train all MailFort AI local models")
    parser.add_argument(
        "--url-dataset",
        type=Path,
        default=DEFAULT_URL_DATASET,
        help="CSV for URL model (requires url,type columns)",
    )
    parser.add_argument(
        "--header-dataset",
        type=Path,
        default=DEFAULT_HEADER_DATASET,
        help=(
            "CSV for header model (dedicated header-auth schema). Requires label plus "
            "auth/header columns like "
            "spf_result, dkim_result, dmarc_result, num_received_headers, reply_to, from_address)"
        ),
    )
    parser.add_argument(
        "--attachment-dataset",
        type=Path,
        default=DEFAULT_ATTACHMENT_DATASET,
        help=(
            "CSV for attachment model (dedicated attachment schema) requiring "
            "label, filename, content_type, size columns (aliases supported). "
            "This model no longer trains from synthetic attachment rows."
        ),
    )
    parser.add_argument(
        "--skip-aggregator",
        action="store_true",
        help="Skip training aggregator model (it still uses synthetic score generation).",
    )
    return parser


def _ensure_local_dataset(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    first_line = path.read_text(encoding="utf-8", errors="ignore").splitlines()[0:1]
    if first_line and first_line[0].strip() == "version https://git-lfs.github.com/spec/v1":
        raise ValueError(
            f"Dataset {path} is a Git LFS pointer, not the real file. Run 'git lfs pull' and retry."
        )


def _require_columns(df: pd.DataFrame, required: set[str], dataset_name: str) -> None:
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(
            f"{dataset_name} missing required columns: {missing}. "
            f"Found: {sorted(df.columns.tolist())}"
        )


def _resolve_required_aliases(
    df: pd.DataFrame,
    required_aliases: dict[str, list[str]],
    dataset_name: str,
) -> dict[str, str]:
    available = set(df.columns)
    resolved: dict[str, str] = {}
    missing: list[str] = []

    for canonical, aliases in required_aliases.items():
        selected = next((alias for alias in aliases if alias in available), None)
        if selected is None:
            missing.append(f"{canonical} (accepted: {aliases})")
        else:
            resolved[canonical] = selected

    if missing:
        raise ValueError(
            f"{dataset_name} missing required schema fields: {missing}. "
            f"Found columns: {sorted(df.columns.tolist())}"
        )

    return resolved


def _normalize_label(value: object) -> int:
    raw = str(value).strip().lower()
    if raw in {"1", "phishing", "malicious", "fraud", "spam", "true", "yes"}:
        return 1
    if raw in {"0", "safe", "legitimate", "ham", "benign", "false", "no"}:
        return 0
    return 1 if "phish" in raw else 0

def train_url_model(dataset_path: Path) -> None:
    print("Training URL Model (XGBoost)...")
    _ensure_local_dataset(dataset_path)
    df = pd.read_csv(dataset_path).head(50000)  # Sample for speed
    _require_columns(df, {"url", "type"}, "URL dataset")
    
    # Feature extraction
    X = []
    for url in df['url']:
        X.append(extract_url_features(url))
    
    X_df = pd.DataFrame(X)
    y = df['type'].map({'benign': 0, 'phishing': 1, 'defacement': 1, 'malware': 1}).fillna(1)
    
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2)
    
    model = xgb.XGBClassifier()
    model.fit(X_train, y_train)
    
    print(classification_report(y_test, model.predict(X_test)))
    
    with open(MODELS_DIR / "url_xgboost.pkl", "wb") as f:
        pickle.dump(model, f)

def train_header_model(dataset_path: Path) -> None:
    print("Training Header Model (XGBoost)...")
    _ensure_local_dataset(dataset_path)
    raw_df = pd.read_csv(dataset_path).head(20000)

    required_aliases = {
        "label": ["label"],
        "spf_result": ["spf_result", "spf", "spf_status"],
        "dkim_result": ["dkim_result", "dkim", "dkim_status"],
        "dmarc_result": ["dmarc_result", "dmarc", "dmarc_status"],
        "num_received_headers": ["num_received_headers", "received_count", "num_received"],
        "reply_to": ["reply_to", "replyto"],
        "from_address": ["from_address", "from", "sender"],
    }
    resolved = _resolve_required_aliases(raw_df, required_aliases, "Header dataset")

    normalized_rows = []
    for _, row in raw_df.iterrows():
        record = row.to_dict()
        normalized_rows.append(
            {
                "spf_result": record.get(resolved["spf_result"], ""),
                "dkim_result": record.get(resolved["dkim_result"], ""),
                "dmarc_result": record.get(resolved["dmarc_result"], ""),
                "num_received_headers": record.get(resolved["num_received_headers"], 0),
                "reply_to": record.get(resolved["reply_to"], ""),
                "from_address": record.get(resolved["from_address"], ""),
                "label": _normalize_label(record.get(resolved["label"])),
            }
        )

    df = pd.DataFrame(normalized_rows)
    _require_columns(
        df,
        {
            "label",
            "spf_result",
            "dkim_result",
            "dmarc_result",
            "num_received_headers",
            "reply_to",
            "from_address",
        },
        "Header dataset (normalized)",
    )
    if df.empty:
        raise ValueError("Header dataset did not produce any rows after normalization.")
    for required_value_col in ["spf_result", "dkim_result", "dmarc_result", "from_address"]:
        if (df[required_value_col].astype(str).str.strip() == "").all():
            raise ValueError(
                f"Header dataset has no usable values for required field '{required_value_col}'."
            )
    
    X = []
    for _, row in df.iterrows():
        X.append(extract_header_features(row.to_dict()))
        
    X_df = pd.DataFrame(X)
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2)
    
    model = xgb.XGBClassifier()
    model.fit(X_train, y_train)
    
    print(classification_report(y_test, model.predict(X_test)))
    
    with open(MODELS_DIR / "header_xgboost.pkl", "wb") as f:
        pickle.dump(model, f)

def train_attachment_model(dataset_path: Path) -> None:
    print("Training Attachment Model (Random Forest)...")
    _ensure_local_dataset(dataset_path)
    raw_df = pd.read_csv(dataset_path).head(20000)

    required_aliases = {
        "label": ["label"],
        "filename": ["filename", "file_name", "attachment", "name"],
        "content_type": ["content_type", "mime_type", "attachment_content_type"],
        "size": ["size", "file_size", "attachment_size"],
    }
    resolved = _resolve_required_aliases(raw_df, required_aliases, "Attachment dataset")

    rows = []
    for _, row in raw_df.iterrows():
        record = row.to_dict()
        rows.append(
            {
                "filename": record.get(resolved["filename"], ""),
                "content_type": record.get(resolved["content_type"], ""),
                "size": record.get(resolved["size"], 0),
                "label": _normalize_label(record.get(resolved["label"])),
            }
        )

    df = pd.DataFrame(rows)
    _require_columns(df, {"filename", "content_type", "size", "label"}, "Attachment dataset (normalized)")
    if df.empty:
        raise ValueError("Attachment dataset did not produce any rows after normalization.")
    df["size"] = pd.to_numeric(df["size"], errors="coerce").fillna(0).astype(int)
    if (df["filename"].astype(str).str.strip() == "").all():
        raise ValueError("Attachment dataset does not contain usable filename values.")
    if (df["content_type"].astype(str).str.strip() == "").all():
        raise ValueError("Attachment dataset does not contain usable content_type values.")
    
    X = []
    for _, row in df.iterrows():
        X.append(
            extract_attachment_features(
                {
                    "filename": row["filename"],
                    "content_type": row["content_type"],
                    "size": row["size"],
                }
            )
        )
        
    X_df = pd.DataFrame(X)
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2)
    
    model = RandomForestClassifier()
    model.fit(X_train, y_train)
    
    with open(MODELS_DIR / "attachment_rf.pkl", "wb") as f:
        pickle.dump(model, f)

def train_aggregator() -> None:
    print("Training Meta-Aggregator (Logistic Regression)...")
    # Simulate scores for aggregator training
    import numpy as np
    X = np.random.rand(1000, 4) * 100 # NLP, URL, Header, Attachment
    y = (X[:, 0] * 0.4 + X[:, 1] * 0.3 + X[:, 2] * 0.2 + X[:, 3] * 0.1 > 50).astype(int)
    
    model = LogisticRegression()
    model.fit(X, y)
    
    with open(MODELS_DIR / "aggregator_logistic.pkl", "wb") as f:
        pickle.dump(model, f)


def main() -> None:
    args = _build_arg_parser().parse_args()

    train_url_model(args.url_dataset)
    train_header_model(args.header_dataset)
    train_attachment_model(args.attachment_dataset)
    if not args.skip_aggregator:
        train_aggregator()

    print("Training complete. Models saved to /models.")


if __name__ == "__main__":
    main()
