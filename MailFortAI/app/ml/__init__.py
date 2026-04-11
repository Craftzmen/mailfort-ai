"""Machine learning package for phishing detection."""

from app.ml.model import (
    LOGISTIC_MODEL_PATH,
    BERT_MODEL_DIR,
    predict,
    prepare_dataset_split,
    train_bert_model,
    train_logistic_regression,
)

__all__ = [
    "LOGISTIC_MODEL_PATH",
    "BERT_MODEL_DIR",
    "predict",
    "prepare_dataset_split",
    "train_bert_model",
    "train_logistic_regression",
]
