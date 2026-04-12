const API_BASE_URL = 'http://localhost:8000';

let currentReport = null;
let currentMarkdown = '';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setState(message) {
  const state = document.getElementById('report-state');
  const content = document.getElementById('report-content');
  state.textContent = message;
  state.classList.remove('hidden');
  content.classList.add('hidden');
}

function showContent(html) {
  const state = document.getElementById('report-state');
  const content = document.getElementById('report-content');
  content.innerHTML = html;
  state.classList.add('hidden');
  content.classList.remove('hidden');
}

function getLastScan() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lastScan'], (result) => resolve(result.lastScan || null));
  });
}

function resolveApiUrl(path) {
  if (!path) {
    return null;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

async function fetchJsonReport(scanData) {
  if (!scanData) {
    return null;
  }

  const reportPath = scanData.report_endpoint || (scanData.log_id ? `/api/emails/${scanData.log_id}/report` : null);
  const reportUrl = resolveApiUrl(reportPath);

  if (!reportUrl) {
    return scanData.forensic_report || null;
  }

  try {
    const response = await fetch(reportUrl);
    if (!response.ok) {
      throw new Error(`Report endpoint returned ${response.status}`);
    }

    const payload = await response.json();
    return payload.report || payload.forensic_report || scanData.forensic_report || null;
  } catch (error) {
    console.warn('Failed to fetch report from backend, using cached report.', error);
    return scanData.forensic_report || null;
  }
}

async function fetchMarkdownReport(scanData, fallbackReport) {
  if (!scanData) {
    return fallbackReport?.markdown_report || '';
  }

  const markdownPath = scanData.report_markdown_endpoint || (scanData.log_id ? `/api/emails/${scanData.log_id}/report?format=markdown` : null);
  const markdownUrl = resolveApiUrl(markdownPath);

  if (!markdownUrl) {
    return fallbackReport?.markdown_report || '';
  }

  try {
    const response = await fetch(markdownUrl);
    if (!response.ok) {
      throw new Error(`Markdown endpoint returned ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.warn('Failed to fetch markdown report from backend, using cached markdown.', error);
    return fallbackReport?.markdown_report || '';
  }
}

function renderList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<li>None</li>';
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderFindings(findings) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return '<div class="finding-card">No key findings were recorded.</div>';
  }

  return findings
    .map((finding) => {
      const evidence = finding?.evidence && typeof finding.evidence === 'object' ? finding.evidence : {};
      const evidenceRows = Object.entries(evidence)
        .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`)
        .join('');

      return `
        <article class="finding-card severity-${escapeHtml(finding.severity || 'info')}">
          <header>
            <span class="finding-module">${escapeHtml((finding.module || 'unknown').toUpperCase())}</span>
            <span class="finding-severity">${escapeHtml((finding.severity || 'info').toUpperCase())}</span>
          </header>
          <h3>${escapeHtml(finding.title || 'Untitled finding')}</h3>
          <ul>${evidenceRows || '<li>No evidence payload available.</li>'}</ul>
          <p><strong>Recommendation:</strong> ${escapeHtml(finding.recommendation || 'Continue monitoring.')}</p>
        </article>
      `;
    })
    .join('');
}

function renderReport(scanData, report) {
  const verdict = scanData?.final_verdict || report?.final_verdict || 'Unknown';
  const moduleScores = report?.module_scores || {};

  showContent(`
    <section class="report-hero">
      <div>
        <h2>${escapeHtml(verdict)} Verdict</h2>
        <p>${escapeHtml(report?.summary || 'No summary available.')}</p>
      </div>
      <div class="hero-score">
        <span>Threat Score</span>
        <strong>${Number(report?.risk_score || scanData?.threat_score || 0).toFixed(1)}%</strong>
      </div>
    </section>

    <section class="report-grid">
      <article class="report-card">
        <h3>Report Metadata</h3>
        <ul>
          <li><strong>Report ID:</strong> ${escapeHtml(report?.report_id || 'N/A')}</li>
          <li><strong>Generated:</strong> ${escapeHtml(report?.generated_at || 'N/A')}</li>
          <li><strong>Severity:</strong> ${escapeHtml((report?.severity || 'unknown').toUpperCase())}</li>
          <li><strong>Email Log ID:</strong> ${escapeHtml(scanData?.log_id || 'N/A')}</li>
        </ul>
      </article>

      <article class="report-card">
        <h3>Module Scores</h3>
        <ul>
          <li><strong>NLP:</strong> ${Number(moduleScores.nlp || scanData?.ai_score || 0).toFixed(1)}%</li>
          <li><strong>URL:</strong> ${Number(moduleScores.url || scanData?.url_score || 0).toFixed(1)}%</li>
          <li><strong>Header:</strong> ${Number(moduleScores.header || scanData?.header_score || 0).toFixed(1)}%</li>
          <li><strong>Attachment:</strong> ${Number(moduleScores.attachment || scanData?.attachment_score || 0).toFixed(1)}%</li>
        </ul>
      </article>

      <article class="report-card">
        <h3>Risk Factors</h3>
        <ul>${renderList(report?.risk_factors)}</ul>
      </article>

      <article class="report-card">
        <h3>Recommendations</h3>
        <ul>${renderList(report?.recommendations)}</ul>
      </article>
    </section>

    <section class="findings-section">
      <h3>Key Findings</h3>
      <div class="findings-grid">
        ${renderFindings(report?.findings)}
      </div>
    </section>
  `);
}

async function loadReport() {
  setState('Loading latest forensic report...');

  const scanData = await getLastScan();
  if (!scanData) {
    setState('No recent scan found. Open an email and run MailFort analysis first.');
    currentReport = null;
    currentMarkdown = '';
    return;
  }

  const report = await fetchJsonReport(scanData);
  if (!report) {
    setState('No report is available for the latest scan yet. Please scan the email again.');
    currentReport = null;
    currentMarkdown = '';
    return;
  }

  const markdown = await fetchMarkdownReport(scanData, report);
  currentReport = report;
  currentMarkdown = markdown || report.markdown_report || '';

  renderReport(scanData, report);
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refresh-report');
  const jsonButton = document.getElementById('download-json');
  const markdownButton = document.getElementById('download-md');

  refreshButton.addEventListener('click', () => {
    loadReport();
  });

  jsonButton.addEventListener('click', () => {
    if (!currentReport) {
      setState('Cannot download report. No report has been loaded yet.');
      return;
    }
    const reportId = currentReport.report_id || `scan-${Date.now()}`;
    downloadFile(`mailfort-report-${reportId}.json`, JSON.stringify(currentReport, null, 2), 'application/json');
  });

  markdownButton.addEventListener('click', () => {
    if (!currentReport) {
      setState('Cannot download report. No report has been loaded yet.');
      return;
    }

    const reportId = currentReport.report_id || `scan-${Date.now()}`;
    const markdown = currentMarkdown || currentReport.markdown_report || '# MailFort AI Forensic Report\n\nNo markdown content available.';
    downloadFile(`mailfort-report-${reportId}.md`, markdown, 'text/markdown');
  });

  loadReport();
});
