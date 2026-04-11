from __future__ import annotations

from typing import Any, List, Optional
from app.threat_intel.openphish import OpenPhishService
from app.threat_intel.virustotal import VirusTotalService
from app.ml.url_model import URLAnalyzerML

def analyze_urls(
    urls: List[str],
    openphish: OpenPhishService,
    virustotal: VirusTotalService,
    ml_analyzer: Optional[URLAnalyzerML] = None
) -> dict[str, Any]:
    """Analyze a list of URLs using multiple signals and local ML."""
    ml_service = ml_analyzer or URLAnalyzerML()
    results = []
    
    # Deduplicate URLs
    unique_urls = list(dict.fromkeys(urls))
    
    for url in unique_urls:
        try:
            # Local ML Prediction (XGBoost)
            ml_prediction = ml_service.predict(url)
            
            # External Threat Intel
            is_phishing = openphish.is_phishing_url(url)
            vt_report = virustotal.scan_url(url)
            
            results.append({
                "url": url,
                "ml_analysis": ml_prediction,
                "openphish": {
                    "is_phishing": is_phishing,
                    "details": openphish.get_url_details(url) if is_phishing else {}
                },
                "virustotal": vt_report
            })
        except Exception as e:
            print(f"Error analyzing URL {url}: {e}")
            results.append({
                "url": url,
                "ml_analysis": {"score": 0, "label": "Error", "error": str(e)},
                "openphish": {"is_phishing": False},
                "virustotal": {"error": str(e)}
            })
        
    return {
        "count": len(results),
        "results": results,
    }
