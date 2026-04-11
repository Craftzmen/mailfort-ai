from __future__ import annotations

import pandas as pd
import sqlite3
import json
import hashlib
import random
from pathlib import Path
from datetime import datetime, timedelta

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "mailfort.db"
DATA_DIR = PROJECT_ROOT / "data"

def clear_db():
    print("Clearing existing email logs...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM email_logs")
    conn.commit()
    conn.close()

def load_datasets():
    print("Loading core datasets...")
    # Core email datasets
    meajor = pd.read_csv(DATA_DIR / "meajor_cleaned_preprocessed.csv").sample(500).fillna('')
    ceas = pd.read_csv(DATA_DIR / "CEAS_08.csv").sample(500).fillna('')
    email_100k = pd.read_csv(DATA_DIR / "email_dataset_100k.csv").sample(1000).fillna('')
    
    # Enrichment sources
    urls_df = pd.read_csv(DATA_DIR / "malicious_phish.csv")
    phish_urls = urls_df[urls_df['type'] != 'benign']['url'].tolist()
    safe_urls = urls_df[urls_df['type'] == 'benign']['url'].tolist()
    
    cves = pd.read_csv(DATA_DIR / "2022-06-08-enriched.csv")['vulnerability_name'].tolist()
    
    return {
        "meajor": meajor,
        "ceas": ceas,
        "email_100k": email_100k,
        "phish_urls": phish_urls,
        "safe_urls": safe_urls,
        "cves": cves
    }

def generate_forensic_report(label, meta):
    verdict = "Malicious" if label == 1 else "Safe"
    if label == 1 and random.random() > 0.7:
        verdict = "Suspicious"

    risk_factors = []
    nlp_details = []
    url_details = []
    header_details = []
    
    if verdict != "Safe":
        if meta.get('nlp_flag'):
            risk_factors.append("Social engineering patterns detected in body content")
            nlp_details.append("Urgency/Manipulation cues found")
        if meta.get('url_flag'):
            risk_factors.append(f"Malicious link correlation: {meta.get('url_type', 'Phishing')}")
            url_details.append("URL signature matches known blacklist")
        if meta.get('header_flag'):
            risk_factors.append("Authentication failure (SPF/DKIM mismatch)")
            header_details.append("Sender domain spoofing suspected")
        if meta.get('cve'):
            risk_factors.append(f"Linked to known vulnerability: {meta.get('cve')}")

    return {
        "summary": "Threat detected" if verdict != "Safe" else "No immediate threats identified.",
        "risk_factors": risk_factors,
        "forensic_details": {
            "nlp": nlp_details,
            "url": url_details,
            "header": header_details,
            "attachment": ["No suspicious attachments"]
        },
        "blockchain_verified": True if verdict != "Safe" else False,
        "blockchain_tx": f"0x{hashlib.sha256(str(random.random()).encode()).hexdigest()[:64]}" if verdict != "Safe" else None
    }

def ingest():
    clear_db()
    data = load_datasets()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    records = []
    
    # 1. Process email_100k (Forensic rich)
    print("Ingesting 100k Dataset sample...")
    for _, row in data['email_100k'].iterrows():
        label = int(row['label'])
        verdict = "Malicious" if label == 1 else "Safe"
        
        meta = {
            'nlp_flag': True if label == 1 else False,
            'header_flag': True if row.get('spf_result') == 'fail' else False,
            'url_flag': label == 1,
            'url_type': "Phishing"
        }
        
        report = generate_forensic_report(label, meta)
        evidence_json = json.dumps({"subject": row['subject'], "sender": row['from_address']}, sort_keys=True)
        evidence_hash = hashlib.sha256(evidence_json.encode()).hexdigest()
        
        records.append((
            row['from_address'],
            row['subject'],
            str(row['body_plain'])[:2000],
            json.dumps({"source": "email_100k", "spf": row.get('spf_result')}),
            verdict,
            (datetime.now() - timedelta(minutes=random.randint(0, 10000))).strftime("%Y-%m-%d %H:%M:%S"),
            report['blockchain_tx'],
            evidence_hash,
            json.dumps(report)
        ))

    # 2. Process MeAJOR (NLP rich)
    print("Ingesting MeAJOR sample...")
    for _, row in data['meajor'].iterrows():
        label = int(row['label'])
        verdict = "Malicious" if label == 1 else "Safe"
        
        cve = random.choice(data['cves']) if label == 1 and random.random() > 0.8 else None
        meta = {'nlp_flag': True, 'cve': cve}
        report = generate_forensic_report(label, meta)
        
        records.append((
            row['sender'],
            row['subject'],
            str(row['body'])[:2000],
            json.dumps({"source": "meajor", "urls": row['urls']}),
            verdict,
            (datetime.now() - timedelta(minutes=random.randint(0, 10000))).strftime("%Y-%m-%d %H:%M:%S"),
            report['blockchain_tx'],
            hashlib.sha256(str(row['subject']).encode()).hexdigest(),
            json.dumps(report)
        ))

    # 3. Process CEAS_08
    print("Ingesting CEAS_08 sample...")
    for _, row in data['ceas'].iterrows():
        label = int(row['label'])
        verdict = "Malicious" if label == 1 else "Safe"
        report = generate_forensic_report(label, {})
        
        records.append((
            row['sender'],
            row['subject'],
            str(row['body'])[:2000],
            json.dumps({"source": "ceas_08"}),
            verdict,
            (datetime.now() - timedelta(minutes=random.randint(0, 10000))).strftime("%Y-%m-%d %H:%M:%S"),
            report['blockchain_tx'],
            hashlib.sha256(str(row['subject']).encode()).hexdigest(),
            json.dumps(report)
        ))

    print(f"Inserting {len(records)} records...")
    cursor.executemany("""
        INSERT INTO email_logs 
        (sender, subject, body, analysis_result, verdict, created_at, blockchain_tx_id, evidence_hash, forensic_report)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, records)
    
    conn.commit()
    conn.close()
    print("Ingestion complete.")

if __name__ == "__main__":
    ingest()
