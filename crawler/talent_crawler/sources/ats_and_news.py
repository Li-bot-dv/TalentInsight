"""Direct company career portal / ATS adapters (Greenhouse, Lever, Generic HTML) and VN News RSS."""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Any
from urllib.parse import urljoin

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


class CompanyATSAdapter(BaseSourceAdapter):
    """Crawls direct company career sites via Greenhouse/Lever public APIs or structured career HTML."""

    source_name = "company_ats"

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name)
        today = date.today().isoformat()

        with httpx.Client() as client:
            for comp in companies:
                careers_url = (comp.get("careers_url") or "").strip()
                ats_type = (comp.get("ats_type") or "custom").lower()
                token = (comp.get("ats_board_token") or "").strip()
                if not careers_url and not token:
                    continue
                result.companies_scanned += 1
                try:
                    if ats_type == "greenhouse" and token:
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
                    elif careers_url:
                        resp = self.fetch(client, careers_url)
                        soup = BeautifulSoup(resp.text, "lxml")
                        # Look for JSON-LD JobPosting schema first (very reliable across career sites)
                        found_any = False
                        for script in soup.find_all("script", type="application/ld+json"):
                            try:
                                data = json.loads(script.string or "")
                            except json.JSONDecodeError:
                                continue
                            nodes = data if isinstance(data, list) else [data]
                            for node in nodes:
                                if isinstance(node, dict) and node.get("@type") == "JobPosting":
                                    title = (node.get("title") or "").strip()
                                    if not title:
                                        continue
                                    found_any = True
                                    seniority, is_senior = classify_seniority(title)
                                    department = classify_department(title)
                                    result.jobs.append(
                                        CrawledJob(
                                            company_id=comp["id"],
                                            external_id=make_external_id(self.source_name, comp["slug"], title, careers_url),
                                            source=self.source_name,
                                            title=title,
                                            department=department,
                                            seniority=seniority,
                                            is_senior=is_senior,
                                            location=comp.get("hq_city", "Ho Chi Minh City"),
                                            url=node.get("url") or careers_url,
                                            posted_date=str(node.get("datePosted") or today)[:10],
                                        )
                                    )
                        if not found_any:
                            for link in soup.select("a[href*='job'], a[href*='career'], a[href*='tuyen-dung']")[:25]:
                                title = link.get_text(" ", strip=True)
                                if len(title) < 8 or len(title) > 110:
                                    continue
                                if not re.search(
                                    r"(engineer|developer|manager|director|head|analyst|specialist|architect|lead|"
                                    r"chuyên viên|giám đốc|trưởng phòng|kỹ sư|lập trình)",
                                    title,
                                    re.IGNORECASE,
                                ):
                                    continue
                                href = urljoin(careers_url, link.get("href", ""))
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
                                        location=comp.get("hq_city", "Ho Chi Minh City"),
                                        url=href,
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
    """Ingests Vietnam finance/tech news RSS feeds to detect Company Movement signals."""

    source_name = "vn_news_rss"
    FEEDS = [
        ("VnExpress Kinh Doanh", "https://vnexpress.net/rss/kinh-doanh.rss"),
        ("VnExpress So Hoa", "https://vnexpress.net/rss/so-hoa.rss"),
        ("CafeF Tai Chinh", "https://cafef.vn/tai-chinh-ngan-hang.rss"),
    ]

    CATEGORY_PATTERNS = [
        ("LEADERSHIP", "NEUTRAL", re.compile(r"\b(bổ nhiệm|từ nhiệm|ceo|tổng giám đốc|chủ tịch|appointed|resigns|cfo|cto)\b", re.I)),
        ("RESTRUCTURING", "NEGATIVE", re.compile(r"\b(cắt giảm|sa thải|tái cấu trúc|layoff|restructur|downsiz|thu hẹp)\b", re.I)),
        ("M_AND_A", "POSITIVE", re.compile(r"\b(m&a|mua lại|sáp nhập|gọi vốn|đầu tư|acquire|merger|funding|stake)\b", re.I)),
        ("EXPANSION", "POSITIVE", re.compile(r"\b(mở rộng|trung tâm công nghệ|chi nhánh mới|expand|new hub|r&d center)\b", re.I)),
        ("HIRING_DRIVE", "POSITIVE", re.compile(r"\b(tuyển dụng|nhân sự|hiring|talent|nhân lực)\b", re.I)),
    ]

    def crawl(self, companies: list[dict[str, Any]]) -> CrawlBatchResult:
        result = CrawlBatchResult(source=self.source_name, companies_scanned=len(companies))

        with httpx.Client() as client:
            for feed_name, feed_url in self.FEEDS:
                try:
                    resp = self.fetch(client, feed_url)
                    parsed = feedparser.parse(resp.text)
                    for entry in parsed.entries[:40]:
                        title = (entry.get("title") or "").strip()
                        summary = BeautifulSoup(entry.get("summary") or "", "lxml").get_text(" ", strip=True)[:280]
                        combined = f"{title} {summary}"
                        for comp in companies:
                            kws = comp.get("search_keywords") or []
                            if isinstance(kws, str):
                                try:
                                    kws = json.loads(kws)
                                except json.JSONDecodeError:
                                    kws = [comp["name"]]
                            if any(
                                len(kw) >= 3 and re.search(rf"\b{re.escape(kw)}\b", combined, re.IGNORECASE)
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
                                result.movements.append(
                                    CrawledMovement(
                                        company_id=comp["id"],
                                        title=title,
                                        summary=summary or title,
                                        category=category,
                                        impact=impact,
                                        event_date=pub_date,
                                        source_name=feed_name,
                                        source_url=entry.get("link") or "",
                                    )
                                )
                                break
                except Exception as exc:
                    result.errors.append(f"{feed_name}: {exc}")

        if result.errors:
            result.status = "PARTIAL" if result.movements else "FAILED"
        return result
