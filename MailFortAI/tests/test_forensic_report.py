from __future__ import annotations

import unittest

from app.reports.forensics import ForensicReportGenerator


class ForensicReportGeneratorTests(unittest.TestCase):
    def test_generate_report_builds_rich_forensic_payload(self) -> None:
        analysis_data = {
            "ai_analysis": {"label": 1, "confidence": 0.91},
            "url_analysis": {
                "results": [
                    {
                        "url": "http://evil.example/login",
                        "ml_analysis": {"score": 72.4, "features": {"entropy": 4.1}},
                        "openphish": {"is_phishing": True},
                        "virustotal": {"malicious": 2},
                    }
                ]
            },
            "attachment_analysis": {
                "files": [
                    {
                        "filename": "invoice.pdf.exe",
                        "ml_analysis": {
                            "score": 84.1,
                            "features": {
                                "is_executable": 1,
                                "is_suspicious_ext": True,
                                "has_double_ext": True,
                            },
                        },
                        "vt_result": {"malicious": 3},
                    }
                ]
            },
            "header_analysis": {
                "ml_analysis": {
                    "score": 77,
                    "features": {
                        "spf_pass": 0,
                        "dkim_pass": 0,
                        "dmarc_pass": 0,
                        "mismatch_from_reply": 1,
                    },
                }
            },
            "final_verdict": "Malicious",
            "final_score": 92.4,
        }

        report = ForensicReportGenerator.generate_report(analysis_data)

        self.assertTrue(str(report.get("report_id", "")).startswith("MFR-"))
        self.assertEqual(report.get("severity"), "critical")
        self.assertEqual(report.get("final_verdict"), "Malicious")
        self.assertIn("module_scores", report)
        self.assertGreaterEqual(len(report.get("findings", [])), 4)
        self.assertIn("invoice.pdf.exe", report.get("indicators", {}).get("suspicious_attachments", []))
        self.assertIn("http://evil.example/login", report.get("indicators", {}).get("suspicious_urls", []))

        markdown = report.get("markdown_report", "")
        self.assertIsInstance(markdown, str)
        self.assertIn("# MailFort AI Forensic Report", markdown)
        self.assertIn("## Key Findings", markdown)

    def test_generate_report_handles_low_risk_payload(self) -> None:
        analysis_data = {
            "ai_analysis": {"label": 0, "confidence": 0.11},
            "url_analysis": {"results": []},
            "attachment_analysis": {"files": []},
            "header_analysis": {"ml_analysis": {"score": 0, "features": {}}},
            "final_verdict": "Safe",
            "final_score": 0,
        }

        report = ForensicReportGenerator.generate_report(analysis_data)

        self.assertEqual(report.get("severity"), "info")
        self.assertEqual(report.get("final_verdict"), "Safe")
        self.assertEqual(report.get("findings"), [])
        self.assertEqual(report.get("risk_factors"), [])
        self.assertIn("No material risk factors detected", report.get("markdown_report", ""))


if __name__ == "__main__":
    unittest.main()
