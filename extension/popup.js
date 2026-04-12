document.addEventListener('DOMContentLoaded', () => {
  const contentDiv = document.getElementById('popup-content');
  const toScore = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

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
          <span>${toScore(scanData.ai_score).toFixed(1)}%</span>
        </div>
        <div class="score-row">
          <span>URL Safety Score</span>
          <span>${toScore(scanData.url_score).toFixed(1)}%</span>
        </div>
        <div class="score-row">
          <span>Attachment Score</span>
          <span>${toScore(scanData.attachment_score).toFixed(1)}%</span>
        </div>
        <div class="score-row">
          <span>Header Score</span>
          <span>${toScore(scanData.header_score).toFixed(1)}%</span>
        </div>
        <div class="score-row total">
          <span>Threat Score</span>
          <span>${toScore(scanData.threat_score).toFixed(1)}%</span>
        </div>
      </div>
      <button class="btn" id="view-report-btn">Open Generated Report</button>
    `;

    document.getElementById('view-report-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('report.html') });
    });
  });
});
