"""Deterministic seeder creating a realistic 16-week Vietnam Tech / CFC / Banking market baseline."""

from __future__ import annotations

import random
import sqlite3
from datetime import date, datetime, timedelta, timezone

from .classifiers import classify_department, classify_seniority, classify_velocity_status
from .db import init_db, upsert_company, upsert_job, week_monday
from .watchlist import VIETNAM_WATCHLIST

# Company trajectory profiles: (base_jobs_16w_ago, target_current_jobs, senior_ratio, primary_depts)
COMPANY_PROFILES: dict[str, tuple[int, int, float, list[str]]] = {
    # TECH
    "vng-corporation": (36, 40, 0.24, ["Engineering", "Data & AI", "Product", "Sales & BD"]),
    "fpt-software": (58, 66, 0.18, ["Engineering", "Data & AI", "Product", "Sales & BD"]),
    "momo-mservice": (26, 35, 0.29, ["Engineering", "Data & AI", "Product", "Risk & Credit"]),
    "grab-vietnam": (24, 19, 0.34, ["Engineering", "Product", "Data & AI", "Sales & BD"]),
    "shopee-vietnam": (38, 28, 0.22, ["Engineering", "Product", "Operations & Collections", "Sales & BD"]),
    "vnpay": (22, 26, 0.23, ["Engineering", "Digital Banking", "Product", "Compliance & Legal"]),
    "nab-innovation-centre-vietnam": (32, 46, 0.33, ["Engineering", "Data & AI", "Product"]),
    "bosch-global-software-vietnam": (34, 31, 0.20, ["Engineering", "Data & AI", "Product"]),
    "cake-by-vpbank": (15, 24, 0.35, ["Engineering", "Data & AI", "Risk & Credit", "Digital Banking"]),
    "viettel-digital": (21, 26, 0.24, ["Engineering", "Data & AI", "Digital Banking", "Product"]),
    # CFC (Consumer Finance)
    "fe-credit": (36, 25, 0.28, ["Risk & Credit", "Operations & Collections", "Data & AI", "Engineering"]),
    "home-credit-vietnam": (24, 31, 0.26, ["Risk & Credit", "Data & AI", "Engineering", "Product"]),
    "hd-saison": (20, 22, 0.22, ["Risk & Credit", "Sales & BD", "Operations & Collections", "Engineering"]),
    "mcredit": (18, 23, 0.26, ["Risk & Credit", "Digital Banking", "Data & AI", "Engineering"]),
    "mirae-asset-finance-vietnam": (19, 16, 0.24, ["Risk & Credit", "Operations & Collections", "Sales & BD", "Compliance & Legal"]),
    "shinhan-finance-vietnam": (17, 15, 0.25, ["Risk & Credit", "Digital Banking", "Engineering", "Compliance & Legal"]),
    "lotte-finance-vietnam": (14, 9, 0.30, ["Risk & Credit", "Digital Banking", "Compliance & Legal"]),
    "shb-finance": (16, 14, 0.25, ["Risk & Credit", "Operations & Collections", "Sales & BD", "Data & AI"]),
    "f88": (22, 17, 0.23, ["Compliance & Legal", "Risk & Credit", "Operations & Collections", "Engineering"]),
    "vietcredit": (13, 8, 0.28, ["Risk & Credit", "Digital Banking", "Compliance & Legal"]),
    # BANKING
    "techcombank": (34, 49, 0.34, ["Engineering", "Data & AI", "Digital Banking", "Risk & Credit", "Product"]),
    "vpbank": (30, 38, 0.27, ["Digital Banking", "Engineering", "Risk & Credit", "Data & AI", "Sales & BD"]),
    "vib-bank": (24, 28, 0.26, ["Digital Banking", "Risk & Credit", "Engineering", "Product"]),
    "mb-bank": (28, 37, 0.28, ["Engineering", "Data & AI", "Digital Banking", "Product"]),
    "vietcombank": (24, 25, 0.20, ["Digital Banking", "Risk & Credit", "Engineering", "Compliance & Legal"]),
    "acb-bank": (22, 25, 0.22, ["Digital Banking", "Engineering", "Risk & Credit", "Sales & BD"]),
    "tpbank": (20, 22, 0.25, ["Engineering", "Digital Banking", "Data & AI", "Product"]),
    "hdbank": (19, 22, 0.23, ["Digital Banking", "Risk & Credit", "Sales & BD", "Engineering"]),
    "bidv": (21, 22, 0.19, ["Digital Banking", "Risk & Credit", "Compliance & Legal", "Engineering"]),
    "msb-bank": (18, 19, 0.25, ["Digital Banking", "Engineering", "Risk & Credit", "Product"]),
}

SENIOR_TITLES_BY_DEPT: dict[str, list[str]] = {
    "Engineering": [
        "VP of Platform Engineering",
        "Director of Cloud Infrastructure",
        "Head of Core Banking Engineering",
        "Principal Distributed Systems Architect",
        "Staff Backend Engineer (Go / Java)",
        "Engineering Manager – Core Payments",
        "Head of Cybersecurity & Cloud Sec",
        "Principal Mobile Architect (Super App)",
        "Giám đốc Công nghệ Khối Ngân hàng số",
        "Tech Lead – High-Throughput Ledger",
    ],
    "Data & AI": [
        "Chief Data & AI Officer",
        "Head of GenAI & Machine Learning",
        "Director of Enterprise Data Platform",
        "Principal ML Scientist (Credit Scoring)",
        "Staff Data Engineer (Lakehouse)",
        "Senior Manager – Customer Analytics",
        "Giám đốc Trung tâm Dữ liệu & AI",
    ],
    "Product": [
        "VP of Digital Lending Products",
        "Head of Retail Banking Product",
        "Director of Consumer FinTech Product",
        "Group Product Manager – Cards & BNPL",
        "Principal Product Designer (Design Systems)",
        "Trưởng phòng Phát triển Sản phẩm Số",
    ],
    "Risk & Credit": [
        "Chief Risk Officer (CRO)",
        "Head of Retail Credit Risk & Underwriting",
        "VP of Fraud & Anti-Financial Crime",
        "Director of Risk Modeling & IFRS9",
        "Senior Manager – Portfolio Credit Strategy",
        "Giám đốc Khối Quản trị Rủi ro Tín dụng",
    ],
    "Digital Banking": [
        "VP of Digital Banking Transformation",
        "Head of Open Banking & BaaS Partnerships",
        "Director of Digital Acquisition & Growth",
        "Head of Cards & Merchant Acquiring",
        "Giám đốc Khối Ngân hàng Số",
    ],
    "Operations & Collections": [
        "Head of Digital Collections & Recovery",
        "Director of Contact Center Transformation",
        "Senior Manager – Collections Analytics",
        "Trưởng phòng Chiến lược Thu hồi nợ",
    ],
    "Compliance & Legal": [
        "Head of Regulatory Compliance & AML",
        "Director of Legal – Consumer Finance",
        "VP of Internal Audit & IT Governance",
    ],
    "Sales & BD": [
        "Head of Strategic Merchant Partnerships",
        "Director of Bancassurance & Ecosystem Sales",
        "VP of Enterprise Commercial Growth",
    ],
}

IC_TITLES_BY_DEPT: dict[str, list[str]] = {
    "Engineering": [
        "Senior Backend Engineer (Java / Spring Boot)",
        "Senior Golang Engineer – Payment Gateway",
        "Frontend Engineer (React / TypeScript)",
        "Senior DevOps / Kubernetes Engineer",
        "Mobile Engineer (Flutter / iOS)",
        "QA Automation Engineer",
        "Cloud Security Engineer (AWS)",
        "Full-Stack Software Engineer",
    ],
    "Data & AI": [
        "Senior Data Scientist – Credit Risk",
        "Data Engineer (Spark / Airflow / dbt)",
        "Machine Learning Engineer (NLP / LLM)",
        "Senior BI & Analytics Specialist",
        "Analytics Engineer",
    ],
    "Product": [
        "Senior Product Manager – Digital Onboarding",
        "Product Owner – Core Lending",
        "Senior UX/UI Product Designer",
        "Product Analyst",
    ],
    "Risk & Credit": [
        "Senior Credit Risk Analyst",
        "Fraud Detection Specialist",
        "Credit Policy & Underwriting Specialist",
        "Model Validation Analyst",
    ],
    "Digital Banking": [
        "Digital Banking Partnership Specialist",
        "Senior Cards Product Specialist",
        "Payment Operations Specialist",
        "SME Digital Growth Specialist",
    ],
    "Operations & Collections": [
        "Collections Strategy Analyst",
        "Digital Operations Specialist",
        "Field Recovery Operations Coordinator",
    ],
    "Compliance & Legal": [
        "AML / KYC Compliance Officer",
        "Senior Legal Counsel – FinTech",
        "IT Risk & Audit Specialist",
    ],
    "Sales & BD": [
        "Key Account Partnership Manager",
        "Corporate Relationship Manager",
        "Growth Marketing Specialist",
    ],
}

SALARY_BANDS_VND: dict[str, tuple[int, int]] = {
    "C_LEVEL": (180_000_000, 320_000_000),
    "VP": (130_000_000, 220_000_000),
    "DIRECTOR_HEAD": (95_000_000, 165_000_000),
    "PRINCIPAL_STAFF": (75_000_000, 130_000_000),
    "SENIOR_MANAGER": (60_000_000, 105_000_000),
    "SENIOR": (40_000_000, 70_000_000),
    "MID": (24_000_000, 42_000_000),
    "JUNIOR": (14_000_000, 24_000_000),
}

SOURCES_BY_SECTOR = {
    "TECH": ["itviec", "topdev", "company_ats", "vietnamworks"],
    "CFC": ["vietnamworks", "careerviet", "company_ats", "topdev"],
    "BANKING": ["vietnamworks", "company_ats", "careerviet", "itviec"],
}

CURATED_MOVEMENTS: list[tuple[str, str, str, str, str, int, str]] = [
    # (slug, title, summary, category, impact, days_ago, source_name)
    (
        "techcombank",
        "Techcombank launches 300-headcount AI & Cloud Engineering hiring wave across Hanoi and HCMC",
        "Accelerating its cloud-native core and GenAI advisory roadmap, Techcombank opened dedicated Principal Engineer, Staff Data Scientist, and VP Engineering tracks.",
        "HIRING_DRIVE",
        "POSITIVE",
        2,
        "VnExpress Kinh Doanh",
    ),
    (
        "fe-credit",
        "FE Credit shifts from field-sales expansion to Risk Analytics & Digital Collections transformation",
        "Following ongoing portfolio stabilization with VPBank & SMBC, FE Credit trimmed traditional sales requisitions by 28% while prioritizing Head-level Risk & Data roles.",
        "RESTRUCTURING",
        "NEGATIVE",
        4,
        "CafeF Tai Chinh",
    ),
    (
        "nab-innovation-centre-vietnam",
        "NAB Innovation Centre Vietnam expands HCMC & Hanoi tech hubs beyond 2,500 engineers",
        "Australia's largest business bank continues aggressive senior engineering recruitment in Vietnam, drawing Staff/Principal talent from local outsourcing and e-commerce players.",
        "EXPANSION",
        "POSITIVE",
        5,
        "ITviec Market Pulse",
    ),
    (
        "home-credit-vietnam",
        "Home Credit Vietnam accelerates digital lending squad hiring following SCBX strategic transition",
        "Expanded open requisitions in BNPL product management, real-time credit scoring, and mobile engineering as it scales digital origination past 75% of volume.",
        "M_AND_A",
        "POSITIVE",
        7,
        "DealStreetAsia",
    ),
    (
        "cake-by-vpbank",
        "Cake by VPBank appoints new VP of AI & Core Lending to scale autonomous credit underwriting",
        "The AI-first digital bank recorded the highest MoM hiring velocity (+42%) in the Vietnam watchlist, competing directly with Tier-1 tech firms for ML engineers.",
        "LEADERSHIP",
        "POSITIVE",
        9,
        "Tech in Asia",
    ),
    (
        "momo-mservice",
        "MoMo consolidates FinTech Financial Services vertical and opens 12 Senior/Staff AI roles",
        "Positioning as an AI-powered financial assistant, MoMo is actively hiring credit risk leads and Staff ML engineers from regional fintechs and consumer finance companies.",
        "PRODUCT_TECH",
        "POSITIVE",
        11,
        "VnExpress So Hoa",
    ),
    (
        "shopee-vietnam",
        "Shopee Vietnam tightens corporate & ops headcount while focusing selectively on ShopeePay",
        "Job volume declined 18% MoM after seasonal campaign staffing ended; engineering outflows are increasingly absorbed by banking tech hubs and MoMo.",
        "RESTRUCTURING",
        "NEGATIVE",
        13,
        "Market Intelligence",
    ),
    (
        "mb-bank",
        "MB Bank scales BaaS & Super-App engineering division with new Da Nang satellite squad",
        "MB Bank opened senior cloud, API platform, and security leadership requisitions to support over 30M active digital users.",
        "EXPANSION",
        "POSITIVE",
        15,
        "CafeF Tai Chinh",
    ),
    (
        "vietcredit",
        "VietCredit pauses non-essential hiring amid digital card pivot and credit portfolio tightening",
        "Active job postings dropped over 30% MoM; remaining openings are concentrated in risk governance and digital partnership compliance.",
        "RESTRUCTURING",
        "NEGATIVE",
        17,
        "CafeF Tai Chinh",
    ),
    (
        "vpbank",
        "VPBank recruits ex-Tech & CFC executives to lead SME Digital Lending & Ecosystem Risk",
        "Significant senior talent inflow recorded from FE Credit, Shopee, and regional banks as VPBank expands its affluent and SME digital banking suites.",
        "LEADERSHIP",
        "POSITIVE",
        19,
        "VnExpress Kinh Doanh",
    ),
    (
        "fpt-software",
        "FPT Software expands AI Factory engineering teams in Hanoi and Ho Chi Minh City",
        "Strong demand for MLOps, LLM engineers, and automotive embedded leads drives a +12% MoM uptick in technical openings.",
        "HIRING_DRIVE",
        "POSITIVE",
        21,
        "VnExpress So Hoa",
    ),
    (
        "mcredit",
        "Mcredit ramps up embedded finance & BNPL engineering hires in Hanoi and HCMC",
        "Backed by MB Bank and Shinsei, Mcredit increased active job postings by 16% MoM with emphasis on digital underwriting and partner API integration.",
        "HIRING_DRIVE",
        "POSITIVE",
        23,
        "Market Intelligence",
    ),
    (
        "vib-bank",
        "VIB launches cloud-native card personalization platform; opens 8 Director & Lead roles",
        "VIB continues poaching digital product and card analytics leaders from consumer finance firms and e-commerce players.",
        "PRODUCT_TECH",
        "POSITIVE",
        25,
        "CafeF Tai Chinh",
    ),
    (
        "lotte-finance-vietnam",
        "Lotte Finance Vietnam enforces Q4 selective hiring freeze outside core credit risk",
        "Active roles contracted sharply (-28% MoM) as management prioritizes operational efficiency and NPL stabilization.",
        "RESTRUCTURING",
        "NEGATIVE",
        28,
        "Market Intelligence",
    ),
    (
        "vng-corporation",
        "VNG Cloud & Zalo AI open Principal Infrastructure and LLM Research tracks in HCMC",
        "While gaming headcount remains flat, VNG's enterprise cloud and AI units are actively recruiting senior engineers.",
        "PRODUCT_TECH",
        "POSITIVE",
        31,
        "VnExpress So Hoa",
    ),
    (
        "grab-vietnam",
        "Grab Vietnam maintains disciplined flat-to-down headcount, focusing on senior backfill only",
        "Engineering and product openings declined 14% MoM; several Staff/Senior managers transitioned to local banks and fintechs.",
        "RESTRUCTURING",
        "NEUTRAL",
        34,
        "Tech in Asia",
    ),
    (
        "f88",
        "F88 restructures branch operations and expands Compliance & Risk Governance leadership",
        "Following tightened regulatory scrutiny, F88 reduced store-expansion hiring while recruiting senior legal, internal audit, and credit risk managers.",
        "LEADERSHIP",
        "NEUTRAL",
        37,
        "VnExpress Kinh Doanh",
    ),
    (
        "viettel-digital",
        "Viettel Digital expands Viettel Money credit & merchant ecosystem squads in Hanoi",
        "Steady +14% MoM hiring growth led by backend payment engineers, credit scoring analysts, and senior product managers.",
        "EXPANSION",
        "POSITIVE",
        40,
        "VnExpress So Hoa",
    ),
    (
        "hd-saison",
        "HD SAISON strengthens HDBank ecosystem synergy with digital installment tech hires",
        "Moderate +6% MoM growth in engineering and risk analytics openings, retaining experienced CFC operations managers.",
        "PRODUCT_TECH",
        "POSITIVE",
        43,
        "CafeF Tai Chinh",
    ),
    (
        "acb-bank",
        "ACB unveils new Wealth & SME Digital Banking squad in Ho Chi Minh City",
        "Recruiting Senior Product Managers, Data Engineers, and Digital Acquisition leads with steady +8% MoM velocity.",
        "EXPANSION",
        "POSITIVE",
        46,
        "CafeF Tai Chinh",
    ),
    (
        "shb-finance",
        "SHBFinance integrates Krungsri risk frameworks; appoints Head of Risk Modeling",
        "Selective hiring focused on IFRS9 modeling and collections automation while keeping overall headcount lean.",
        "LEADERSHIP",
        "NEUTRAL",
        50,
        "Market Intelligence",
    ),
    (
        "vnpay",
        "VNPAY opens Principal Payment Systems & SoftPOS engineering roles across Hanoi & HCMC",
        "Consistent +10% MoM demand across banking SDKs, QR switching, and merchant fintech solutions.",
        "HIRING_DRIVE",
        "POSITIVE",
        54,
        "ITviec Market Pulse",
    ),
    (
        "tpbank",
        "TPBank rolls out GenAI LiveBank assistant and hires Senior ML & Voice AI specialists",
        "Maintains steady technology recruitment cadence (+7% MoM) centered in Hanoi.",
        "PRODUCT_TECH",
        "POSITIVE",
        58,
        "VnExpress So Hoa",
    ),
    (
        "hdbank",
        "HDBank expands digital retail and aviation/ecosystem loyalty engineering team",
        "Growing demand for microservices engineers and retail credit data leads in Ho Chi Minh City.",
        "HIRING_DRIVE",
        "POSITIVE",
        62,
        "CafeF Tai Chinh",
    ),
]

# Realistic Vietnam Talent Migration Corridors: (from_slug, to_slug, weight, dept_choices, seniority_bias)
TALENT_CORRIDORS: list[tuple[str, str, int, list[str], float]] = [
    # CFC -> Banking (major Vietnam trend)
    ("fe-credit", "techcombank", 10, ["Risk & Credit", "Data & AI", "Engineering"], 0.55),
    ("fe-credit", "vpbank", 9, ["Risk & Credit", "Digital Banking", "Operations & Collections"], 0.45),
    ("fe-credit", "vib-bank", 7, ["Risk & Credit", "Digital Banking", "Product"], 0.50),
    ("fe-credit", "cake-by-vpbank", 6, ["Risk & Credit", "Data & AI", "Product"], 0.50),
    ("home-credit-vietnam", "techcombank", 6, ["Data & AI", "Risk & Credit", "Product"], 0.50),
    ("home-credit-vietnam", "vib-bank", 6, ["Product", "Risk & Credit", "Digital Banking"], 0.45),
    ("home-credit-vietnam", "momo-mservice", 5, ["Risk & Credit", "Product", "Data & AI"], 0.55),
    ("mirae-asset-finance-vietnam", "hd-saison", 5, ["Risk & Credit", "Sales & BD", "Operations & Collections"], 0.40),
    ("mirae-asset-finance-vietnam", "mcredit", 5, ["Risk & Credit", "Operations & Collections"], 0.40),
    ("lotte-finance-vietnam", "mcredit", 5, ["Risk & Credit", "Digital Banking"], 0.50),
    ("lotte-finance-vietnam", "mb-bank", 4, ["Digital Banking", "Risk & Credit"], 0.45),
    ("vietcredit", "hd-saison", 4, ["Risk & Credit", "Compliance & Legal"], 0.45),
    ("vietcredit", "cake-by-vpbank", 4, ["Digital Banking", "Product"], 0.50),
    ("shinhan-finance-vietnam", "home-credit-vietnam", 5, ["Risk & Credit", "Data & AI", "Product"], 0.45),
    ("f88", "mcredit", 4, ["Operations & Collections", "Risk & Credit"], 0.35),
    ("shb-finance", "vpbank", 4, ["Risk & Credit", "Sales & BD"], 0.40),
    # Tech -> Banking Tech Hubs & FinTech (major Vietnam trend)
    ("fpt-software", "nab-innovation-centre-vietnam", 12, ["Engineering", "Data & AI"], 0.45),
    ("fpt-software", "techcombank", 9, ["Engineering", "Data & AI", "Product"], 0.45),
    ("fpt-software", "mb-bank", 7, ["Engineering", "Data & AI"], 0.35),
    ("shopee-vietnam", "momo-mservice", 9, ["Engineering", "Product", "Data & AI"], 0.55),
    ("shopee-vietnam", "techcombank", 8, ["Product", "Engineering", "Data & AI"], 0.60),
    ("shopee-vietnam", "nab-innovation-centre-vietnam", 7, ["Engineering", "Product"], 0.50),
    ("shopee-vietnam", "cake-by-vpbank", 6, ["Product", "Engineering", "Data & AI"], 0.55),
    ("grab-vietnam", "momo-mservice", 6, ["Product", "Engineering", "Data & AI"], 0.65),
    ("grab-vietnam", "techcombank", 5, ["Product", "Data & AI", "Engineering"], 0.65),
    ("vng-corporation", "momo-mservice", 6, ["Engineering", "Product", "Data & AI"], 0.50),
    ("vng-corporation", "nab-innovation-centre-vietnam", 6, ["Engineering", "Data & AI"], 0.50),
    ("bosch-global-software-vietnam", "nab-innovation-centre-vietnam", 7, ["Engineering", "Data & AI"], 0.45),
    ("bosch-global-software-vietnam", "vng-corporation", 4, ["Engineering", "Data & AI"], 0.40),
    ("vnpay", "mb-bank", 5, ["Engineering", "Digital Banking"], 0.45),
    ("vnpay", "viettel-digital", 4, ["Engineering", "Product"], 0.45),
    # Banking <-> Banking & Digital Banks
    ("vietcombank", "techcombank", 6, ["Digital Banking", "Risk & Credit", "Engineering"], 0.55),
    ("bidv", "mb-bank", 5, ["Digital Banking", "Engineering", "Risk & Credit"], 0.45),
    ("acb-bank", "vib-bank", 5, ["Digital Banking", "Product", "Sales & BD"], 0.45),
    ("vpbank", "cake-by-vpbank", 6, ["Engineering", "Data & AI", "Product"], 0.55),
    ("msb-bank", "tpbank", 4, ["Digital Banking", "Engineering"], 0.40),
    ("tpbank", "techcombank", 5, ["Engineering", "Data & AI", "Digital Banking"], 0.50),
    ("hdbank", "hd-saison", 4, ["Risk & Credit", "Digital Banking"], 0.45),
    ("mb-bank", "mcredit", 4, ["Risk & Credit", "Data & AI"], 0.50),
    # Return flows (Banking -> Tech/CFC)
    ("techcombank", "momo-mservice", 3, ["Product", "Data & AI"], 0.65),
    ("vpbank", "home-credit-vietnam", 4, ["Risk & Credit", "Digital Banking"], 0.55),
    ("vib-bank", "home-credit-vietnam", 3, ["Product", "Risk & Credit"], 0.50),
    ("acb-bank", "momo-mservice", 3, ["Digital Banking", "Sales & BD"], 0.45),
]


def seed_database(conn: sqlite3.Connection, reset: bool = False) -> dict[str, int]:
    """Populate SQLite DB with deterministic, rich Vietnam Tech/CFC/Banking baseline data."""
    init_db(conn)
    rng = random.Random(20261126)

    if reset:
        for tbl in ("crawl_runs", "company_movements", "candidate_moves", "hiring_snapshots", "job_postings", "companies"):
            conn.execute(f"DELETE FROM {tbl}")
        conn.commit()

    # 1. Upsert Top 30 Vietnam Watchlist
    slug_to_company: dict[str, dict] = {}
    for comp in VIETNAM_WATCHLIST:
        cid = upsert_company(conn, comp)
        slug_to_company[comp["slug"]] = {**comp, "id": cid}
    conn.commit()

    today = date.today()
    # 2. Generate 16 weeks of hiring snapshots per company
    snapshots_count = 0
    for slug, comp in slug_to_company.items():
        base_jobs, target_jobs, senior_ratio, _ = COMPANY_PROFILES[slug]
        weekly_counts: list[int] = []
        for w in range(16):
            progress = w / 15.0
            # Smooth curve + mild organic market noise
            expected = base_jobs + (target_jobs - base_jobs) * (progress ** 1.2)
            noise = rng.uniform(-0.06, 0.06) * expected if w < 15 else 0.0
            count = max(3, int(round(expected + noise)))
            weekly_counts.append(count)
        weekly_counts[-1] = target_jobs

        for w in range(16):
            wk_date = week_monday(today - timedelta(days=7 * (15 - w)))
            active = weekly_counts[w]
            prev = weekly_counts[w - 1] if w > 0 else active
            month_prev = weekly_counts[w - 4] if w >= 4 else weekly_counts[0]
            wow = round(((active - prev) / prev) * 100.0, 1) if prev > 0 else 0.0
            mom = round(((active - month_prev) / month_prev) * 100.0, 1) if month_prev > 0 else 0.0
            senior_n = max(1, int(round(active * senior_ratio)))
            tech_share = 0.72 if comp["sector"] == "TECH" else (0.38 if comp["sector"] == "CFC" else 0.48)
            tech_n = max(1, int(round(active * tech_share)))
            new_n = max(1, int(round(active * rng.uniform(0.14, 0.28))))
            closed_n = max(0, prev + new_n - active)
            status = classify_velocity_status(active, mom)

            conn.execute(
                """
                INSERT INTO hiring_snapshots (
                    company_id, snapshot_week, active_jobs, new_jobs, closed_jobs,
                    senior_jobs, tech_jobs, wow_change_pct, mom_change_pct, velocity_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(company_id, snapshot_week) DO UPDATE SET
                    active_jobs = excluded.active_jobs,
                    new_jobs = excluded.new_jobs,
                    closed_jobs = excluded.closed_jobs,
                    senior_jobs = excluded.senior_jobs,
                    tech_jobs = excluded.tech_jobs,
                    wow_change_pct = excluded.wow_change_pct,
                    mom_change_pct = excluded.mom_change_pct,
                    velocity_status = excluded.velocity_status
                """,
                (comp["id"], wk_date, active, new_n, closed_n, senior_n, tech_n, wow, mom, status),
            )
            snapshots_count += 1

    # 3. Generate Active Job Postings matching the current week's snapshot counts (subset capped cleanly per company)
    jobs_inserted = 0
    cities_alt = ["Ho Chi Minh City", "Hanoi", "Da Nang"]
    for slug, comp in slug_to_company.items():
        _, target_jobs, senior_ratio, depts = COMPANY_PROFILES[slug]
        senior_target = max(1, int(round(target_jobs * senior_ratio)))
        sources = SOURCES_BY_SECTOR[comp["sector"]]

        for idx in range(target_jobs):
            dept = depts[idx % len(depts)]
            want_senior = idx < senior_target
            pool = SENIOR_TITLES_BY_DEPT.get(dept, SENIOR_TITLES_BY_DEPT["Engineering"]) if want_senior else IC_TITLES_BY_DEPT.get(dept, IC_TITLES_BY_DEPT["Engineering"])
            base_title = pool[(idx + hash(slug)) % len(pool)]
            # Add squad nuance on duplicates so titles read naturally
            suffixes = ["", " (HCMC Hub)", " – Retail & Digital", " – Core Platform", " (Hybrid)"]
            title = base_title if idx < len(pool) else f"{base_title}{suffixes[idx % len(suffixes)]}"
            seniority, is_senior = classify_seniority(title)
            final_dept = classify_department(title, fallback=dept)
            sal_min, sal_max = SALARY_BANDS_VND.get(seniority, (25_000_000, 45_000_000))
            jitter = rng.uniform(0.92, 1.12)
            s_min = int(round((sal_min * jitter) / 1_000_000) * 1_000_000)
            s_max = int(round((sal_max * jitter) / 1_000_000) * 1_000_000)
            loc = comp["hq_city"] if rng.random() < 0.72 else rng.choice(cities_alt)
            src = sources[idx % len(sources)]
            posted = (today - timedelta(days=rng.randint(0, 34))).isoformat()
            ext_id = f"seed-{slug}-{idx + 1:03d}"

            was_new = upsert_job(
                conn,
                {
                    "company_id": comp["id"],
                    "external_id": ext_id,
                    "source": src,
                    "title": title,
                    "department": final_dept,
                    "seniority": seniority,
                    "is_senior": is_senior,
                    "location": loc,
                    "salary_min_vnd": s_min,
                    "salary_max_vnd": s_max,
                    "url": comp["careers_url"],
                    "posted_date": posted,
                    "status": "ACTIVE",
                },
            )
            if was_new:
                jobs_inserted += 1

    # 4. Generate Candidate Inflow-Outflow transitions
    existing_moves = conn.execute("SELECT COUNT(*) AS c FROM candidate_moves").fetchone()["c"]
    moves_inserted = 0
    if existing_moves == 0:
        for from_slug, to_slug, count, depts, senior_prob in TALENT_CORRIDORS:
            src_comp = slug_to_company[from_slug]
            dst_comp = slug_to_company[to_slug]
            for i in range(count):
                dept = depts[i % len(depts)]
                is_sen = rng.random() < senior_prob
                pool = SENIOR_TITLES_BY_DEPT.get(dept, SENIOR_TITLES_BY_DEPT["Engineering"]) if is_sen else IC_TITLES_BY_DEPT.get(dept, IC_TITLES_BY_DEPT["Engineering"])
                role = rng.choice(pool)
                seniority, senior_flag = classify_seniority(role)
                move_date = (today - timedelta(days=rng.randint(2, 110))).isoformat()
                loc = dst_comp["hq_city"] if rng.random() < 0.8 else rng.choice(cities_alt)
                notes = f"Verified market move ({src_comp['sector']} → {dst_comp['sector']})"
                conn.execute(
                    """
                    INSERT INTO candidate_moves (
                        from_company_id, from_company_name, from_sector,
                        to_company_id, to_company_name, to_sector,
                        role_title, department, seniority, is_senior,
                        move_date, location, source, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?)
                    """,
                    (
                        src_comp["id"],
                        src_comp["short_name"],
                        src_comp["sector"],
                        dst_comp["id"],
                        dst_comp["short_name"],
                        dst_comp["sector"],
                        role,
                        dept,
                        seniority,
                        int(senior_flag),
                        move_date,
                        loc,
                        notes,
                    ),
                )
                moves_inserted += 1

    # 5. Insert Curated Company Movements
    existing_events = conn.execute("SELECT COUNT(*) AS c FROM company_movements").fetchone()["c"]
    events_inserted = 0
    if existing_events == 0:
        for slug, title, summary, category, impact, days_ago, source_name in CURATED_MOVEMENTS:
            comp = slug_to_company[slug]
            ev_date = (today - timedelta(days=days_ago)).isoformat()
            conn.execute(
                """
                INSERT INTO company_movements (
                    company_id, title, summary, category, impact, event_date, source_name, source_url, is_verified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (comp["id"], title, summary, category, impact, ev_date, source_name, comp["website_url"]),
            )
            events_inserted += 1

    # 6. Seed initial crawl run audit trail
    existing_runs = conn.execute("SELECT COUNT(*) AS c FROM crawl_runs").fetchone()["c"]
    if existing_runs == 0:
        now = datetime.now(timezone.utc)
        initial_runs = [
            ("topdev", "COMPLETED", 30, 142, 34, 0, "", 3),
            ("vietnamworks", "COMPLETED", 30, 198, 48, 0, "", 2),
            ("company_ats", "COMPLETED", 30, 165, 29, 0, "", 2),
            ("careerviet", "PARTIAL", 30, 84, 19, 0, "2 career pages timed out", 4),
            ("itviec", "COMPLETED", 18, 96, 22, 0, "", 5),
            ("vn_news_rss", "COMPLETED", 30, 0, 0, 24, "", 1),
        ]
        for src, status, scanned, found, ins, movs, err, hrs_ago in initial_runs:
            started = (now - timedelta(hours=hrs_ago, minutes=4)).isoformat(timespec="seconds") + "Z"
            finished = (now - timedelta(hours=hrs_ago)).isoformat(timespec="seconds") + "Z"
            conn.execute(
                """
                INSERT INTO crawl_runs (
                    source, status, companies_scanned, jobs_found, jobs_inserted,
                    movements_found, error_message, started_at, finished_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (src, status, scanned, found, ins, movs, err, started, finished),
            )

    conn.commit()
    return {
        "companies": len(slug_to_company),
        "snapshots": snapshots_count,
        "jobs_inserted": jobs_inserted,
        "moves_inserted": moves_inserted,
        "movements_inserted": events_inserted,
    }
