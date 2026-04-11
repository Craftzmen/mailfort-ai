from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any, Optional

import pandas as pd
try:
    import xgboost as xgb
except ImportError:
    xgb = None

from app.ml.url_features import extract_url_features
from app.config import PROJECT_ROOT

MODEL_PATH = PROJECT_ROOT / "models" / "url_xgboost.pkl"

class URLAnalyzerML:
    """XGBoost based local URL analysis."""
    
    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if self.model_path.exists():
            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)

    def predict(self, url: str) -> dict[str, Any]:
        """Predict risk score for a URL."""
        if not self.model or xgb is None:
            # Fallback to simple heuristic if model not trained yet
            features = extract_url_features(url)
            heuristic_score = features["entropy"] * 10 + features["special_char_count"] * 5
            return {"score": min(100.0, heuristic_score), "label": "Unknown", "features": features}

        features = extract_url_features(url)
        df = pd.DataFrame([features])
        prob = self.model.predict_proba(df)[0][1] # Probability of being malicious
        
        return {
            "score": float(prob * 100),
            "label": "Malicious" if prob > 0.5 else "Safe",
            "features": features
        }
