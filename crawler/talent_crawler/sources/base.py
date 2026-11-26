"""Base crawler adapter with polite HTTP client and anti-bot/CAPTCHA detection."""

from __future__ import annotations

import hashlib
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import httpx

DEFAULT_HEADERS = {
    "User-Agent": "TalentInsightVN/1.0 (+https://github.com/Li-bot-dv/TalentInsight; market-research-bot)",
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}

ANTIBOT_MARKERS = (
    "cf-browser-verification",
    "cloudflare",
    "just a moment...",
    "captcha",
    "recaptcha",
    "hcaptcha",
    "turnstile",
    "verify you are human",
    "access denied",
)


class AntiBotBlockedError(Exception):
    """Raised when a remote site presents a CAPTCHA, Cloudflare gate, or 403 block."""


@dataclass
class CrawledJob:
    company_id: int
    external_id: str
    source: str
    title: str
    department: str
    seniority: str
    is_senior: bool
    location: str
    url: str
    posted_date: str
    salary_min_vnd: int | None = None
    salary_max_vnd: int | None = None
    status: str = "ACTIVE"


@dataclass
class CrawledMovement:
    company_id: int
    title: str
    summary: str
    category: str
    impact: str
    event_date: str
    source_name: str
    source_url: str


@dataclass
class CrawlBatchResult:
    source: str
    status: str = "COMPLETED"
    companies_scanned: int = 0
    jobs: list[CrawledJob] = field(default_factory=list)
    movements: list[CrawledMovement] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def make_external_id(source: str, company_slug: str, title: str, url: str = "") -> str:
    raw = f"{source}|{company_slug}|{title.strip().lower()}|{url.strip().lower()}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def detect_antibot(status_code: int, body: str) -> bool:
    if status_code in (403, 429, 503):
        lower = body[:4000].lower()
        if any(marker in lower for marker in ANTIBOT_MARKERS) or status_code == 403:
            return True
    lower = body[:4000].lower()
    return any(marker in lower for marker in ("just a moment...", "cf-browser-verification", "verify you are human"))


class BaseSourceAdapter(ABC):
    source_name: str = "generic"
    rate_limit_seconds: float = 0.6

    def __init__(self, timeout: float = 12.0) -> None:
        self.timeout = timeout
        self._last_request_at = 0.0

    def _polite_wait(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.rate_limit_seconds:
            time.sleep(self.rate_limit_seconds - elapsed)
        self._last_request_at = time.monotonic()

    def fetch(self, client: httpx.Client, url: str, params: dict[str, Any] | None = None) -> httpx.Response:
        self._polite_wait()
        resp = client.get(url, params=params, headers=DEFAULT_HEADERS, timeout=self.timeout, follow_redirects=True)
        if detect_antibot(resp.status_code, resp.text):
            raise AntiBotBlockedError(
                f"{self.source_name} returned HTTP {resp.status_code} (anti-bot/CAPTCHA gate at {url})"
            )
        resp.raise_for_status()
        return resp

    @abstractmethod
    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        """Fetch jobs or market movements for the given watchlist companies."""
