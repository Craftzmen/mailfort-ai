import sys
import os
from pathlib import Path
import json

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

# Mock environment variables for testing
os.environ["VT_API_KEY"] = "mock_key"
os.environ["ABUSEIPDB_API_KEY"] = "mock_key"

from app.pipeline.analyzer import analyze_email

def test_analysis():
    print("Testing Forensic Analysis Pipeline...")
    
    test_email = {
        "sender": "attacker@scam-domain.com",
        "subject": "URGENT: Verify your account",
        "body": "Your account has been suspended. Please click here to verify: http://phish-link.com/login",
        "urls": ["http://phish-link.com/login"],
        "attachments": [
            {"filename": "invoice.exe", "content_type": "application/octet-stream", "size": 5000}
        ],
        "headers": {
            "Received": ["from 192.168.1.1 by mx.google.com"],
            "spf_result": "fail",
            "dkim_result": "none",
            "dmarc_result": "fail"
        },
        "num_received_headers": 1,
        "spf_result": "fail",
        "dkim_result": "none",
        "dmarc_result": "fail"
    }
    
    try:
        result = analyze_email(test_email)
        print("\n--- Analysis Result ---")
        print(f"Verdict: {result['final_verdict']}")
        print(f"Final Score: {result['final_score']}")
        print(f"Blockchain Tx: {result['blockchain_tx_id']}")
        print("\n--- Forensic Report Summary ---")
        print(result['forensic_report']['summary'])
        print("\n--- Risk Factors ---")
        for factor in result['forensic_report']['risk_factors']:
            print(f"- {factor}")
            
        print("\nSUCCESS: Pipeline executed successfully.")
    except Exception as e:
        print(f"\nFAILURE: Pipeline failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_analysis()
