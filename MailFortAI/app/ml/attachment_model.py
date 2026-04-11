from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from app.ml.attachment_features import extract_attachment_features
from app.config import PROJECT_ROOT

MODEL_PATH = PROJECT_ROOT / "models" / "attachment_rf.pkl"

class AttachmentAnalyzerML:
    """Random Forest based local Attachment metadata analysis."""
    
    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if self.model_path.exists():
            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)

    def predict(self, attachment_info: dict[str, Any]) -> dict[str, Any]:
        """Predict risk score based on attachment metadata."""
        features = extract_attachment_features(attachment_info)
        
        if not self.model:
            # Fallback heuristic
            score = 0.0
            if features["is_suspicious_ext"]: score += 60
            if features["is_executable"]: score += 90
            if features["has_double_ext"]: score += 50
            return {"score": min(100.0, score), "label": "Unknown", "features": features}

        df = pd.DataFrame([features])
        prob = self.model.predict_proba(df)[0][1]
        
        return {
            "score": float(prob * 100),
            "label": "Malicious" if prob > 0.5 else "Safe",
            "features": features
        }
