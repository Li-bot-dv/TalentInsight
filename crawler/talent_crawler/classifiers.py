"""Job title classifiers (EN + VI) for seniority, department, location, and hiring velocity."""

from __future__ import annotations

import re
from typing import Tuple

SENIOR_TIERS = {"C_LEVEL", "VP", "DIRECTOR_HEAD", "PRINCIPAL_STAFF", "SENIOR_MANAGER"}

_SENIORITY_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "C_LEVEL",
        re.compile(
            r"\b(ceo|cto|cfo|coo|cio|cpo|cmo|cro|ciso|cdo|chief\s+\w+\s+officer|"
            r"tổng\s*giám\s*đốc|phó\s*tổng\s*giám\s*đốc|giám\s*đốc\s*điều\s*hành)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "VP",
        re.compile(
            r"\b(svp|evp|avp|vp|vice\s+president|managing\s+director|phó\s+chủ\s+tịch)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "DIRECTOR_HEAD",
        re.compile(
            r"\b(director|head\s+of|country\s+head|general\s+manager|giám\s*đốc\s+(khối|bộ\s*phận|công\s*nghệ|sản\s*phẩm|rủi\s*ro|dữ\s*liệu|kinh\s*doanh|tài\s*chính|nhân\s*sự)|"
            r"giám\s*đốc\s+trung\s*tâm)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "PRINCIPAL_STAFF",
        re.compile(
            r"\b(principal|staff\s+(software|backend|frontend|data|ml|ai|security|cloud|platform|devops|qa|product)?\s*(engineer|developer|architect|scientist|designer)?|"
            r"distinguished|enterprise\s+architect|solutions?\s+architect|chief\s+architect|kiến\s*trúc\s*sư)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "SENIOR_MANAGER",
        re.compile(
            r"\b(senior\s+manager|engineering\s+manager|product\s+manager\s*lead|group\s+product\s+manager|"
            r"tech\s*lead|technical\s+lead|chapter\s+lead|squad\s+lead|delivery\s+manager|"
            r"trưởng\s*phòng|trưởng\s*bộ\s*phận|trưởng\s*nhóm|quản\s*lý\s*cấp\s*cao)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "SENIOR",
        re.compile(
            r"\b(senior|sr\.?|lead|specialist|chuyên\s*viên\s*cao\s*cấp|chuyên\s*gia)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "JUNIOR",
        re.compile(
            r"\b(intern|fresher|junior|jr\.?|graduate|trainee|thực\s*tập|mới\s*ra\s*trường)\b",
            re.IGNORECASE,
        ),
    ),
]

_DEPARTMENT_RULES: list[tuple[str, re.Pattern[str]]] = [
    (
        "Data & AI",
        re.compile(
            r"\b(data|ai|machine\s+learning|ml|analytics|bi|business\s+intelligence|llm|nlp|mlops|scientist|dữ\s*liệu|phân\s*tích)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Risk & Credit",
        re.compile(
            r"\b(risk|credit|underwriting|fraud|scoring|model\s+validation|basel|ifrs|rủi\s*ro|tín\s*dụng|thẩm\s*định)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Operations & Collections",
        re.compile(
            r"\b(collections?|recovery|operations|call\s+center|contact\s+center|thu\s*hồi\s*nợ|vận\s*hành|telesales|field\s+collections?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Product",
        re.compile(
            r"\b(product\s+(manager|owner|director|head|designer|lead)|ux|ui|design|sản\s*phẩm)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Engineering",
        re.compile(
            r"\b(engineer|developer|software|backend|frontend|fullstack|full-stack|mobile|ios|android|"
            r"devops|sre|cloud|security|cyber|qa|qc|tester|automation|architect|platform|infrastructure|"
            r"java|golang|python|node|react|flutter|kỹ\s*sư|lập\s*trình|công\s*nghệ)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Digital Banking",
        re.compile(
            r"\b(digital\s+bank|retail\s+bank|sme\s+bank|corporate\s+bank|cards?|payment|fintech|treasury|wealth|ngân\s*hàng\s*số|thẻ|thanh\s*toán)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Compliance & Legal",
        re.compile(
            r"\b(compliance|aml|kyc|legal|audit|governance|tuân\s*thủ|pháp\s*chế|kiểm\s*toán)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Sales & BD",
        re.compile(
            r"\b(sales|business\s+development|relationship\s+manager|partnership|growth|marketing|commercial|kinh\s*doanh|khách\s*hàng)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "People & Finance",
        re.compile(
            r"\b(hr|human\s+resources|talent|recruit|finance|accounting|fp&a|nhân\s*sự|tuyển\s*dụng|tài\s*chính|kế\s*toán)\b",
            re.IGNORECASE,
        ),
    ),
]


def classify_seniority(title: str) -> Tuple[str, bool]:
    """Return (seniority_tier, is_senior_leadership_flag) for a job title."""
    cleaned = (title or "").strip()
    for tier, pattern in _SENIORITY_RULES:
        if pattern.search(cleaned):
            return tier, tier in SENIOR_TIERS
    return "MID", False


def classify_department(title: str, fallback: str = "Engineering") -> str:
    """Infer department/function from a job title."""
    cleaned = (title or "").strip()
    for dept, pattern in _DEPARTMENT_RULES:
        if pattern.search(cleaned):
            return dept
    return fallback


def normalize_location(raw: str | None, default: str = "Ho Chi Minh City") -> str:
    """Normalize Vietnamese city names to consistent English labels."""
    text = (raw or "").lower()
    if any(k in text for k in ("hcm", "ho chi minh", "hồ chí minh", "saigon", "sài gòn", "tp.hcm")):
        return "Ho Chi Minh City"
    if any(k in text for k in ("hanoi", "ha noi", "hà nội", "hn")):
        return "Hanoi"
    if any(k in text for k in ("da nang", "đà nẵng", "danang")):
        return "Da Nang"
    if "remote" in text or "hybrid" in text:
        return "Hybrid / Vietnam"
    return default


def classify_velocity_status(active_jobs: int, mom_change_pct: float) -> str:
    """Categorize hiring velocity into SURGE / GROWING / STABLE / SLOWDOWN / FREEZE."""
    if active_jobs <= 1 or mom_change_pct <= -25.0:
        return "FREEZE"
    if mom_change_pct >= 20.0:
        return "SURGE"
    if mom_change_pct >= 6.0:
        return "GROWING"
    if mom_change_pct <= -8.0:
        return "SLOWDOWN"
    return "STABLE"
