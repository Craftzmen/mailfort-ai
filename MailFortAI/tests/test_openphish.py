from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.threat_intel.openphish import OpenPhishService, normalize_url


class OpenPhishServiceTests(unittest.TestCase):
    def test_normalize_url_strips_fragment_and_normalizes_host(self) -> None:
        value = normalize_url("HTTPS://Example.com:443/login/?x=1#frag")
        self.assertEqual(value, "https://example.com/login?x=1")

    def test_is_phishing_url_uses_cached_feed(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_file = Path(temp_dir) / "openphish_cache.txt"
            service = OpenPhishService(feed_url="https://openphish.com/feed.txt", cache_file=cache_file)
            service._download_feed_lines = lambda: ["http://evil.example/login", "http://safe.example"]

            self.assertTrue(service.is_phishing_url("evil.example/login"))
            self.assertFalse(service.is_phishing_url("https://example.org"))


if __name__ == "__main__":
    unittest.main()
