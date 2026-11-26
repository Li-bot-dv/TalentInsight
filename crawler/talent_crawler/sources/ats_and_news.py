"""Direct company career portal / ATS adapters and live Vietnam business/tech RSS movement detector."""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Any
from urllib.parse import quote_plus, urljoin

import feedparser
import httpx
from bs4 import BeautifulSoup

from ..classifiers import classify_department, classify_seniority, normalize_location
from .base import (
    AntiBotBlockedError,
    BaseSourceAdapter,
    CrawlBatchResult,
    CrawledJob,
    CrawledMovement,
    make_external_id,
)

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
}


class CompanyATSAdapter(BaseSourceAdapter):
    """Crawls direct company career sites via SmartRecruiters, VNG Careers, Greenhouse, Lever, or JSON-LD."""

    source_name = "company_ats"
    rate_limit_seconds = 0.25

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client(headers=BROWSER_HEADERS, timeout=self.timeout, follow_redirects=True) as client:
            for comp in companies:
                careers_url = (comp.get("careers_url") or "").strip()
                ats_type = (comp.get("ats_type") or "custom").lower()
                token = (comp.get("ats_board_token") or "").strip()
                if not careers_url and not token:
                    continue
                if ats_type not in ("smartrecruiters", "vng_next", "greenhouse", "lever"):
                    continue
                result.companies_scanned += 1
                try:
                    if ats_type == "smartrecruiters" and token:
                        offset = 0
                        limit = 100
                        while offset < 300:
                            self._polite_wait()
                            resp = client.get(
                                f"https://api.smartrecruiters.com/v1/companies/{token}/postings",
                                params={"country": "vn", "limit": limit, "offset": offset},
                            )
                            resp.raise_for_status()
                            payload = resp.json()
                            items = payload.get("content") or []
                            if not items:
                                break
                            for item in items:
                                title = (item.get("name") or "").strip()
                                if not title:
                                    continue
                                seniority, is_senior = classify_seniority(title)
                                dept_label = ((item.get("department") or {}).get("label") or "")
                                department = classify_department(f"{title} {dept_label}")
                                loc_obj = item.get("location") or {}
                                raw_loc = loc_obj.get("city") or loc_obj.get("fullLocation") or ""
                                location = normalize_location(raw_loc, default=comp.get("hq_city", "Ho Chi Minh City"))
                                pid = str(item.get("id") or "")
                                url = f"https://jobs.smartrecruiters.com/{token}/{pid}" if pid else careers_url
                                posted = str(item.get("releasedDate") or today)[:10]
                                result.jobs.append(
                                    CrawledJob(
                                        company_id=comp["id"],
                                        external_id=pid or make_external_id(self.source_name, comp["slug"], title, url),
                                        source=self.source_name,
                                        title=title,
                                        department=department,
                                        seniority=seniority,
                                        is_senior=is_senior,
                                        location=location,
                                        url=url,
                                        posted_date=posted,
                                    )
                                )
                            total_found = int(payload.get("totalFound") or 0)
                            offset += limit
                            if offset >= total_found:
                                break
                    elif ats_type == "vng_next":
                        base = careers_url or "https://career.vng.com.vn/co-hoi-nghe-nghiep"
                        page = 1
                        max_pages = 10
                        while page <= max_pages:
                            self._polite_wait()
                            resp = client.get(base, params={"page": page})
                            resp.raise_for_status()
                            soup = BeautifulSoup(resp.text, "lxml")
                            nd = soup.find("script", id="__NEXT_DATA__")
                            if not nd or not nd.string:
                                break
                            pp = json.loads(nd.string).get("props", {}).get("pageProps", {})
                            jobs_list = pp.get("jobs") or []
                            max_pages = min(15, int(pp.get("pages") or 1))
                            if not jobs_list:
                                break
                            for item in jobs_list:
                                title = (item.get("title") or "").strip()
                                if not title:
                                    continue
                                seniority, is_senior = classify_seniority(title)
                                family = str(item.get("job_family") or "")
                                department = classify_department(f"{title} {family}")
                                location = normalize_location(str(item.get("location") or ""), default="Ho Chi Minh City")
                                slug = item.get("slug") or ""
                                url = f"https://career.vng.com.vn/co-hoi-nghe-nghiep/{slug}" if slug else base
                                result.jobs.append(
                                    CrawledJob(
                                        company_id=comp["id"],
                                        external_id=str(item.get("job_id") or make_external_id(self.source_name, comp["slug"], title, url)),
                                        source=self.source_name,
                                        title=title,
                                        department=department,
                                        seniority=seniority,
                                        is_senior=is_senior,
                                        location=location,
                                        url=url,
                                        posted_date=today,
                                    )
                                )
                            page += 1
                    elif ats_type == "greenhouse" and token:
                        resp = self.fetch(client, f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs")
                        for item in resp.json().get("jobs", []):
                            title = (item.get("title") or "").strip()
                            if not title:
                                continue
                            seniority, is_senior = classify_seniority(title)
                            department = classify_department(title)
                            loc = (item.get("location") or {}).get("name", "")
                            result.jobs.append(
                                CrawledJob(
                                    company_id=comp["id"],
                                    external_id=str(item.get("id")),
                                    source=self.source_name,
                                    title=title,
                                    department=department,
                                    seniority=seniority,
                                    is_senior=is_senior,
                                    location=normalize_location(loc, default=comp.get("hq_city", "Ho Chi Minh City")),
                                    url=item.get("absolute_url") or careers_url,
                                    posted_date=str(item.get("updated_at") or today)[:10],
                                )
                            )
                    elif ats_type == "lever" and token:
                        resp = self.fetch(client, f"https://api.lever.co/v0/postings/{token}?mode=json")
                        for item in resp.json():
                            title = (item.get("text") or "").strip()
                            if not title:
                                continue
                            seniority, is_senior = classify_seniority(title)
                            department = classify_department(title)
                            loc = (item.get("categories") or {}).get("location", "")
                            result.jobs.append(
                                CrawledJob(
                                    company_id=comp["id"],
                                    external_id=str(item.get("id")),
                                    source=self.source_name,
                                    title=title,
                                    department=department,
                                    seniority=seniority,
                                    is_senior=is_senior,
                                    location=normalize_location(loc, default=comp.get("hq_city", "Ho Chi Minh City")),
                                    url=item.get("hostedUrl") or careers_url,
                                    posted_date=today,
                                )
                            )
                except AntiBotBlockedError as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")
                except Exception as exc:
                    result.errors.append(f"{comp['short_name']}: {exc}")

        if result.errors:
            result.status = "PARTIAL" if result.jobs else "FAILED"
        return result


class VietnamNewsRSSAdapter(BaseSourceAdapter):
    """Ingests live Vietnam business/tech RSS feeds + Google News VN RSS for Company Movements."""

    source_name = "vn_news_rss"
    rate_limit_seconds = 0.25

    FEEDS = [
        ("VnExpress Kinh Doanh", "https://vnexpress.net/rss/kinh-doanh.rss"),
        ("VnExpress Khoa học Công nghệ", "https://vnexpress.net/rss/so-hoa.rss"),
        ("CafeF Tài chính - Ngân hàng", "https://cafef.vn/tai-chinh-ngan-hang.rss"),
        ("CafeBiz Công nghệ", "https://cafebiz.vn/rss/cong-nghe.rss"),
        (
            "Google News VN (Banking)",
            "https://news.google.com/rss/search?q="
            + quote_plus("(Techcombank OR VPBank OR VIB OR MBBank OR Vietcombank OR ACB OR TPBank OR HDBank) (nhân sự OR bổ nhiệm OR tuyển dụng OR công nghệ OR AI)")
            + "&hl=vi&gl=VN&ceid=VN:vi",
        ),
        (
            "Google News VN (CFC)",
            "https://news.google.com/rss/search?q="
            + quote_plus('("FE Credit" OR "Home Credit" OR "HD SAISON" OR Mcredit OR "Mirae Asset Finance" OR "Shinhan Finance" OR "Lotte Finance" OR F88 OR VietCredit)')
            + "&hl=vi&gl=VN&ceid=VN:vi",
        ),
        (
            "Google News VN (Tech)",
            "https://news.google.com/rss/search?q="
            + quote_plus('(VNG OR "FPT Software" OR MoMo OR "Grab Việt Nam" OR "Shopee Việt Nam" OR VNPAY OR "NAB Vietnam" OR "Cake by VPBank" OR "Viettel Money") (tuyển dụng OR nhân sự OR AI OR mở rộng OR bổ nhiệm)')
            + "&hl=vi&gl=VN&ceid=VN:vi",
        ),
    ]

    CATEGORY_PATTERNS = [
        (
            "LEADERSHIP",
            "NEUTRAL",
            re.compile(r"\b(bổ nhiệm|miễn nhiệm|từ nhiệm|tân ceo|tổng giám đốc|phó tổng|chủ tịch|appointed|resigns|cfo|cto|ceo)\b", re.I),
        ),
        (
            "RESTRUCTURING",
            "NEGATIVE",
            re.compile(r"\b(cắt giảm|sa thải|tái cấu trúc|tinh gọn|thua lỗ|nợ xấu|layoff|restructur|downsiz|thu hẹp|cảnh báo)\b", re.I),
        ),
        (
            "M_AND_A",
            "POSITIVE",
            re.compile(r"\b(m&a|mua lại|sáp nhập|thương vụ|gọi vốn|rót vốn|chuyển nhượng|cổ phần|acquire|merger|funding|stake)\b", re.I),
        ),
        (
            "EXPANSION",
            "POSITIVE",
            re.compile(r"\b(mở rộng|trung tâm công nghệ|chi nhánh mới|văn phòng mới|ra mắt|expand|new hub|r&d|tăng trưởng|kỷ lục)\b", re.I),
        ),
        (
            "HIRING_DRIVE",
            "POSITIVE",
            re.compile(r"\b(tuyển dụng|nhân sự|nhân lực|hiring|talent|kỹ sư|thu nhập|lương thưởng)\b", re.I),
        ),
    ]

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name, companies_scanned=len(companies))
        seen_titles: set[str] = set()

        with httpx.Client(headers=BROWSER_HEADERS, timeout=self.timeout, follow_redirects=True) as client:
            for feed_name, feed_url in self.FEEDS:
                try:
                    self._polite_wait()
                    resp = client.get(feed_url)
                    resp.raise_for_status()
                    parsed = feedparser.parse(resp.text)
                    for entry in parsed.entries[:35]:
                        title = (entry.get("title") or "").strip()
                        if not title or title.lower() in seen_titles:
                            continue
                        raw_summary = BeautifulSoup(entry.get("summary") or "", "lxml").get_text(" ", strip=True)
                        summary = raw_summary[:300] if raw_summary else title
                        combined = f"{title} {summary}"

                        for comp in companies:
                            kws = comp.get("search_keywords") or []
                            if isinstance(kws, str):
                                try:
                                    kws = json.loads(kws)
                                except json.JSONDecodeError:
                                    kws = [comp["name"]]
                            if any(
                                len(kw) >= 3 and re.search(rf"(?<!\w){re.escape(kw)}(?!\w)", combined, re.IGNORECASE)
                                for kw in [comp["short_name"], *kws]
                            ):
                                category, impact = "PRODUCT_TECH", "NEUTRAL"
                                for cat, imp, pat in self.CATEGORY_PATTERNS:
                                    if pat.search(combined):
                                        category, impact = cat, imp
                                        break
                                pub_date = date.today().isoformat()
                                if entry.get("published_parsed"):
                                    pub_date = datetime(*entry.published_parsed[:6]).date().isoformat()
                                seen_titles.add(title.lower())
                                source_label = (entry.get("source") or {}).get("title") if isinstance(entry.get("source"), dict) else None
                                result.movements.append(
                                    CrawledMovement(
                                        company_id=comp["id"],
                                        title=title,
                                        summary=summary,
                                        category=category,
                                        impact=impact,
                                        event_date=pub_date,
                                        source_name=source_label or feed_name,
                                        source_url=entry.get("link") or "",
                                    )
                                )
                                break
                except Exception as exc:
                    result.errors.append(f"{feed_name}: {exc}")

        if result.errors:
            result.status = "PARTIAL" if result.movements else "FAILED"
        return result
