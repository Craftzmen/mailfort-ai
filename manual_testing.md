# Manual Testing Guide — MailFort AI 🛡️

Step-by-step instructions to verify the system is functioning correctly.

---

## 1. Backend Verification

### 1.1 Start the Server

```bash
cd MailFortAI
source .venv/bin/activate
uvicorn app:app --port 8000 --reload
```

### 1.2 Health Check

1. Open `http://localhost:8000/health`
2. **Expected**: `{"status": "ok", "service": "MailFort AI"}`

### 1.3 Swagger Docs

1. Open `http://localhost:8000/docs`
2. **Expected**: Interactive Swagger UI with all endpoints listed

### 1.4 Stats Endpoint

1. Open `http://localhost:8000/api/stats`
2. **Expected**: `{"total": 0, "breakdown": {"Safe": 0, "Suspicious": 0, "Malicious": 0}}`

---

## 2. Dashboard Verification

### 2.1 Start the Dashboard

```bash
cd dashboard
npm run dev
```

### 2.2 Login Flow

1. Open `http://localhost:3000`
2. **Expected**: Automatically redirects to `/login`
3. Enter any username and password, click **Establish Secure Connection**
4. **Expected**: Redirects to `/dashboard` with the overview page

### 2.3 Font Check

1. On the dashboard, headings should use **Outfit** font (e.g., "Security Posture Overview")
2. Body text should use **Inter** font
3. **Expected**: Clean, modern typography — no browser default fonts

### 2.4 Navigation

1. Click **Threat Logs** in the sidebar → shows email logs table
2. Click **API Docs** in the sidebar → shows API documentation page
3. Click the **Open Swagger UI** button → opens the backend Swagger docs in a new tab

### 2.5 Data Seeding

To populate the dashboard with realistic test data:

1. Ensure the backend is running at `http://localhost:8000`
2. Run the seed script:
   ```bash
   cd MailFortAI
   source .venv/bin/activate
   python scripts/seed_data.py
   ```
3. **Expected**: Dashboard stats (Total Analyzed, Malicious, etc.) update with real numbers (560 seeded emails).

### 2.6 Search Functionality

1. Type "bank" or "paypal" into the main search bar in the dashboard header.
2. Press **Enter**.
3. **Expected**: Redirects to the logs page showing only matching results.

### 2.7 Settings & Data Management

1. Click **Settings** in the sidebar.
2. **Expected**: "Operational" status for core API.
3. Click **Clear Threat History** in the Danger Zone.
4. **Expected**: All log telemetry is wiped; stats cards return to 0.

---

## 3. Chrome Extension

### 3.1 Installation

1. Navigate to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `extension/` folder
4. **Expected**: "MailFort AI" appears in the extensions list

### 3.2 Live Injection (Gmail)

1. Open Gmail and click on any email.
2. **Expected**: A badge appears near the subject with a scanning indicator, then updates to show the verdict.
3. **Hover** over the badge to see detailed score breakdowns.

### 3.3 Test with Phishing URL

1. Open an email containing one of the URLs from the `opdb-sample.db` (e.g., `https://moobiileleginds.xyz/`).
2. **Expected**: The badge should show **Malicious** in red.
3. Click the extension icon in the Chrome toolbar.
4. **Expected**: Shows the last scanned email verdict and a button to view the report in the dashboard.

---

## 4. AbuseIPDB Integration

### 4.1 Reporting Malicious IPs

1. Find a scan result with a **Malicious** verdict in the dashboard.
2. Click to view details.
3. Scroll to **IP Telemetry**.
4. Click **Report to AbuseIPDB**.
5. **Expected**: Confirmation message "Successfully processed IP reports".
6. Check backend console logs to verify the outward API call to AbuseIPDB.

---

## 5. Troubleshooting

| Problem | Solution |
|---------|----------|
| CORS errors | Backend allows `*` by default. Check `CORS_ORIGINS` in `.env` |
| Database locked | Ensure no other process holds a lock on `mailfort.db` |
| Extension not scanning | Refresh the Gmail tab after installing the extension |
| Fonts not loading | Clear `.next` cache: `rm -rf dashboard/.next && npm run dev` |
| Settings page crash | Ensure `dashboard/src/services/api.ts` has the new `systemService` methods |
| Backend import errors | Ensure you're running from `MailFortAI/` directory |

