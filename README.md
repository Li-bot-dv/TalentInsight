# TalentInsight Vietnam

Local-first market & talent intelligence platform focused on **Vietnam's Tech, Consumer Finance (CFC), and Commercial Banking** sectors.

## Run Locally (1-Command Setup)

### Prerequisites
- **Node.js 22+** (uses built-in `node:sqlite`, zero native compilation required)
- **Python 3.10+**

### Option A: macOS / Linux
```bash
git clone https://github.com/Li-bot-dv/TalentInsight.git
cd TalentInsight
chmod +x start.sh
./start.sh
```

### Option B: Windows (PowerShell or Double-Click)
```powershell
git clone https://github.com/Li-bot-dv/TalentInsight.git
cd TalentInsight
.\start.ps1
```
*(Or simply double-click `start.bat` in File Explorer.)*

What the launcher does automatically on first run:
1. Creates a local Python `.venv` and installs `crawler/requirements.txt`.
2. Installs Next.js dependencies in `web/`.
3. Runs a **100% live crawl** across Vietnam job boards, direct company career sites/ATS, and Vietnam finance/tech RSS feeds into `data/talent_insight.db` (falls back to `seed` if offline).
4. Starts the web app on port `3000`.

### Option C: Docker (No local Node/Python needed)
```bash
git clone https://github.com/Li-bot-dv/TalentInsight.git
cd TalentInsight
docker compose up --build
```

---

## Core Modules

1. **Market Pulse Overview (`/`)**: KPIs, cumulative live hiring pipeline by sector, hiring velocity leaders & slowdowns, and high-signal senior openings.
2. **Hiring Velocity Radar (`/velocity`)**: Sortable WoW & 2-week posting momentum across the curated Top 30 Vietnam employer watchlist with sparklines and senior ratios.
3. **Senior & Executive Hiring Tracker (`/senior-hiring`)**: Automated EN + Vietnamese classifier detecting C-Level, VP, Director/Head, Principal/Staff, and Senior Manager (*Giám đốc*, *Trưởng phòng*, *Phó Tổng Giám đốc*) openings with direct source links.
4. **Candidate Inflow–Outflow & Talent Migration (`/talent-flow`)**: Cross-sector migration diagram, Net Gain/Loss leaderboard, company-to-company corridors, and **CSV Import** for LinkedIn Talent Insights / headhunter move logs.
5. **Company Movement Feed (`/movements`)**: Live Vietnam news signals (VnExpress, CafeF, CafeBiz, Google News VN) + analyst note logging.
6. **Watchlist & Crawler Console (`/crawlers`)**: Add/remove Vietnam employers, trigger live crawlers on demand from the UI, and view transparent crawl audit logs.
7. **Company Deep-Dive (`/companies/[slug]`)**: Per-company hiring trajectory, function mix, inflow/outflow partners, movement timeline, and active roles.

---

## Live Data Sources

- **Direct Company Career Sites / ATS (`company_ats`)**: Bosch Global Software Vietnam (SmartRecruiters API), Grab Vietnam (SmartRecruiters API), VNG Corporation (`career.vng.com.vn`), plus any Greenhouse / Lever / SmartRecruiters board you add.
- **Public Vietnam Job Boards**: CareerViet, VietnamWorks, CareerLink VN, TopDev. *(Sites gated by Cloudflare/anti-bot such as ITviec are logged transparently as `BLOCKED_ANTIBOT` without bypass attempts.)*
- **Vietnam Business & Tech News RSS (`vn_news_rss`)**: VnExpress Kinh Doanh, VnExpress Khoa học Công nghệ, CafeF Tài chính – Ngân hàng, CafeBiz Công nghệ, and Google News VN RSS.

---

## Useful Local Commands

```bash
# Refresh live data anytime (appends new jobs/news & updates snapshots)
npm run crawl:update

# Wipe DB & run a fresh 100% live crawl from scratch
npm run crawl:live

# Optional: load a 16-week demo dataset (including sample candidate inflow-outflow)
npm run seed

# Import your own candidate inflow-outflow CSV
PYTHONPATH=crawler .venv/bin/python -m talent_crawler.cli import-moves --file data/sample_candidate_moves.csv

# Run crawler unit tests
npm run test:crawler
```
