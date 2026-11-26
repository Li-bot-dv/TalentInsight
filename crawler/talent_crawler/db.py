"""SQLite database management, upserts, and weekly hiring snapshot computation."""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .classifiers import classify_velocity_status

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = REPO_ROOT / "data" / "talent_insight.db"
SCHEMA_PATH = REPO_ROOT / "data" / "schema.sql"


def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    conn.executescript(schema_sql)
    conn.commit()


def upsert_company(conn: sqlite3.Connection, company: dict[str, Any]) -> int:
    keywords_json = json.dumps(company.get("search_keywords", []), ensure_ascii=False)
    conn.execute(
        """
        INSERT INTO companies (
            slug, name, short_name, sector, sub_sector, hq_city, headcount_band,
            website_url, careers_url, ats_type, ats_board_token, search_keywords, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            short_name = excluded.short_name,
            sector = excluded.sector,
            sub_sector = excluded.sub_sector,
            hq_city = excluded.hq_city,
            headcount_band = excluded.headcount_band,
            website_url = excluded.website_url,
            careers_url = excluded.careers_url,
            ats_type = excluded.ats_type,
            ats_board_token = excluded.ats_board_token,
            search_keywords = excluded.search_keywords,
            updated_at = datetime('now')
        """,
        (
            company["slug"],
            company["name"],
            company.get("short_name", company["name"]),
            company["sector"],
            company.get("sub_sector", ""),
            company.get("hq_city", "Ho Chi Minh City"),
            company.get("headcount_band", "1,000-5,000"),
            company.get("website_url", ""),
            company.get("careers_url", ""),
            company.get("ats_type", "custom"),
            company.get("ats_board_token", ""),
            keywords_json,
            int(company.get("is_active", 1)),
        ),
    )
    row = conn.execute("SELECT id FROM companies WHERE slug = ?", (company["slug"],)).fetchone()
    return int(row["id"])


def upsert_job(conn: sqlite3.Connection, job: dict[str, Any]) -> bool:
    """Insert or update a job posting. Returns True if newly inserted."""
    existing = conn.execute(
        """
        SELECT id FROM job_postings
        WHERE company_id = ? AND source = ? AND external_id = ?
        """,
        (job["company_id"], job["source"], job["external_id"]),
    ).fetchone()

    if existing:
        conn.execute(
            """
            UPDATE job_postings
            SET title = ?, department = ?, seniority = ?, is_senior = ?,
                location = ?, salary_min_vnd = ?, salary_max_vnd = ?,
                url = ?, status = ?, last_seen_at = datetime('now')
            WHERE id = ?
            """,
            (
                job["title"],
                job["department"],
                job["seniority"],
                int(bool(job["is_senior"])),
                job["location"],
                job.get("salary_min_vnd"),
                job.get("salary_max_vnd"),
                job.get("url", ""),
                job.get("status", "ACTIVE"),
                existing["id"],
            ),
        )
        return False

    conn.execute(
        """
        INSERT INTO job_postings (
            company_id, external_id, source, title, department, seniority, is_senior,
            location, salary_min_vnd, salary_max_vnd, url, posted_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job["company_id"],
            job["external_id"],
            job["source"],
            job["title"],
            job["department"],
            job["seniority"],
            int(bool(job["is_senior"])),
            job["location"],
            job.get("salary_min_vnd"),
            job.get("salary_max_vnd"),
            job.get("url", ""),
            job["posted_date"],
            job.get("status", "ACTIVE"),
        ),
    )
    return True


def week_monday(d: date) -> str:
    return (d - timedelta(days=d.weekday())).isoformat()


def recompute_latest_snapshots(conn: sqlite3.Connection, ref_date: date | None = None) -> int:
    """Recompute the current week's hiring snapshot for every active company from job_postings."""
    today = ref_date or date.today()
    current_week = week_monday(today)
    prev_week = week_monday(today - timedelta(days=7))
    four_weeks_ago = week_monday(today - timedelta(days=28))

    companies = conn.execute("SELECT id FROM companies WHERE is_active = 1").fetchall()
    updated = 0

    for comp in companies:
        cid = comp["id"]
        counts = conn.execute(
            """
            SELECT
                COUNT(*) AS active_jobs,
                SUM(CASE WHEN is_senior = 1 THEN 1 ELSE 0 END) AS senior_jobs,
                SUM(CASE WHEN department IN ('Engineering', 'Data & AI', 'Product') THEN 1 ELSE 0 END) AS tech_jobs,
                SUM(CASE WHEN posted_date >= ? THEN 1 ELSE 0 END) AS new_jobs
            FROM job_postings
            WHERE company_id = ? AND status = 'ACTIVE'
            """,
            ((today - timedelta(days=7)).isoformat(), cid),
        ).fetchone()

        active_jobs = int(counts["active_jobs"] or 0)
        senior_jobs = int(counts["senior_jobs"] or 0)
        tech_jobs = int(counts["tech_jobs"] or 0)
        new_jobs = int(counts["new_jobs"] or 0)

        prev_row = conn.execute(
            "SELECT active_jobs FROM hiring_snapshots WHERE company_id = ? AND snapshot_week = ?",
            (cid, prev_week),
        ).fetchone()
        month_row = conn.execute(
            "SELECT active_jobs FROM hiring_snapshots WHERE company_id = ? AND snapshot_week = ?",
            (cid, four_weeks_ago),
        ).fetchone()

        prev_active = int(prev_row["active_jobs"]) if prev_row else active_jobs
        month_active = int(month_row["active_jobs"]) if month_row else prev_active

        wow_pct = round(((active_jobs - prev_active) / prev_active) * 100.0, 1) if prev_active > 0 else 0.0
        mom_pct = round(((active_jobs - month_active) / month_active) * 100.0, 1) if month_active > 0 else 0.0
        status = classify_velocity_status(active_jobs, mom_pct)

        conn.execute(
            """
            INSERT INTO hiring_snapshots (
                company_id, snapshot_week, active_jobs, new_jobs, closed_jobs,
                senior_jobs, tech_jobs, wow_change_pct, mom_change_pct, velocity_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(company_id, snapshot_week) DO UPDATE SET
                active_jobs = excluded.active_jobs,
                new_jobs = excluded.new_jobs,
                senior_jobs = excluded.senior_jobs,
                tech_jobs = excluded.tech_jobs,
                wow_change_pct = excluded.wow_change_pct,
                mom_change_pct = excluded.mom_change_pct,
                velocity_status = excluded.velocity_status
            """,
            (
                cid,
                current_week,
                active_jobs,
                new_jobs,
                max(0, prev_active + new_jobs - active_jobs),
                senior_jobs,
                tech_jobs,
                wow_pct,
                mom_pct,
                status,
            ),
        )
        updated += 1

    conn.commit()
    return updated


def rebuild_snapshots_from_live_jobs(conn: sqlite3.Connection, weeks: int = 8, ref_date: date | None = None) -> int:
    """Build weekly hiring snapshots strictly from real crawled job_postings timestamps."""
    today = ref_date or date.today()
    current_monday = today - timedelta(days=today.weekday())
    companies = conn.execute("SELECT id FROM companies WHERE is_active = 1").fetchall()
    conn.execute("DELETE FROM hiring_snapshots")
    written = 0

    for comp in companies:
        cid = comp["id"]
        rows = conn.execute(
            """
            SELECT posted_date, is_senior, department
            FROM job_postings
            WHERE company_id = ? AND status = 'ACTIVE'
            """,
            (cid,),
        ).fetchall()

        weekly_active: list[int] = []
        weekly_new: list[int] = []
        weekly_senior: list[int] = []
        weekly_tech: list[int] = []
        week_starts: list[date] = []

        for offset in range(weeks - 1, -1, -1):
            wk_start = current_monday - timedelta(days=7 * offset)
            wk_end = wk_start + timedelta(days=6)
            ws_iso = wk_start.isoformat()
            we_iso = wk_end.isoformat()
            week_starts.append(wk_start)

            # Jobs already posted on or before this week's end represent live cumulative pipeline
            cum_rows = [r for r in rows if (r["posted_date"] or "") <= we_iso]
            new_rows = [r for r in rows if ws_iso <= (r["posted_date"] or "") <= we_iso]
            weekly_active.append(len(cum_rows))
            weekly_new.append(len(new_rows))
            weekly_senior.append(sum(1 for r in cum_rows if r["is_senior"]))
            weekly_tech.append(sum(1 for r in cum_rows if r["department"] in ("Engineering", "Data & AI", "Product")))

        for idx, wk_start in enumerate(week_starts):
            active = weekly_active[idx]
            new_n = weekly_new[idx]
            prev_new = weekly_new[idx - 1] if idx > 0 else new_n
            # Compare recent 2-week posting velocity vs prior 2-week posting velocity for real momentum
            recent_2w = weekly_new[idx] + (weekly_new[idx - 1] if idx >= 1 else 0)
            prior_2w = (weekly_new[idx - 2] if idx >= 2 else 0) + (weekly_new[idx - 3] if idx >= 3 else 0)

            if prev_new > 0:
                wow = round(((new_n - prev_new) / prev_new) * 100.0, 1)
            elif new_n > 0:
                wow = 100.0
            else:
                wow = 0.0

            if prior_2w > 0:
                mom = round(((recent_2w - prior_2w) / prior_2w) * 100.0, 1)
            elif recent_2w > 0:
                mom = round(min(100.0, recent_2w * 15.0), 1)
            else:
                mom = -100.0 if active == 0 else 0.0

            status = classify_velocity_status(active, mom)
            conn.execute(
                """
                INSERT INTO hiring_snapshots (
                    company_id, snapshot_week, active_jobs, new_jobs, closed_jobs,
                    senior_jobs, tech_jobs, wow_change_pct, mom_change_pct, velocity_status
                ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
                """,
                (
                    cid,
                    wk_start.isoformat(),
                    active,
                    new_n,
                    weekly_senior[idx],
                    weekly_tech[idx],
                    wow,
                    mom,
                    status,
                ),
            )
            written += 1

    conn.commit()
    return written


def start_crawl_run(conn: sqlite3.Connection, source: str) -> int:
    cur = conn.execute(
        "INSERT INTO crawl_runs (source, status, started_at) VALUES (?, 'RUNNING', ?)",
        (source, datetime.now(timezone.utc).isoformat(timespec="seconds")),
    )
    conn.commit()
    return int(cur.lastrowid)


def finish_crawl_run(
    conn: sqlite3.Connection,
    run_id: int,
    status: str,
    companies_scanned: int = 0,
    jobs_found: int = 0,
    jobs_inserted: int = 0,
    movements_found: int = 0,
    error_message: str = "",
) -> None:
    conn.execute(
        """
        UPDATE crawl_runs
        SET status = ?, companies_scanned = ?, jobs_found = ?, jobs_inserted = ?,
            movements_found = ?, error_message = ?, finished_at = ?
        WHERE id = ?
        """,
        (
            status,
            companies_scanned,
            jobs_found,
            jobs_inserted,
            movements_found,
            error_message,
            datetime.now(timezone.utc).isoformat(timespec="seconds"),
            run_id,
        ),
    )
    conn.commit()
