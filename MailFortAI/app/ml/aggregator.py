from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any

try:
    from sklearn.linear_model import LogisticRegression
except ImportError:
    LogisticRegression = None

from app.config import PROJECT_ROOT

MODEL_PATH = PROJECT_ROOT / "models" / "aggregator_logistic.pkl"

class RiskAggregator:
    """Meta-model using Logistic Regression to aggregate scores from individual modules."""
    
    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if self.model_path.exists():
            with open(self.model_path, "rb") as f:
                self.model = pickle.load(f)

    def aggregate(self, scores: dict[str, float]) -> dict[str, Any]:
        """Aggregate scores into a final verdict."""
        # Feature order for the meta-model
        features = [
            scores.get("nlp_score", 0.0),
            scores.get("url_score", 0.0),
            scores.get("header_score", 0.0),
            scores.get("attachment_score", 0.0)
        ]

        if not self.model or LogisticRegression is None:
            # Fallback weighted average
            # Weights based on general reliability
            weighted_score = (
                scores.get("nlp_score", 0.0) * 0.4 +
                scores.get("url_score", 0.0) * 0.3 +
                scores.get("header_score", 0.0) * 0.2 +
                scores.get("attachment_score", 0.0) * 0.1
            )
            verdict = "Safe"
            if weighted_score >= 80: verdict = "Malicious"
            elif weighted_score >= 40: verdict = "Suspicious"
            
            return {
                "final_score": float(weighted_score),
                "verdict": verdict,
                "is_meta_predicted": False
            }

        # Predict using Logistic Regression
        # Note: model expects 2D array [[]]
        prob = self.model.predict_proba([features])[0][1]
        final_score = float(prob * 100)
        
        verdict = "Safe"
        if final_score >= 80: verdict = "Malicious"
        elif final_score >= 40: verdict = "Suspicious"

        return {
            "final_score": final_score,
            "verdict": verdict,
            "is_meta_predicted": True
        }
