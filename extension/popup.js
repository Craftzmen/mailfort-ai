document.addEventListener('DOMContentLoaded', () => {
  const contentDiv = document.getElementById('popup-content');

  chrome.storage.local.get(['lastScan'], (result) => {
    const scanData = result.lastScan;

    if (!scanData) {
      contentDiv.innerHTML = `
        <div class="no-data">
          <p>No email scanned recently.</p>
          <p style="font-size: 12px; color: #888; margin-top: 8px;">Open an email in Gmail or Outlook to see the analysis.</p>
        </div>
      `;
      return;
    }

    const verdictVal = scanData.final_verdict ? scanData.final_verdict.toLowerCase() : 'unknown';
    const verdictClass = `verdict-${verdictVal}`;
    
    contentDiv.innerHTML = `
      <div style="text-align: center;">
        <span class="verdict-tag ${verdictClass}">${scanData.final_verdict || 'Unknown'}</span>
      </div>
      <div class="score-card">
        <div class="score-row">
          <span>AI Content Score</span>
          <span>${scanData.ai_score !== undefined ? (scanData.ai_score * 100).toFixed(1) : 0}%</span>
        </div>
        <div class="score-row">
          <span>URL Safety Score</span>
          <span>${scanData.url_score !== undefined ? (scanData.url_score * 100).toFixed(1) : 0}%</span>
        </div>
        <div class="score-row">
          <span>Attachment Score</span>
          <span>${scanData.attachment_score !== undefined ? (scanData.attachment_score * 100).toFixed(1) : 0}%</span>
        </div>
      </div>
      <button class="btn" id="view-report-btn">View Detailed Report</button>
    `;

    document.getElementById('view-report-btn').addEventListener('click', () => {
      // In a real scenario, this would open the dashboard
      // Note: alert() is not strongly supported in v3 popups, but usually works or fails silently depending on chrome version
      // Better to open a new tab securely.
      chrome.tabs.create({ url: 'http://localhost:3000/dashboard' }); // assuming dashboard URL
    });
  });
});
