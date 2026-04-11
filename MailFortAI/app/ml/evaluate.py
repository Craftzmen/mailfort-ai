from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from app.ml.features import extract_features
from app.ml.model import (
    LOGISTIC_MODEL_PATH,
    SplitDataset,
    evaluate_logistic,
    prepare_dataset_split,
    save_logistic_model,
    train_bert_model,
    train_logistic_regression,
)


def compare_models(
    dataset_path: Optional[Path] = None,
    train_bert: bool = True,
) -> dict[str, Any]:
    """Train and evaluate Logistic Regression and BERT models."""
    dataset: SplitDataset = prepare_dataset_split(dataset_path=dataset_path)

    logistic_model, vectorizer = train_logistic_regression(
        dataset.train_texts,
        dataset.train_labels,
    )
    save_logistic_model(logistic_model, vectorizer, destination=LOGISTIC_MODEL_PATH)

    logistic_metrics = evaluate_logistic(
        logistic_model,
        vectorizer,
        dataset.test_texts,
        dataset.test_labels,
    )

    result: dict[str, Any] = {
        "dataset": {
            "train_count": len(dataset.train_texts),
            "test_count": len(dataset.test_texts),
        },
        "logistic_regression": logistic_metrics,
    }

    if train_bert:
        bert_result = train_bert_model(
            {
                "train_texts": dataset.train_texts,
                "train_labels": dataset.train_labels,
                "test_texts": dataset.test_texts,
                "test_labels": dataset.test_labels,
            }
        )
        result["bert"] = bert_result.get("metrics", {})
        result["bert_device"] = bert_result.get("device")

    return result


def print_comparison(metrics: dict[str, Any]) -> None:
    """Pretty-print model comparison metrics."""
    print("\n=== Model Comparison ===")

    dataset_meta = metrics.get("dataset", {})
    print(f"Train samples: {dataset_meta.get('train_count', 0)}")
    print(f"Test samples : {dataset_meta.get('test_count', 0)}")

    logistic = metrics.get("logistic_regression", {})
    print("\nLogistic Regression")
    print(f"Accuracy : {logistic.get('accuracy', 0.0):.4f}")
    print(f"Precision: {logistic.get('precision', 0.0):.4f}")
    print(f"Recall   : {logistic.get('recall', 0.0):.4f}")
    print(f"F1-score : {logistic.get('f1', 0.0):.4f}")

    if "bert" in metrics:
        bert = metrics.get("bert", {})
        print("\nBERT (bert-base-uncased)")
        print(f"Device   : {metrics.get('bert_device', 'cpu')}")
        print(f"Accuracy : {bert.get('accuracy', 0.0):.4f}")
        print(f"Precision: {bert.get('precision', 0.0):.4f}")
        print(f"Recall   : {bert.get('recall', 0.0):.4f}")
        print(f"F1-score : {bert.get('f1', 0.0):.4f}")
