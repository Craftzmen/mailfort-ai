# MailFort AI - Phase 1 Template

AI-powered email forensics and phishing detection setup.

## Structure

- `data/raw/` for source datasets (local legitimate and phishing samples)
- `data/processed/` for normalized JSON output
- `preprocessing/` for dataset collection and preprocessing logic
- `app/threat_intel/` for OpenPhish, VirusTotal, and AbuseIPDB services
- `app/pipeline/` for runtime email threat analysis pipeline
- `utils/` for reusable helper functions
- `models/` reserved for upcoming AI/NLP model code
- `reports/` preprocessing logs and forensic report outputs
- `app.py` FastAPI + CLI entry point

## Environment Setup

From `MailFortAI/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Note: `email`, `hashlib`, and `json` are part of Python's standard library and do not need installation.

## Dataset Collection

Place your datasets in `data/raw/legitimate` and `data/raw/phishing`.

### Threat Intelligence APIs

Set API keys before running runtime threat analysis:

```bash
export VIRUSTOTAL_API_KEY="your_key"
export ABUSEIPDB_API_KEY="your_key"
```

## Run Phase 1 Pipeline

```bash
python app.py --run-phase1
```

## Runtime Threat Analysis API

Start API server (example):

```bash
uvicorn app:app --reload
```

Analyze email payload:

```bash
curl -X POST "http://127.0.0.1:8000/analyze/email" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "alerts@company.example",
    "subject": "Invoice overdue",
    "body": "Please pay now: https://evil.example/login",
    "urls": ["https://evil.example/login"],
    "headers": {
      "Received": ["from relay.example (203.0.113.10)"]
    }
  }'
```

## JSON Output Schema

Every processed file under `data/processed/` follows:

```json
{
  "sender": "",
  "subject": "",
  "body": "",
  "attachments": ["file1.pdf", "file2.docx"],
  "urls": ["http://example.com"],
  "headers": {
    "Received": [],
    "SPF": "",
    "DKIM": "",
    "DMARC": ""
  },
  "label": "phishing"
}
```

A combined `data/processed/dataset.jsonl` index is also generated for easy loading in Phase 2.
