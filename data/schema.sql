-- TalentInsight Vietnam Database Schema
-- Compatible with SQLite 3 (WAL mode) and designed for straightforward PostgreSQL migration.

CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    sector TEXT NOT NULL CHECK (sector IN ('TECH', 'CFC', 'BANKING')),
    sub_sector TEXT NOT NULL DEFAULT '',
    hq_city TEXT NOT NULL DEFAULT 'Ho Chi Minh City',
    headcount_band TEXT NOT NULL DEFAULT '1,000-5,000',
    website_url TEXT NOT NULL DEFAULT '',
    careers_url TEXT NOT NULL DEFAULT '',
    ats_type TEXT NOT NULL DEFAULT 'custom',
    ats_board_token TEXT NOT NULL DEFAULT '',
    search_keywords TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_postings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    external_id TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Engineering',
    seniority TEXT NOT NULL DEFAULT 'MID' CHECK (
        seniority IN ('C_LEVEL', 'VP', 'DIRECTOR_HEAD', 'PRINCIPAL_STAFF', 'SENIOR_MANAGER', 'SENIOR', 'MID', 'JUNIOR')
    ),
    is_senior INTEGER NOT NULL DEFAULT 0,
    location TEXT NOT NULL DEFAULT 'Ho Chi Minh City',
    salary_min_vnd INTEGER,
    salary_max_vnd INTEGER,
    url TEXT NOT NULL DEFAULT '',
    posted_date TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON job_postings(company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_seniority ON job_postings(is_senior, seniority, status);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_date ON job_postings(posted_date DESC);

CREATE TABLE IF NOT EXISTS hiring_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    snapshot_week TEXT NOT NULL,
    active_jobs INTEGER NOT NULL DEFAULT 0,
    new_jobs INTEGER NOT NULL DEFAULT 0,
    closed_jobs INTEGER NOT NULL DEFAULT 0,
    senior_jobs INTEGER NOT NULL DEFAULT 0,
    tech_jobs INTEGER NOT NULL DEFAULT 0,
    wow_change_pct REAL NOT NULL DEFAULT 0,
    mom_change_pct REAL NOT NULL DEFAULT 0,
    velocity_status TEXT NOT NULL DEFAULT 'STABLE' CHECK (
        velocity_status IN ('SURGE', 'GROWING', 'STABLE', 'SLOWDOWN', 'FREEZE')
    ),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, snapshot_week)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_week ON hiring_snapshots(snapshot_week DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_company_week ON hiring_snapshots(company_id, snapshot_week DESC);

CREATE TABLE IF NOT EXISTS candidate_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_company_id INTEGER,
    from_company_name TEXT NOT NULL,
    from_sector TEXT NOT NULL DEFAULT 'OTHER',
    to_company_id INTEGER,
    to_company_name TEXT NOT NULL,
    to_sector TEXT NOT NULL DEFAULT 'OTHER',
    role_title TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Engineering',
    seniority TEXT NOT NULL DEFAULT 'SENIOR',
    is_senior INTEGER NOT NULL DEFAULT 0,
    move_date TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Ho Chi Minh City',
    source TEXT NOT NULL DEFAULT 'seed',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (to_company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_moves_from ON candidate_moves(from_company_id, move_date DESC);
CREATE INDEX IF NOT EXISTS idx_moves_to ON candidate_moves(to_company_id, move_date DESC);
CREATE INDEX IF NOT EXISTS idx_moves_date ON candidate_moves(move_date DESC);

CREATE TABLE IF NOT EXISTS company_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN ('LEADERSHIP', 'EXPANSION', 'RESTRUCTURING', 'HIRING_DRIVE', 'M_AND_A', 'PRODUCT_TECH')
    ),
    impact TEXT NOT NULL DEFAULT 'NEUTRAL' CHECK (impact IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')),
    event_date TEXT NOT NULL,
    source_name TEXT NOT NULL DEFAULT 'Market Intelligence',
    source_url TEXT NOT NULL DEFAULT '',
    is_verified INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_movements_date ON company_movements(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_company ON company_movements(company_id, event_date DESC);

CREATE TABLE IF NOT EXISTS crawl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'PARTIAL', 'BLOCKED_ANTIBOT', 'FAILED')),
    companies_scanned INTEGER NOT NULL DEFAULT 0,
    jobs_found INTEGER NOT NULL DEFAULT 0,
    jobs_inserted INTEGER NOT NULL DEFAULT 0,
    movements_found INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
);
