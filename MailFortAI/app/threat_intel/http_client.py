from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping, Optional


@dataclass(frozen=True)
class HTTPClientConfig:
    timeout_seconds: float = 8.0
    max_retries: int = 3
    backoff_seconds: float = 1.0


class ResilientHTTPClient:
    """Minimal HTTP client with retry, timeout, and rate-limit handling."""

    def __init__(self, config: Optional[HTTPClientConfig] = None) -> None:
        self._config = config or HTTPClientConfig()

    def get_json(
        self,
        url: str,
        headers: Optional[Mapping[str, str]] = None,
        params: Optional[Mapping[str, str]] = None,
    ) -> dict[str, Any]:
        text = self.get_text(url=url, headers=headers, params=params)
        return json.loads(text)

    def post_form_json(
        self,
        url: str,
        form_data: Mapping[str, str],
        headers: Optional[Mapping[str, str]] = None,
    ) -> dict[str, Any]:
        encoded_form = urllib.parse.urlencode(form_data).encode("utf-8")
        merged_headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if headers:
            merged_headers.update(headers)

        response_text = self._request_with_retry(
            url=url,
            method="POST",
            data=encoded_form,
            headers=merged_headers,
        )
        return json.loads(response_text)

    def get_text(
        self,
        url: str,
        headers: Optional[Mapping[str, str]] = None,
        params: Optional[Mapping[str, str]] = None,
    ) -> str:
        return self._request_with_retry(
            url=url,
            method="GET",
            data=None,
            headers=headers,
            params=params,
        )

    def _request_with_retry(
        self,
        url: str,
        method: str,
        data: Optional[bytes],
        headers: Optional[Mapping[str, str]] = None,
        params: Optional[Mapping[str, str]] = None,
    ) -> str:
        request_url = url
        if params:
            query = urllib.parse.urlencode(params)
            separator = "&" if "?" in url else "?"
            request_url = f"{url}{separator}{query}"

        for attempt in range(self._config.max_retries):
            request = urllib.request.Request(
                url=request_url,
                data=data,
                method=method,
                headers=dict(headers or {}),
            )
            try:
                with urllib.request.urlopen(request, timeout=self._config.timeout_seconds) as response:
                    charset = response.headers.get_content_charset() or "utf-8"
                    return response.read().decode(charset, errors="replace")
            except urllib.error.HTTPError as exc:
                if not self._should_retry_status(exc.code, attempt):
                    raise

                retry_after_value = exc.headers.get("Retry-After") if exc.headers else None
                wait_seconds = self._retry_delay(attempt, retry_after_value)
                time.sleep(wait_seconds)
            except urllib.error.URLError:
                if attempt >= self._config.max_retries - 1:
                    raise
                time.sleep(self._retry_delay(attempt, None))

        raise RuntimeError("HTTP request retries exhausted")

    def _should_retry_status(self, status_code: int, attempt: int) -> bool:
        if attempt >= self._config.max_retries - 1:
            return False
        return status_code in {429, 500, 502, 503, 504}

    def _retry_delay(self, attempt: int, retry_after: Optional[str]) -> float:
        if retry_after and retry_after.isdigit():
            return max(float(retry_after), self._config.backoff_seconds)
        return self._config.backoff_seconds * (2 ** attempt)
