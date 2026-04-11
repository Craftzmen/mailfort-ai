from __future__ import annotations

import unittest

from app.threat_intel.abuseipdb import AbuseIPDBService


class FakeHTTPClient:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def get_json(self, url: str, headers: dict, params: dict) -> dict:
        return self.payload


class AbuseIPDBServiceTests(unittest.TestCase):
    def test_check_ip_maps_response_shape(self) -> None:
        payload = {
            "data": {
                "abuseConfidenceScore": 87,
                "countryCode": "US",
            }
        }
        service = AbuseIPDBService(api_key="test-key", http_client=FakeHTTPClient(payload))

        result = service.check_ip("8.8.8.8")

        self.assertEqual(result["abuse_score"], 87)
        self.assertTrue(result["is_malicious"])
        self.assertEqual(result["country"], "US")


if __name__ == "__main__":
    unittest.main()
