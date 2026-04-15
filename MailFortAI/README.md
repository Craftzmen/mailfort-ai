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

### Blockchain Configuration (Forensic Integrity)

Set blockchain runtime values before launching the API:

```bash
export BLOCKCHAIN_RPC_URL="http://127.0.0.1:7545"
export BLOCKCHAIN_CONTRACT_ADDRESS=""
export BLOCKCHAIN_AUTO_DEPLOY="false"
```

Notes:

- If `BLOCKCHAIN_CONTRACT_ADDRESS` is empty and auto-deploy is disabled, reports are still generated but blockchain recording is skipped.
- Set `BLOCKCHAIN_AUTO_DEPLOY=true` to let MailFort deploy `EvidenceRegistry.sol` automatically on startup (requires `py-solc-x` and a writable local chain).

Runtime blockchain diagnostics endpoints:

```bash
curl http://127.0.0.1:8000/api/blockchain/status
curl -X POST http://127.0.0.1:8000/api/blockchain/deploy
```

## Run Phase 1 Pipeline

```bash
python app.py --run-phase1
```

## Train Local ML Models

Use the model training scripts with dataset-specific inputs:

```bash
python scripts/train_model.py
```

This trains text models (Logistic Regression + BERT) from processed email text data:

- `data/processed/emails.json` (default), or
- a custom `--dataset` path in JSON/JSONL format.

To train URL/Header/Attachment/Aggregator local models:

```bash
python scripts/train_all_models.py \
  --url-dataset data/malicious_phish.csv \
  --header-dataset data/header_auth_dataset.csv \
  --attachment-dataset data/attachment_dataset.csv
```

Required columns:

- URL dataset: `url`, `type`
- Header dataset: `label` plus header/auth fields (`spf_result`, `dkim_result`, `dmarc_result`, `num_received_headers`, `reply_to`, `from_address`) or supported aliases
- Attachment dataset: `label`, `filename`, `content_type`, `size` (aliases supported for filename/content_type/size)

Notes:

- Attachment training now requires real attachment metadata and no longer uses synthetic attachment rows.
- Header and attachment training now fail fast if required schema fields are missing, even when aliases are allowed.
- If a CSV is a Git LFS pointer, run `git lfs pull` before training.

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
