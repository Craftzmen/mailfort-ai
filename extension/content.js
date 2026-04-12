console.log("MailFort AI Content Script Loaded");

let currentEmailId = null;
let scanning = false;
let scanTimeout = null;

const INJECT_BADGE_CLASS = 'mailfort-badge-injected';

function extractGmailData() {
  const subjectEl = document.querySelector('h2.hP');
  const senderEl = document.querySelector('span.gD');
  const bodyEls = document.querySelectorAll('div.a3s.aiL');
  
  if (!subjectEl || !senderEl || bodyEls.length === 0) return null;
  
  // Use the last body element as the latest email in the thread
  const latestBody = bodyEls[bodyEls.length - 1];

  return {
    subject: subjectEl.innerText.trim(),
    sender: senderEl.getAttribute('email') || senderEl.innerText.trim(),
    body: latestBody.innerText.trim(),
    element: subjectEl.parentElement // Where to inject badge
  };
}

function extractOutlookData() {
  // Outlook classes change often, these are generic fallback selectors
  const subjectEls = document.querySelectorAll('[role="main"] span');
  let subjectEl = null;
  // Heuristic: finding something that looks like a subject inside main
  for (const el of subjectEls) {
      if (el.style.fontSize && parseInt(el.style.fontSize) > 16) {
          subjectEl = el;
          break;
      }
  }
  if (!subjectEl) subjectEl = document.querySelector('[role="main"] .allowTextSelection');

  const senderEl = document.querySelector('[role="main"] .OZZqx'); // Example class
  const bodyEl = document.querySelector('[role="main"] [aria-label="Message body"]');
  
  if (!subjectEl || !bodyEl) return null;

  return {
    subject: subjectEl.innerText.trim(),
    sender: senderEl ? senderEl.innerText.trim() : "Unknown Sender",
    body: bodyEl.innerText.trim(),
    element: subjectEl.parentElement || subjectEl
  };
}

function extractEmailData() {
  if (window.location.hostname.includes('mail.google.com')) {
    return extractGmailData();
  } else if (window.location.hostname.includes('outlook')) {
    return extractOutlookData();
  }
  return null;
}

function createBadge(result) {
  const badge = document.createElement('span');
  badge.className = `mailfort-badge ${INJECT_BADGE_CLASS}`;
  
  const verdict = result.final_verdict ? result.final_verdict.toLowerCase() : 'unknown';
  badge.classList.add(`mailfort-${verdict}`);
  
  const getRiskClass = (score) => {
    if (score >= 70) return 'mf-risk-high';
    if (score >= 40) return 'mf-risk-med';
    return 'mf-risk-low';
  };

  const threatScore = Math.floor(result.threat_score || 0);
  const colorClass = getRiskClass(threatScore);

  let riskFactorsHtml = '';
  if (result.forensic_report && result.forensic_report.risk_factors && result.forensic_report.risk_factors.length > 0) {
    const tags = result.forensic_report.risk_factors.slice(0,3).map(rf => `<span class="mf-tag">${rf}</span>`).join('');
    riskFactorsHtml = `
      <div class="mf-tag-row" style="margin-bottom: 12px;">
        ${tags}
      </div>
    `;
  }

  let blockchainHtml = '';
  if (result.blockchain_tx_id) {
    blockchainHtml = `
      <div class="mf-blockchain-tag" title="${result.blockchain_tx_id}">
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-2.33v8.02z"/></svg>
        Blockchain Verified
      </div>
    `;
  }

  let summaryHtml = '';
  if (result.forensic_report && result.forensic_report.summary) {
    summaryHtml = `
      <div class="mf-forensic-section">
        <div class="mf-forensic-title">📋 AI Forensic Summary</div>
        <p class="mf-forensic-text">${result.forensic_report.summary}</p>
        ${riskFactorsHtml}
      </div>
    `;
  }

  let reportButtonHtml = '';
  if (result.log_id) {
    reportButtonHtml = '<button class="mf-open-report-btn" type="button">Open Full Report</button>';
  }

  badge.innerHTML = `
    <span class="mf-icon">🛡️</span>
    <span class="mf-text">MailFort: ${result.final_verdict || 'Scanned'}</span>
    <div class="mf-tooltip">
      <div class="mf-tooltip-header">
        <h3 class="mf-tooltip-title">Detailed Analysis</h3>
        <div class="mf-threat-score ${colorClass}">Threat: ${threatScore}%</div>
      </div>
      
      <div class="mf-score-grid">
        <div class="mf-score-item">
          <span class="mf-score-label">NLP Sentiment</span>
          <span class="mf-score-value ${getRiskClass(result.ai_score)}">${Math.floor(result.ai_score || 0)}%</span>
        </div>
        <div class="mf-score-item">
          <span class="mf-score-label">URL Scan</span>
          <span class="mf-score-value ${getRiskClass(result.url_score)}">${Math.floor(result.url_score || 0)}%</span>
        </div>
        <div class="mf-score-item">
          <span class="mf-score-label">Attachment</span>
          <span class="mf-score-value ${getRiskClass(result.attachment_score)}">${Math.floor(result.attachment_score || 0)}%</span>
        </div>
        <div class="mf-score-item">
          <span class="mf-score-label">Meta Header</span>
          <span class="mf-score-value ${getRiskClass(result.header_score)}">${Math.floor(result.header_score || 0)}%</span>
        </div>
      </div>

      ${summaryHtml}
      ${blockchainHtml}
      ${reportButtonHtml}
    </div>
  `;

  const reportButton = badge.querySelector('.mf-open-report-btn');
  if (reportButton) {
    reportButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ action: 'open_report_page' });
    });
  }
  
  return badge;
}

function triggerScan() {
  if (scanning) return;
  
  const emailData = extractEmailData();
  if (!emailData) return;

  // Create hash to avoid rescanning
  const sanitize = (str) => str.replace(/[^a-zA-Z0-9]/g, '');
  const emailHash = btoa(encodeURIComponent(sanitize(emailData.subject) + sanitize(emailData.sender))).slice(0, 32);
  
  if (currentEmailId === emailHash) return; // Already scanned this email
  
  // Clean up old badges if any
  document.querySelectorAll('.' + INJECT_BADGE_CLASS).forEach(e => e.remove());

  currentEmailId = emailHash;
  scanning = true;
  
  // Show scanning badge
  const scanningBadge = document.createElement('span');
  scanningBadge.className = `mailfort-badge mailfort-scanning ${INJECT_BADGE_CLASS}`;
  scanningBadge.innerText = '🛡️ Scanning...';
  if (emailData.element) {
    emailData.element.appendChild(scanningBadge);
  }

  // Send to background for API call
  chrome.runtime.sendMessage({
    action: 'analyze_email',
    payload: {
      subject: emailData.subject,
      sender: emailData.sender,
      body: emailData.body.substring(0, 5000) // limit body size
    }
  }, (response) => {
    scanning = false;
    if (scanningBadge.parentNode) {
      scanningBadge.remove();
    }

    if (response && response.success) {
      const finalBadge = createBadge(response.result);
      if (emailData.element) {
        emailData.element.appendChild(finalBadge);
      }
    } else {
      const errorBadge = document.createElement('span');
      errorBadge.className = `mailfort-badge mailfort-error ${INJECT_BADGE_CLASS}`;
      errorBadge.innerText = '🛡️ Scan Failed';
      errorBadge.title = response ? response.error : 'Unknown error';
      if (emailData.element) {
        emailData.element.appendChild(errorBadge);
      }
    }
  });
}

// Observe DOM for changes (new email opened)
const observer = new MutationObserver((mutations) => {
  // Debounce the scanner
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    triggerScan();
  }, 1000);
});

observer.observe(document.body, { childList: true, subtree: true });
