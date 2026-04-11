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
    return {
      final_verdict: result.final_verdict || 'Unknown',
      ai_score: result.scores?.ai_score || 0,
      url_score: result.scores?.url_score || 0,
      attachment_score: result.scores?.attachment_score || 0,
      ip_score: result.scores?.ip_score || 0,
      threat_score: result.scores?.threat_score || 0,
      log_id: data.log_id
    };
  } catch (error) {
    console.error('MailFort API Error:', error);
    throw error;
  }
}
