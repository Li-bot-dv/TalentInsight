# TalentInsight Vietnam

Market & talent intelligence platform focused on **Vietnam's Tech, Consumer Finance (CFC), and Commercial Banking** landscape.

## Core Intelligence Modules

1. **Market Pulse Overview (`/`)**: Executive KPIs, 16-week multi-sector hiring volume trend, sector scorecard (Tech vs. CFC vs. Banking), hiring boost leaders vs. contraction alerts, and high-signal senior openings.
2. **Hiring Velocity Radar (`/velocity`)**: Sortable WoW & MoM velocity tracker across the curated Top 30 Vietnam employer watchlist with 8-week sparklines, surge/freeze status badges, senior hiring ratios, and net talent flow.
3. **Senior & Executive Hiring Tracker (`/senior-hiring`)**: Automated EN + Vietnamese job title classifier detecting C-Level, VP, Director/Head, Principal/Staff, and Senior Manager openings across HCMC, Hanoi, and Da Nang with VND salary bands.
4. **Candidate Inflow–Outflow & Talent Migration (`/talent-flow`)**: Interactive cross-sector SVG flow diagram, Net Talent Gain/Loss leaderboard, company-to-company poaching corridors, and **CSV Import** for headhunter / LinkedIn Talent Insights exports.
5. **Company Movement Feed (`/movements`)**: Curated + RSS-ingested signals covering leadership appointments, new tech hubs, restructuring/layoffs, M&A transitions, and hiring drives, plus analyst field-intel note logging.
6. **Watchlist & Crawler Console (`/crawlers`)**: Editable employer watchlist (add/remove companies, configure career portals/ATS) + on-demand crawler triggers and transparent run audit logs.
7. **Company Deep-Dive (`/companies/[slug]`)**: Per-company 16-week trajectory chart, function mix, top inflow sources vs. outflow destinations, movement timeline, and active roles.

## Architecture

- **`web/`** — Next.js (App Router, TypeScript, Tailwind CSS, Recharts) using Node 22's built-in `node:sqlite` (`DatabaseSync`).
- **`crawler/`** — Python 3.12 modular crawler engine (`httpx`, `beautifulsoup4`, `lxml`, `feedparser`) with adapters for:
  - Public Vietnam job boards: **TopDev**, **VietnamWorks**, **ITviec**, **CareerViet**
  - Direct Company Career Sites / ATS: **Greenhouse**, **Lever**, and JSON-LD / HTML career pages
  - Vietnam Business/Tech News RSS: **VnExpress Kinh Doanh / Số Hóa**, **CafeF Tài chính – Ngân hàng**
- **`data/`** — Shared SQLite database (`data/talent_insight.db`, WAL mode) with PostgreSQL-ready `data/schema.sql` and `data/sample_candidate_moves.csv`.

## Quick Start

### 1. Python Crawler & Seed Database

```bash
python3 -m venv .venv
.venv/bin/pip install -r crawler/requirements.txt

# Populate 100% LIVE-crawled Vietnam jobs & news movements (VietnamWorks, TopDev, CareerViet, VN News RSS)
PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli init-live

# Or seed a 16-week demo baseline (optional)
PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli seed --reset

# Run unit tests
PYTHONPATH=crawler .venv/bin/pytest -v crawler/tests
```

### 2. Run Live Crawlers or Import Candidate Moves CSV

```bash
# Run specific source(s) or 'all'
PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli crawl --source topdev,vietnamworks,vn_news_rss --limit 10

# Import candidate inflow-outflow transitions from CSV
PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli import-moves --file data/sample_candidate_moves.csv
```

> **Note on anti-bot gates:** All crawler adapters use polite rate limits and transparently detect HTTP 403 / Cloudflare / CAPTCHA challenges (logging `BLOCKED_ANTIBOT` in `crawl_runs`) without attempting to bypass access controls.

### 3. Run the Next.js Web Application

```bash
cd web
npm install
npm run dev
```
