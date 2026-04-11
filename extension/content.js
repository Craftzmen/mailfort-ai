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
  
  badge.innerHTML = `
    <span class="mf-icon">🛡️</span>
    <span class="mf-text">MailFort: ${result.final_verdict || 'Scanned'}</span>
    <div class="mf-tooltip">
      <p>AI Score: ${result.ai_score !== undefined ? (result.ai_score * 100).toFixed(1) : 0}%</p>
      <p>URL Score: ${result.url_score !== undefined ? (result.url_score * 100).toFixed(1) : 0}%</p>
      <p>Attachment Score: ${result.attachment_score !== undefined ? (result.attachment_score * 100).toFixed(1) : 0}%</p>
    </div>
  `;
  
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
