"""Vietnam job-board crawler adapters: TopDev, VietnamWorks, CareerViet, and ITviec."""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Any
from urllib.parse import quote_plus, urljoin

import httpx
from bs4 import BeautifulSoup

from ..classifiers import SENIOR_TIERS, classify_department, classify_seniority, normalize_location
from .base import (
    AntiBotBlockedError,
    BaseSourceAdapter,
    CrawlBatchResult,
    CrawledJob,
    make_external_id,
)

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}


def _match_company(employer_name: str, comp: dict[str, Any]) -> bool:
    hay = (employer_name or "").lower()
    if not hay:
        return False
    keywords = comp.get("search_keywords") or []
    if isinstance(keywords, str):
        try:
            keywords = json.loads(keywords)
        except json.JSONDecodeError:
            keywords = [comp["name"]]
    # Exclude FE Credit when matching VPBank so subsidiaries stay separated cleanly
    if comp["slug"] == "vpbank" and ("fe credit" in hay or "smbc" in hay or "cake" in hay):
        return False
    if comp["slug"] == "mb-bank" and ("mcredit" in hay or "shinsei" in hay):
        return False
    if comp["slug"] == "hdbank" and "saison" in hay:
        return False

    candidates = [comp["name"], comp.get("short_name", ""), *keywords]
    for kw in candidates:
        kw_clean = (kw or "").strip().lower()
        if len(kw_clean) < 3:
            continue
        if re.search(rf"(?<!\w){re.escape(kw_clean)}(?!\w)", hay):
            return True
    return False


def _parse_salary_trieu(text: str) -> tuple[int | None, int | None]:
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|m)\b", text, re.I)
    if m:
        lo = float(m.group(1).replace(",", "."))
        hi = float(m.group(2).replace(",", "."))
        return int(lo * 1_000_000), int(hi * 1_000_000)
    return None, None


class TopDevAdapter(BaseSourceAdapter):
    """Public TopDev Vietnam tech job board adapter (v2 public search API)."""

    source_name = "topdev"
    rate_limit_seconds = 0.25
    API_URL = "https://api.topdev.vn/td/v2/jobs"
    FIELDS = "id,title,slug,company,addresses,salary,published,detail_url"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client(headers=BROWSER_HEADERS, timeout=self.timeout, follow_redirects=True) as client:
            for comp in companies:
                result.companies_scanned += 1
                query = comp.get("short_name") or comp["name"]
                try:
                    self._polite_wait()
                    resp = client.get(
                        self.API_URL,
                        params={"fields[job]": self.FIELDS, "keyword": query, "page": 1, "limit": 50},
                    )
                    if resp.status_code in (403, 429):
                        raise AntiBotBlockedError(f"TopDev returned HTTP {resp.status_code}")
                    resp.raise_for_status()
                    payload = resp.json()
                    for item in payload.get("data") or []:
                        company_block = item.get("company") or {}
                        employer_name = company_block.get("display_name") or company_block.get("name") or ""
                        if not _match_company(employer_name, comp):
                            continue
                        title = (item.get("title") or "").strip()
                        if not title:
                            continue
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)
                        addrs = item.get("addresses") or {}
                        raw_loc = ""
                        if isinstance(addrs, dict):
                            fulls = addrs.get("full_addresses") or addrs.get("address_region_array") or []
                            raw_loc = fulls[0] if fulls else str(addrs.get("sort_addresses") or "")
                        location = normalize_location(raw_loc, default=comp.get("hq_city", "Ho Chi Minh City"))
                        url = item.get("detail_url") or f"https://topdev.vn/detail-jobs/{item.get('slug', '')}"
                        sal = item.get("salary") or {}
                        raw_min = sal.get("min_estimate") or sal.get("min") if isinstance(sal, dict) else None
                        raw_max = sal.get("max_estimate") or sal.get("max") if isinstance(sal, dict) else None
                        sal_min: int | None = None
                        sal_max: int | None = None
                        for raw_val, target in ((raw_min, "min"), (raw_max, "max")):
                            if isinstance(raw_val, (int, float)) and raw_val > 0:
                                parsed_v = int(raw_val * 25_400) if raw_val < 50_000 else int(raw_val)
                                if target == "min":
                                    sal_min = parsed_v
                                else:
                                    sal_max = parsed_v
                            elif isinstance(raw_val, str) and raw_val.strip().isdigit():
                                num = int(raw_val.strip())
                                if num > 0:
                                    parsed_v = int(num * 25_400) if num < 50_000 else num
                                    if target == "min":
                                        sal_min = parsed_v
                                    else:
                                        sal_max = parsed_v
                        pub = item.get("published")
                        posted = today
                        if isinstance(pub, dict) and pub.get("date"):
                            raw_d = str(pub["date"])[:10]
                            if re.match(r"\d{2}-\d{2}-\d{4}", raw_d):
                                posted = datetime.strptime(raw_d, "%d-%m-%Y").date().isoformat()
                            elif re.match(r"\d{4}-\d{2}-\d{2}", raw_d):
                                posted = raw_d

                        result.jobs.append(
                            CrawledJob(
                                company_id=comp["id"],
                                external_id=str(item.get("id") or make_external_id(self.source_name, comp["slug"], title, url)),
                                source=self.source_name,
                                title=title,
                                department=department,
                                seniority=seniority,
                                is_senior=is_senior,
                                location=location,
                                url=url,
                                posted_date=posted,
                                salary_min_vnd=sal_min,
                                salary_max_vnd=sal_max,
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
    rate_limit_seconds = 0.25
    API_URL = "https://ms.vietnamworks.com/job-search/v1.0/search"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client(headers={**BROWSER_HEADERS, "Content-Type": "application/json"}, timeout=self.timeout) as client:
            for comp in companies:
                result.companies_scanned += 1
                query = comp.get("short_name") or comp["name"]
                try:
                    self._polite_wait()
                    resp = client.post(self.API_URL, json={"query": query, "hitsPerPage": 50, "page": 0})
                    if resp.status_code in (403, 429):
                        raise AntiBotBlockedError(f"VietnamWorks returned HTTP {resp.status_code}")
                    resp.raise_for_status()
                    payload = resp.json()
                    for item in payload.get("data") or []:
                        emp_name = item.get("companyName") or ""
                        if not _match_company(emp_name, comp):
                            continue
                        title = (item.get("jobTitle") or "").strip()
                        if not title:
                            continue
                        seniority, is_senior = classify_seniority(title)
                        # Use VietnamWorks structured jobLevel when title doesn't specify seniority
                        jl = str(item.get("jobLevel") or "").lower()
                        if not is_senior:
                            if "director" in jl:
                                seniority, is_senior = "DIRECTOR_HEAD", True
                            elif "manager" in jl and "non-manager" not in jl:
                                seniority, is_senior = "SENIOR_MANAGER", True

                        department = classify_department(title)
                        locs = item.get("workingLocations") or []
                        raw_loc = locs[0].get("cityName", "") if locs and isinstance(locs[0], dict) else ""
                        location = normalize_location(raw_loc, default=comp.get("hq_city", "Ho Chi Minh City"))
                        url = item.get("jobUrl") or f"https://www.vietnamworks.com/job-{item.get('jobId', '')}"
                        sal_min = item.get("salaryMin") or None
                        sal_max = item.get("salaryMax") or None
                        if isinstance(sal_min, (int, float)) and 0 < sal_min < 50_000:
                            sal_min = int(sal_min * 25_400)
                        if isinstance(sal_max, (int, float)) and 0 < sal_max < 50_000:
                            sal_max = int(sal_max * 25_400)
                        if not sal_min and item.get("prettySalary"):
                            sal_min, sal_max = _parse_salary_trieu(str(item["prettySalary"]))

                        result.jobs.append(
                            CrawledJob(
                                company_id=comp["id"],
                                external_id=str(item.get("jobId") or make_external_id(self.source_name, comp["slug"], title, url)),
                                source=self.source_name,
                                title=title,
                                department=department,
                                seniority=seniority,
                                is_senior=seniority in SENIOR_TIERS,
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
    """Public CareerViet (formerly CareerBuilder VN) Next.js SSR listings adapter."""

    source_name = "careerviet"
    rate_limit_seconds = 0.35
    BASE_URL = "https://careerviet.vn"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client(headers=BROWSER_HEADERS, timeout=self.timeout, follow_redirects=True) as client:
            for comp in companies:
                result.companies_scanned += 1
                kw = quote_plus((comp.get("short_name") or comp["name"]).lower().replace(" ", "-"))
                url = f"{self.BASE_URL}/viec-lam/{kw}-k-vi.html"
                try:
                    self._polite_wait()
                    resp = client.get(url)
                    if resp.status_code in (403, 429):
                        raise AntiBotBlockedError(f"CareerViet returned HTTP {resp.status_code}")
                    resp.raise_for_status()
                    soup = BeautifulSoup(resp.text, "lxml")
                    seen_hrefs: set[str] = set()

                    for emp_link in soup.select("a[href*='/vi/nha-tuyen-dung/']"):
                        emp_name = emp_link.get_text(" ", strip=True)
                        if not _match_company(emp_name, comp):
                            continue
                        card = emp_link.find_parent("div")
                        # Walk up at most 3 levels to locate the full card containing the job link
                        job_link = None
                        for _ in range(3):
                            if not card:
                                break
                            cand = card.select_one("a[href*='/vi/tim-viec-lam/']")
                            if cand:
                                job_link = cand
                                break
                            card = card.parent
                        if not job_link or not card:
                            continue

                        href = urljoin(self.BASE_URL, job_link.get("href", ""))
                        if href in seen_hrefs:
                            continue
                        seen_hrefs.add(href)

                        title = job_link.get_text(" ", strip=True)
                        if not title or len(title) < 4:
                            continue

                        card_text = card.get_text(" ", strip=True)
                        posted = today
                        dm = re.search(r"Cập nhật\s*:\s*(\d{2}-\d{2}-\d{4})", card_text)
                        if dm:
                            try:
                                posted = datetime.strptime(dm.group(1), "%d-%m-%Y").date().isoformat()
                            except ValueError:
                                pass

                        sal_min, sal_max = _parse_salary_trieu(card_text)
                        location = normalize_location(card_text, default=comp.get("hq_city", "Ho Chi Minh City"))
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)

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
                                posted_date=posted,
                                salary_min_vnd=sal_min,
                                salary_max_vnd=sal_max,
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


class CareerLinkAdapter(BaseSourceAdapter):
    """Public CareerLink Vietnam open job board adapter."""

    source_name = "careerlink"
    rate_limit_seconds = 0.25
    BASE_URL = "https://www.careerlink.vn"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client(headers=BROWSER_HEADERS, timeout=self.timeout, follow_redirects=True) as client:
            for comp in companies:
                result.companies_scanned += 1
                query = comp.get("short_name") or comp["name"]
                try:
                    self._polite_wait()
                    resp = client.get(
                        f"{self.BASE_URL}/vieclam/list",
                        params={"keyword_use": "A", "keyword": query},
                    )
                    if resp.status_code in (403, 429):
                        raise AntiBotBlockedError(f"CareerLink returned HTTP {resp.status_code}")
                    resp.raise_for_status()
                    soup = BeautifulSoup(resp.text, "lxml")
                    seen: set[str] = set()
                    for link in soup.select("a[href*='/tim-viec-lam/']"):
                        parent = link.find_parent("li") or link.find_parent("div", class_=True)
                        if not parent:
                            continue
                        emp_el = parent.select_one("a[href*='/viec-lam-cua/']")
                        if not emp_el:
                            continue
                        if not _match_company(emp_el.get_text(" ", strip=True), comp):
                            continue
                        href = urljoin(self.BASE_URL, link.get("href", ""))
                        if href in seen:
                            continue
                        seen.add(href)
                        title = re.sub(r"^(Mới|Hot)\s+", "", link.get_text(" ", strip=True), flags=re.I).strip()
                        if len(title) < 4:
                            continue
                        card_text = parent.get_text(" ", strip=True)
                        sal_min, sal_max = _parse_salary_trieu(card_text)
                        location = normalize_location(card_text, default=comp.get("hq_city", "Ho Chi Minh City"))
                        seniority, is_senior = classify_seniority(title)
                        department = classify_department(title)
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
                                salary_min_vnd=sal_min,
                                salary_max_vnd=sal_max,
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
    """Public ITviec listing adapter (transparently reports Cloudflare anti-bot blocks)."""

    source_name = "itviec"
    BASE_URL = "https://itviec.com"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
            for comp in companies[:3]:
                result.companies_scanned += 1
                slug_query = quote_plus(comp.get("short_name") or comp["name"])
                try:
                    self.fetch(client, f"{self.BASE_URL}/it-jobs/{slug_query}")
                except AntiBotBlockedError as exc:
                    result.status = "BLOCKED_ANTIBOT"
                    result.errors.append(str(exc))
                    break
                except Exception as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")
        return result
