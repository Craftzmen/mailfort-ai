import { analyzeEmail } from './utils/api.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze_email') {
    analyzeEmail(request.payload)
      .then(result => {
        // Cache result with timestamp
        chrome.storage.local.set({ 
          lastScan: { ...result, timestamp: Date.now() } 
        });
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Indicates asynchronous response
  }
});
