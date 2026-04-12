# MailFort AI 🛡️

An advanced email threat intelligence system that combines AI-powered phishing detection with external threat intelligence services (VirusTotal, OpenPhish, AbuseIPDB) to provide comprehensive email security analysis.

## Project Structure

```
mailfort-ai/
├── MailFortAI/          # Python backend (FastAPI)
│   ├── main.py          # CLI entry point
│   ├── app/
│   │   ├── __init__.py  # FastAPI app factory
│   │   ├── config.py    # Environment & settings
│   │   ├── database.py  # SQLAlchemy setup
│   │   ├── models.py    # ORM models
│   │   ├── schemas.py   # Pydantic request/response
│   │   ├── routes/      # API endpoint modules
│   │   ├── pipeline/    # Analysis orchestration
│   │   ├── ml/          # AI/ML models (LR + BERT)
│   │   ├── threat_intel/# External API integrations
│   │   ├── attachments/ # File handling & validation
│   │   └── preprocessing/
│   ├── preprocessing/   # Dataset pipelines
│   ├── models/          # Trained model artifacts
│   ├── data/            # Datasets
│   └── tests/
├── dashboard/           # Next.js DFIR dashboard
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/  # Login page
│       │   └── (dashboard)/   # Protected pages
│       │       ├── dashboard/ # Overview
│       │       ├── emails/    # Threat logs
│       │       └── docs/      # API documentation
│       ├── components/ui/     # shadcn/ui components
│       └── services/          # API client
└── extension/           # Chrome extension
```

## Quick Start

### 1. Backend

```bash
cd MailFortAI

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure API keys (optional)
cp .env.example .env
# Edit .env with your VirusTotal and AbuseIPDB API keys

# Start the server
uvicorn app:app --port 8000 --reload
```

The API will be available at `http://localhost:8000`.
Interactive Swagger docs at `http://localhost:8000/docs`.

### 2. Dashboard

```bash
cd dashboard

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The dashboard will be available at `http://localhost:3000`.
Login with any credentials (demo mode).

### 3. Chrome Extension

1. Navigate to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `extension/` folder

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/stats` | Aggregate verdict statistics |
| GET | `/api/emails` | List email analysis logs |
| GET | `/api/emails/{id}` | Full email analysis detail |
| GET | `/api/emails/{id}/report` | Retrieve generated forensic report (JSON) |
| GET | `/api/emails/{id}/report?format=markdown` | Retrieve generated forensic report (Markdown) |
| POST | `/analyze/email` | Submit email for analysis |
| POST | `/phase1/run` | Run preprocessing pipeline |

## Analysis Pipeline

1. **AI Detection** — TF-IDF + Logistic Regression baseline, with optional BERT transformer
2. **URL Analysis** — OpenPhish feed + VirusTotal reputation
3. **Attachment Scan** — File type validation + SHA-256 hash + VirusTotal
4. **IP Reputation** — AbuseIPDB scoring for sender infrastructure

The system produces a unified verdict: **Safe**, **Suspicious**, or **Malicious**.

Each analysis now generates a structured forensic report with:

- module-level findings (NLP, URL, header, attachment)
- risk factors and recommendations
- report metadata and severity level
- markdown export for executive/client sharing

## Environment Variables

```env
VIRUSTOTAL_API_KEY=     # VirusTotal API key for file/URL scanning
ABUSEIPDB_API_KEY=      # AbuseIPDB API key for IP reputation
DATABASE_URL=           # SQLAlchemy DB URL (default: sqlite:///./mailfort.db)
CORS_ORIGINS=           # Comma-separated allowed origins (default: *)
```
