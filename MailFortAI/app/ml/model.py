from __future__ import annotations

import json
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split

from app.ml.features import extract_features, transform_text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = PROJECT_ROOT / "models"
LOGISTIC_MODEL_PATH = MODELS_DIR / "logistic_model.pkl"
BERT_MODEL_DIR = MODELS_DIR / "bert"
DEFAULT_DATASET_PATH = PROJECT_ROOT / "data" / "processed" / "emails.json"
FALLBACK_JSONL_PATH = PROJECT_ROOT / "data" / "processed" / "dataset.jsonl"

POSITIVE_LABELS = {"1", "phishing", "malicious", "fraud", "spam"}
NEGATIVE_LABELS = {"0", "safe", "legitimate", "ham", "benign"}


@dataclass
class SplitDataset:
    train_texts: list[str]
    test_texts: list[str]
    train_labels: list[int]
    test_labels: list[int]


def _label_to_int(label: Any) -> int:
    if isinstance(label, bool):
        return int(label)
    if isinstance(label, (int, np.integer)):
        return 1 if int(label) == 1 else 0

    value = str(label).strip().lower()
    if value in POSITIVE_LABELS:
        return 1
    if value in NEGATIVE_LABELS:
        return 0
    return 1 if "phish" in value else 0


def _load_json_records(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        return [payload]
    return []


def _load_jsonl_records(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        try:
            row = json.loads(stripped)
            if isinstance(row, dict):
                records.append(row)
        except json.JSONDecodeError:
            continue
    return records


def _records_from_processed_tree(processed_dir: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for json_file in sorted(processed_dir.rglob("*.json")):
        if json_file.name == "emails.json":
            records.extend(_load_json_records(json_file))
            continue

        try:
            payload = json.loads(json_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

        if isinstance(payload, dict):
            records.append(payload)
        elif isinstance(payload, list):
            records.extend([row for row in payload if isinstance(row, dict)])
    return records


def load_processed_dataset(dataset_path: Optional[Path] = None) -> pd.DataFrame:
    """Load processed emails and normalize to clean_body + binary label."""
    target = dataset_path or DEFAULT_DATASET_PATH
    records: list[dict[str, Any]] = []

    if target.exists():
        if target.suffix.lower() == ".jsonl":
            records = _load_jsonl_records(target)
        else:
            records = _load_json_records(target)
    elif FALLBACK_JSONL_PATH.exists():
        records = _load_jsonl_records(FALLBACK_JSONL_PATH)
    else:
        processed_root = PROJECT_ROOT / "data" / "processed"
        if processed_root.exists():
            records = _records_from_processed_tree(processed_root)

    if not records:
        raise FileNotFoundError(
            "No processed dataset found. Expected data/processed/emails.json or data/processed/dataset.jsonl"
        )

    rows: list[dict[str, Any]] = []
    for record in records:
        clean_body = str(record.get("clean_body") or record.get("body") or "").strip()
        if not clean_body:
            continue

        if "label" not in record:
            continue

        rows.append(
            {
                "clean_body": clean_body,
                "label": _label_to_int(record.get("label")),
            }
        )

    if not rows:
        raise ValueError("Processed dataset did not contain usable clean_body + label rows.")

    return pd.DataFrame(rows)


def prepare_dataset_split(
    dataset_path: Optional[Path] = None,
    test_size: float = 0.2,
    random_state: int = 42,
) -> SplitDataset:
    """Prepare train/test split (80/20 by default) from processed emails."""
    df = load_processed_dataset(dataset_path)

    texts = df["clean_body"].astype(str).tolist()
    labels = df["label"].astype(int).tolist()

    unique_labels = set(labels)
    stratify = labels if len(unique_labels) > 1 else None

    X_train, X_test, y_train, y_test = train_test_split(
        texts,
        labels,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    return SplitDataset(
        train_texts=list(X_train),
        test_texts=list(X_test),
        train_labels=[int(v) for v in y_train],
        test_labels=[int(v) for v in y_test],
    )


def train_logistic_regression(
    X: Sequence[str],
    y: Sequence[int],
) -> tuple[LogisticRegression, Any]:
    """Train baseline TF-IDF + Logistic Regression model."""
    features, vectorizer = extract_features(list(X), fit=True)

    model = LogisticRegression(max_iter=1200, class_weight="balanced")
    model.fit(features, list(y))
    return model, vectorizer


def save_logistic_model(
    model: LogisticRegression,
    vectorizer: Any,
    destination: Path = LOGISTIC_MODEL_PATH,
) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        pickle.dump({"model": model, "vectorizer": vectorizer}, handle)
    return destination


def load_logistic_model(source: Path = LOGISTIC_MODEL_PATH) -> tuple[LogisticRegression, Any]:
    with source.open("rb") as handle:
        payload = pickle.load(handle)

    model = payload.get("model")
    vectorizer = payload.get("vectorizer")
    if model is None or vectorizer is None:
        raise ValueError("Invalid logistic model file: missing model/vectorizer")

    return model, vectorizer


def evaluate_logistic(
    model: LogisticRegression,
    vectorizer: Any,
    X_test: Sequence[str],
    y_test: Sequence[int],
) -> dict[str, float]:
    transformed = extract_features(list(X_test), vectorizer=vectorizer, fit=False)[0]
    predictions = model.predict(transformed)
    precision, recall, f1, _ = precision_recall_fscore_support(
        list(y_test),
        predictions,
        average="binary",
        zero_division=0,
    )
    return {
        "accuracy": float(accuracy_score(list(y_test), predictions)),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
    }


def train_bert_model(dataset: Mapping[str, Sequence[Any]]) -> dict[str, Any]:
    """Fine-tune bert-base-uncased using HuggingFace Trainer API."""
    try:
        import torch
        from torch.utils.data import Dataset
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            Trainer,
            TrainingArguments,
        )
    except ImportError as exc:
        raise ImportError(
            "BERT training requires torch and transformers. Install dependencies from requirements.txt"
        ) from exc

    class EmailDataset(Dataset):
        def __init__(self, encodings: Mapping[str, Any], labels: Sequence[int]) -> None:
            self.encodings = encodings
            self.labels = [int(v) for v in labels]

        def __len__(self) -> int:
            return len(self.labels)

        def __getitem__(self, idx: int) -> dict[str, Any]:
            item = {key: value[idx] for key, value in self.encodings.items()}
            item["labels"] = torch.tensor(self.labels[idx], dtype=torch.long)
            return item

    def _extract(key: str) -> list[Any]:
        if key not in dataset:
            raise ValueError(f"Missing '{key}' in dataset mapping")
        return list(dataset[key])

    train_texts = [str(v) for v in _extract("train_texts")]
    train_labels = [int(v) for v in _extract("train_labels")]
    test_texts = [str(v) for v in _extract("test_texts")]
    test_labels = [int(v) for v in _extract("test_labels")]

    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
    model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased", num_labels=2)

    train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=256)
    test_encodings = tokenizer(test_texts, truncation=True, padding=True, max_length=256)

    train_dataset = EmailDataset(train_encodings, train_labels)
    test_dataset = EmailDataset(test_encodings, test_labels)

    def compute_metrics(eval_pred: Any) -> dict[str, float]:
        logits, labels = eval_pred
        predictions = np.argmax(logits, axis=1)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels,
            predictions,
            average="binary",
            zero_division=0,
        )
        return {
            "accuracy": float(accuracy_score(labels, predictions)),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
        }

    output_dir = BERT_MODEL_DIR / "checkpoints"
    output_dir.mkdir(parents=True, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=2,
        learning_rate=2e-5,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=16,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        report_to="none",
        fp16=torch.cuda.is_available(),
        dataloader_pin_memory=torch.cuda.is_available(),
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    metrics = trainer.evaluate()

    BERT_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(BERT_MODEL_DIR))
    tokenizer.save_pretrained(str(BERT_MODEL_DIR))

    return {
        "model_dir": str(BERT_MODEL_DIR),
        "metrics": {
            "accuracy": float(metrics.get("eval_accuracy", 0.0)),
            "precision": float(metrics.get("eval_precision", 0.0)),
            "recall": float(metrics.get("eval_recall", 0.0)),
            "f1": float(metrics.get("eval_f1", 0.0)),
        },
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    }


def _predict_logistic(text: str) -> dict[str, float | int]:
    if not LOGISTIC_MODEL_PATH.exists():
        raise FileNotFoundError(f"Baseline model not found at {LOGISTIC_MODEL_PATH}")

    model, vectorizer = load_logistic_model(LOGISTIC_MODEL_PATH)
    features = transform_text(text, vectorizer=vectorizer)
    phishing_prob = float(model.predict_proba(features)[0][1])

    label = 1 if phishing_prob >= 0.5 else 0
    confidence = phishing_prob if label == 1 else 1.0 - phishing_prob
    return {"label": label, "confidence": float(confidence)}


def _predict_bert(text: str) -> dict[str, float | int]:
    if not BERT_MODEL_DIR.exists():
        raise FileNotFoundError(f"BERT model directory not found at {BERT_MODEL_DIR}")

    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError as exc:
        raise ImportError("BERT inference requires torch and transformers") from exc

    tokenizer = AutoTokenizer.from_pretrained(str(BERT_MODEL_DIR))
    model = AutoModelForSequenceClassification.from_pretrained(str(BERT_MODEL_DIR))

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()

    encoded = tokenizer(
        str(text or ""),
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=256,
    )
    encoded = {key: value.to(device) for key, value in encoded.items()}

    with torch.no_grad():
        logits = model(**encoded).logits
        probs = torch.softmax(logits, dim=1).detach().cpu().numpy()[0]

    phishing_prob = float(probs[1])
    label = 1 if phishing_prob >= 0.5 else 0
    confidence = phishing_prob if label == 1 else 1.0 - phishing_prob
    return {"label": label, "confidence": float(confidence)}


def predict(text: str) -> dict[str, float | int]:
    """Predict Safe(0)/Phishing(1) with confidence, preferring BERT if available."""
    if BERT_MODEL_DIR.exists():
        try:
            return _predict_bert(text)
        except Exception:
            pass

    return _predict_logistic(text)
