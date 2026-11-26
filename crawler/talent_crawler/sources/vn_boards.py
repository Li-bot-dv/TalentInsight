"""Vietnam job-board crawler adapters: TopDev, ITviec, VietnamWorks, CareerViet."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any
from urllib.parse import quote_plus, urljoin

import httpx
from bs4 import BeautifulSoup

from ..classifiers import classify_department, classify_seniority, normalize_location
from .base import (
    AntiBotBlockedError,
    BaseSourceAdapter,
    CrawlBatchResult,
    CrawledJob,
    make_external_id,
)


def _match_company(text: str, companies: list[dict[str, Any]]) -> dict[str, Any] | None:
    hay = (text or "").lower()
    for comp in companies:
        keywords = comp.get("search_keywords") or []
        if isinstance(keywords, str):
            try:
                keywords = json.loads(keywords)
            except json.JSONDecodeError:
                keywords = [comp["name"]]
        candidates = [comp["name"], comp.get("short_name", ""), *keywords]
        for kw in candidates:
            kw_clean = (kw or "").strip().lower()
            if len(kw_clean) >= 3 and re.search(rf"\b{re.escape(kw_clean)}\b", hay):
                return comp
    return None


class TopDevAdapter(BaseSourceAdapter):
    """Public TopDev Vietnam tech job board adapter (v2 public search API)."""

    source_name = "topdev"
    API_URL = "https://api.topdev.vn/td/v2/jobs"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client() as client:
            for comp in companies:
                result.companies_scanned += 1
                query = comp.get("short_name") or comp["name"]
                try:
                    resp = self.fetch(client, self.API_URL, params={"keyword": query, "page": 1, "limit": 20})
                    payload = resp.json()
                    items = payload.get("data") or []
                    for item in items:
                        company_block = item.get("company") or {}
                        employer_name = company_block.get("display_name") or company_block.get("name") or ""
                        matched = _match_company(employer_name, [comp])
                        if not matched:
                            continue
                        title = (item.get("title") or "").strip()
                        if not title:
                            continue
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)
                        raw_loc = ", ".join(item.get("addresses", {}).get("full_addresses", [])[:1]) if isinstance(item.get("addresses"), dict) else ""
                        location = normalize_location(raw_loc, default=comp.get("hq_city", "Ho Chi Minh City"))
                        url = item.get("detail_url") or f"https://topdev.vn/detail-jobs/{item.get('slug', '')}"
                        ext_id = str(item.get("id") or make_external_id(self.source_name, comp["slug"], title, url))
                        result.jobs.append(
                            CrawledJob(
                                company_id=comp["id"],
                                external_id=ext_id,
                                source=self.source_name,
                                title=title,
                                department=department,
                                seniority=seniority,
                                is_senior=is_senior,
                                location=location,
                                url=url,
                                posted_date=(item.get("published") or {}).get("date", today)[:10]
                                if isinstance(item.get("published"), dict)
                                else today,
                            )
                        )
                except AntiBotBlockedError as exc:
                    result.status = "BLOCKED_ANTIBOT"
                    result.errors.append(str(exc))
                    break
                except Exception as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")

        if result.errors and result.status == "COMPLETED":
            result.status = "PARTIAL" if result.jobs else "FAILED"
        return result


class ITviecAdapter(BaseSourceAdapter):
    """Public ITviec Vietnam IT jobs listing adapter (HTML parser, respects anti-bot boundaries)."""

    source_name = "itviec"
    BASE_URL = "https://itviec.com"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client() as client:
            for comp in companies:
                result.companies_scanned += 1
                slug_query = quote_plus(comp.get("short_name") or comp["name"])
                url = f"{self.BASE_URL}/it-jobs/{slug_query}"
                try:
                    resp = self.fetch(client, url)
                    soup = BeautifulSoup(resp.text, "lxml")
                    for card in soup.select("div.job-card, article.job"):
                        title_el = card.select_one("h3 a, h2 a, a.job-title")
                        emp_el = card.select_one(".employer-name, .company-name, a[href*='/companies/']")
                        if not title_el:
                            continue
                        title = title_el.get_text(" ", strip=True)
                        emp_name = emp_el.get_text(" ", strip=True) if emp_el else ""
                        if emp_name and not _match_company(emp_name, [comp]):
                            continue
                        href = urljoin(self.BASE_URL, title_el.get("href", ""))
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)
                        loc_el = card.select_one(".city, .address, .location")
                        location = normalize_location(
                            loc_el.get_text(" ", strip=True) if loc_el else "",
                            default=comp.get("hq_city", "Ho Chi Minh City"),
                        )
                        result.jobs.append(
                            CrawledJob(
                                company_id=comp["id"],
                                external_id=make_external_id(self.source_name, comp["slug"], title, href),
                                source=self.source_name,
                                title=title,
                                department=department,
                                seniority=seniority,
                                is_senior=is_senior,
                                location=location,
                                url=href,
                                posted_date=today,
                            )
                        )
                except AntiBotBlockedError as exc:
                    result.status = "BLOCKED_ANTIBOT"
                    result.errors.append(str(exc))
                    break
                except Exception as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")

        if result.errors and result.status == "COMPLETED":
            result.status = "PARTIAL" if result.jobs else "FAILED"
        return result


class VietnamWorksAdapter(BaseSourceAdapter):
    """Public VietnamWorks job search API adapter."""

    source_name = "vietnamworks"
    API_URL = "https://ms.vietnamworks.com/job-search/v1.0/search"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client() as client:
            for comp in companies:
                result.companies_scanned += 1
                query = comp.get("short_name") or comp["name"]
                try:
                    self._polite_wait()
                    resp = client.post(
                        self.API_URL,
                        json={"query": query, "hitsPerPage": 20, "page": 0},
                        headers={"Content-Type": "application/json", "User-Agent": "TalentInsightVN/1.0"},
                        timeout=self.timeout,
                    )
                    if resp.status_code in (403, 429):
                        raise AntiBotBlockedError(f"VietnamWorks returned HTTP {resp.status_code}")
                    resp.raise_for_status()
                    payload = resp.json()
                    for item in payload.get("data") or []:
                        emp_name = item.get("companyName") or ""
                        if not _match_company(emp_name, [comp]):
                            continue
                        title = (item.get("jobTitle") or "").strip()
                        if not title:
                            continue
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)
                        locs = item.get("workingLocations") or []
                        raw_loc = locs[0].get("cityName", "") if locs and isinstance(locs[0], dict) else ""
                        location = normalize_location(raw_loc, default=comp.get("hq_city", "Ho Chi Minh City"))
                        url = item.get("jobUrl") or f"https://www.vietnamworks.com/job-{item.get('jobId', '')}"
                        sal_min = item.get("salaryMin")
                        sal_max = item.get("salaryMax")
                        # Convert USD salary to VND when values look like USD (< 50,000)
                        if isinstance(sal_min, (int, float)) and 0 < sal_min < 50_000:
                            sal_min = int(sal_min * 25_400)
                        if isinstance(sal_max, (int, float)) and 0 < sal_max < 50_000:
                            sal_max = int(sal_max * 25_400)
                        result.jobs.append(
                            CrawledJob(
                                company_id=comp["id"],
                                external_id=str(item.get("jobId") or make_external_id(self.source_name, comp["slug"], title, url)),
                                source=self.source_name,
                                title=title,
                                department=department,
                                seniority=seniority,
                                is_senior=is_senior,
                                location=location,
                                url=url,
                                posted_date=str(item.get("approvedOn") or today)[:10],
                                salary_min_vnd=int(sal_min) if sal_min else None,
                                salary_max_vnd=int(sal_max) if sal_max else None,
                            )
                        )
                except AntiBotBlockedError as exc:
                    result.status = "BLOCKED_ANTIBOT"
                    result.errors.append(str(exc))
                    break
                except Exception as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")

        if result.errors and result.status == "COMPLETED":
            result.status = "PARTIAL" if result.jobs else "FAILED"
        return result


class CareerVietAdapter(BaseSourceAdapter):
    """Public CareerViet (formerly CareerBuilder VN) HTML listings adapter."""

    source_name = "careerviet"
    BASE_URL = "https://careerviet.vn"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client() as client:
            for comp in companies:
                result.companies_scanned += 1
                kw = quote_plus((comp.get("short_name") or comp["name"]).lower().replace(" ", "-"))
                url = f"{self.BASE_URL}/viec-lam/{kw}-k-vi.html"
                try:
                    resp = self.fetch(client, url)
                    soup = BeautifulSoup(resp.text, "lxml")
                    for card in soup.select("div.job-item, div.figcaption"):
                        title_el = card.select_one("a.job_link, h2 a")
                        emp_el = card.select_one("a.company-name")
                        if not title_el:
                            continue
                        title = title_el.get_text(" ", strip=True)
                        emp_name = emp_el.get_text(" ", strip=True) if emp_el else ""
                        if emp_name and not _match_company(emp_name, [comp]):
                            continue
                        href = urljoin(self.BASE_URL, title_el.get("href", ""))
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)
                        loc_el = card.select_one(".location")
                        location = normalize_location(
                            loc_el.get_text(" ", strip=True) if loc_el else "",
                            default=comp.get("hq_city", "Ho Chi Minh City"),
                        )
                        result.jobs.append(
                            CrawledJob(
                                company_id=comp["id"],
                                external_id=make_external_id(self.source_name, comp["slug"], title, href),
                                source=self.source_name,
                                title=title,
                                department=department,
                                seniority=seniority,
                                is_senior=is_senior,
                                location=location,
                                url=href,
                                posted_date=today,
                            )
                        )
                except AntiBotBlockedError as exc:
                    result.status = "BLOCKED_ANTIBOT"
                    result.errors.append(str(exc))
                    break
                except Exception as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")

        if result.errors and result.status == "COMPLETED":
            result.status = "PARTIAL" if result.jobs else "FAILED"
        return result
