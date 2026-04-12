const API_BASE_URL = 'http://localhost:8000'; // Assuming local dev backend

export async function analyzeEmail(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.result || {};

    // Flatten the response for the extension UI
    const aiConf = result.ai_analysis?.confidence || 0;
    const aiLabel = result.ai_analysis?.label || 0;
    const aiScore = aiLabel === 1 ? aiConf * 100 : 0;

    const urls = result.url_analysis?.results || [];
    const urlScore = urls.reduce((max, u) => Math.max(max, u.ml_analysis?.score || 0), 0);

    const attachments = result.attachment_analysis?.files || [];
    const attScore = attachments.reduce((max, a) => Math.max(max, a.ml_analysis?.score || 0), 0);

    const headerScore = result.header_analysis?.ml_analysis?.score || 0;

    return {
      final_verdict: result.final_verdict || 'Unknown',
      ai_score: aiScore,
      url_score: urlScore,
      attachment_score: attScore,
      header_score: headerScore,
      threat_score: result.final_score || 0,
      log_id: data.log_id,
      forensic_report: result.forensic_report || null,
      blockchain_tx_id: result.blockchain_tx_id || null
    };
  } catch (error) {
    console.error('MailFort API Error:', error);
    throw error;
  }
}
