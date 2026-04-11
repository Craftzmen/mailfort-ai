from __future__ import annotations

import sqlite3
import time
import urllib.parse
from pathlib import Path
from typing import Any, Iterable, Optional

from app.threat_intel.http_client import ResilientHTTPClient
from app.config import PROJECT_ROOT

OPENPHISH_PUBLIC_FEED = "https://openphish.com/feed.txt"
OPDB_PATH = PROJECT_ROOT / "data" / "opdb-sample.db"


def normalize_url(url: str) -> str:
    """Normalize URLs to improve deterministic URL matching."""
    value = (url or "").strip()
    if not value:
        return ""

    if "://" not in value:
        value = f"http://{value}"

    parsed = urllib.parse.urlsplit(value)
    scheme = (parsed.scheme or "http").lower()
    netloc = parsed.netloc.lower()

    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    if netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/") or "/"

    query = urllib.parse.urlencode(
        urllib.parse.parse_qsl(parsed.query, keep_blank_values=True),
        doseq=True,
    )

    return urllib.parse.urlunsplit((scheme, netloc, path, query, ""))


class OpenPhishService:
    """OpenPhish client using local OPDB SQLite database with online feed fallback."""

    def __init__(
        self,
        db_path: Optional[Path] = None,
        feed_url: str = OPENPHISH_PUBLIC_FEED,
        cache_file: Optional[Path] = None,
        cache_ttl_seconds: int = 3600,
        http_client: Optional[ResilientHTTPClient] = None,
    ) -> None:
        self._db_path = db_path or OPDB_PATH
        self._feed_url = feed_url
        self._cache_file = cache_file or (PROJECT_ROOT / "data" / "cache" / "openphish_urls.txt")
        self._cache_ttl_seconds = cache_ttl_seconds
        self._http_client = http_client or ResilientHTTPClient()

        self._memory_cache: set[str] = set()
        self._host_cache: set[str] = set()
        self._last_refresh_epoch: float = 0.0
        self._db_loaded: bool = False

    def is_phishing_url(self, url: str) -> bool:
        """Check if a URL is in the OpenPhish phishing database."""
        normalized = normalize_url(url)
        if not normalized:
            return False

        self._ensure_cache()

        # Exact normalized URL match
        if normalized in self._memory_cache:
            return True

        # Host-level match (broader check)
        try:
            parsed = urllib.parse.urlsplit(normalized)
            host = parsed.netloc.lower()
            if host and host in self._host_cache:
                return True
        except Exception:
            pass

        return False

    def get_url_details(self, url: str) -> dict[str, Any]:
        """Get detailed phishing intel for a URL from the local OPDB."""
        if not self._db_path.exists():
            return {}

        normalized = normalize_url(url)
        try:
            parsed = urllib.parse.urlsplit(normalized)
            host = parsed.netloc.lower()
        except Exception:
            return {}

        try:
            conn = sqlite3.connect(str(self._db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Try exact URL match first, then host match
            cursor.execute(
                "SELECT * FROM phishing_urls WHERE url_norm = ? OR host = ? LIMIT 1",
                (normalized, host),
            )
            row = cursor.fetchone()
            conn.close()

            if row:
                return {
                    "brand": row["brand"] or "",
                    "sector": row["sector"] or "",
                    "country": row["country_name"] or "",
                    "ip": row["ip"] or "",
                    "host": row["host"] or "",
                    "tld": row["tld"] or "",
                    "detected_at": row["isotime"] or "",
                }
        except Exception:
            pass

        return {}

    def refresh_cache(self) -> int:
        """Reload the in-memory cache from local DB + online feed."""
        loaded = self._load_from_sqlite_db()

        # Also try online feed as supplemental data
        try:
            lines = self._download_feed_lines()
            for line in self._extract_urls(lines):
                normalized = normalize_url(line)
                if normalized:
                    self._memory_cache.add(normalized)
                    try:
                        host = urllib.parse.urlsplit(normalized).netloc.lower()
                        if host:
                            self._host_cache.add(host)
                    except Exception:
                        pass
        except Exception:
            pass  # Online feed is optional

        self._last_refresh_epoch = time.time()
        self._write_file_cache(self._memory_cache)
        return len(self._memory_cache)

    # ── Private methods ──────────────────────────────────────────────────

    def _ensure_cache(self) -> None:
        if self._memory_cache and not self._is_expired():
            return

        # 1. Try local SQLite DB first (primary)
        if self._load_from_sqlite_db():
            return

        # 2. Try file cache
        if self._load_from_file_cache():
            return

        # 3. Fall back to online feed
        self.refresh_cache()

    def _is_expired(self) -> bool:
        return (time.time() - self._last_refresh_epoch) > self._cache_ttl_seconds

    def _load_from_sqlite_db(self) -> bool:
        """Load phishing URLs from the local opdb-sample.db SQLite database."""
        if not self._db_path.exists():
            return False

        try:
            conn = sqlite3.connect(str(self._db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT url, url_norm, host FROM phishing_urls")
            rows = cursor.fetchall()
            conn.close()

            if not rows:
                return False

            for url_raw, url_norm, host in rows:
                # Add both the raw and normalized URLs
                if url_norm:
                    self._memory_cache.add(url_norm)
                if url_raw:
                    normalized = normalize_url(url_raw)
                    if normalized:
                        self._memory_cache.add(normalized)
                if host:
                    self._host_cache.add(host.lower())

            self._last_refresh_epoch = time.time()
            self._db_loaded = True
            return True
        except Exception as e:
            print(f"Warning: Failed to load OpenPhish DB: {e}")
            return False

    def _download_feed_lines(self) -> list[str]:
        text = self._http_client.get_text(self._feed_url)
        return text.splitlines()

    def _extract_urls(self, lines: Iterable[str]) -> list[str]:
        return [line.strip() for line in lines if line.strip() and not line.startswith("#")]

    def _load_from_file_cache(self) -> bool:
        if not self._cache_file.exists():
            return False

        file_age = time.time() - self._cache_file.stat().st_mtime
        if file_age > self._cache_ttl_seconds:
            return False

        cached_urls = {
            normalize_url(line.strip())
            for line in self._cache_file.read_text(encoding="utf-8").splitlines()
            if line.strip()
        }

        if not cached_urls:
            return False

        self._memory_cache = cached_urls
        self._last_refresh_epoch = time.time()
        return True

    def _write_file_cache(self, urls: set[str]) -> None:
        self._cache_file.parent.mkdir(parents=True, exist_ok=True)
        self._cache_file.write_text("\n".join(sorted(urls)), encoding="utf-8")
