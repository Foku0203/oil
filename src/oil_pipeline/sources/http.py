"""Shared HTTP client with retries and raw-payload archiving (the landing zone)."""

import json
from datetime import datetime
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from oil_pipeline.config import BANGKOK, get_settings

USER_AGENT = "Mozilla/5.0 (compatible; thai-oil-pipeline/0.1)"

_retry = retry(
    reraise=True,
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=20),
    retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
)


def client() -> httpx.Client:
    return httpx.Client(
        timeout=get_settings().http_timeout_seconds,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )


@_retry
def get(http: httpx.Client, url: str, **kwargs: Any) -> httpx.Response:
    response = http.get(url, **kwargs)
    response.raise_for_status()
    return response


@_retry
def post(http: httpx.Client, url: str, **kwargs: Any) -> httpx.Response:
    response = http.post(url, **kwargs)
    response.raise_for_status()
    return response


def archive(source: str, name: str, payload: str | bytes | Any) -> None:
    """Keep the untouched API response so any day can be re-parsed later."""
    now = datetime.now(BANGKOK)
    folder = get_settings().landing_path / source / now.strftime("%Y-%m-%d")
    folder.mkdir(parents=True, exist_ok=True)
    stem = f"{now.strftime('%H%M%S')}_{name}"
    if isinstance(payload, bytes):
        (folder / f"{stem}.bin").write_bytes(payload)
    elif isinstance(payload, str):
        suffix = ".xml" if payload.lstrip().startswith("<") else ".txt"
        (folder / f"{stem}{suffix}").write_text(payload, encoding="utf-8")
    else:
        (folder / f"{stem}.json").write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
