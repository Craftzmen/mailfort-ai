from __future__ import annotations

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

def train_url_model():
    print("Training URL Model (XGBoost)...")
    df = pd.read_csv(DATA_DIR / "malicious_phish.csv").head(50000) # Sample for speed
    
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

def train_header_model():
    print("Training Header Model (XGBoost)...")
    df = pd.read_csv(DATA_DIR / "email_dataset_100k.csv").head(20000)
    
    X = []
    for _, row in df.iterrows():
        # Map row to the format expected by extract_header_features
        X.append(extract_header_features(row.to_dict()))
        
    X_df = pd.DataFrame(X)
    y = df['label'] # 1 for phishing, 0 for safe
    
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2)
    
    model = xgb.XGBClassifier()
    model.fit(X_train, y_train)
    
    print(classification_report(y_test, model.predict(X_test)))
    
    with open(MODELS_DIR / "header_xgboost.pkl", "wb") as f:
        pickle.dump(model, f)

def train_attachment_model():
    print("Training Attachment Model (Random Forest)...")
    # Using a mix of datasets if needed, here we simulate from email_dataset_100k
    df = pd.read_csv(DATA_DIR / "email_dataset_100k.csv").head(10000)
    
    X = []
    for _, row in df.iterrows():
        # Simulate attachment metadata for training
        X.append(extract_attachment_features({
            "filename": f"file.{'exe' if row['label'] == 1 else 'pdf'}",
            "content_type": "application/octet-stream",
            "size": 1024
        }))
        
    X_df = pd.DataFrame(X)
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2)
    
    model = RandomForestClassifier()
    model.fit(X_train, y_train)
    
    with open(MODELS_DIR / "attachment_rf.pkl", "wb") as f:
        pickle.dump(model, f)

def train_aggregator():
    print("Training Meta-Aggregator (Logistic Regression)...")
    # Simulate scores for aggregator training
    import numpy as np
    X = np.random.rand(1000, 4) * 100 # NLP, URL, Header, Attachment
    y = (X[:, 0] * 0.4 + X[:, 1] * 0.3 + X[:, 2] * 0.2 + X[:, 3] * 0.1 > 50).astype(int)
    
    model = LogisticRegression()
    model.fit(X, y)
    
    with open(MODELS_DIR / "aggregator_logistic.pkl", "wb") as f:
        pickle.dump(model, f)

if __name__ == "__main__":
    train_url_model()
    train_header_model()
    train_attachment_model()
    train_aggregator()
    print("All models trained and saved to /models.")
