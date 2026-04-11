from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

import pandas as pd
try:
    import xgboost as xgb
except ImportError:
    xgb = None

from app.ml.header_features import extract_header_features
from app.config import PROJECT_ROOT

MODEL_PATH = PROJECT_ROOT / "models" / "header_xgboost.pkl"

class HeaderAnalyzerML:
    """XGBoost based local Header analysis."""
    
    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if self.model_path.exists():
            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)

    def predict(self, email_record: dict[str, Any]) -> dict[str, Any]:
        """Predict risk score based on headers."""
        features = extract_header_features(email_record)
        
        if not self.model or xgb is None:
            # Fallback heuristic
            score = 0.0
            if features["spf_pass"] == 0: score += 40
            if features["dkim_pass"] == 0: score += 40
            if features["dmarc_pass"] == 0: score += 20
            return {"score": min(100.0, score), "label": "Unknown", "features": features}

        df = pd.DataFrame([features])
        prob = self.model.predict_proba(df)[0][1]
        
        return {
            "score": float(prob * 100),
            "label": "Suspicious" if prob > 0.5 else "Safe",
            "features": features
        }
