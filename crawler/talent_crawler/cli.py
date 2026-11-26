"""CLI entrypoint for seeding, running live crawlers, importing CSV moves, and computing snapshots."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .db import (
    DEFAULT_DB_PATH,
    finish_crawl_run,
    get_connection,
    init_db,
    rebuild_snapshots_from_live_jobs,
    recompute_latest_snapshots,
    start_crawl_run,
    upsert_company,
    upsert_job,
)
from .importers import import_candidate_moves_csv
from .seed import seed_database
from .sources import SOURCE_REGISTRY
from .watchlist import VIETNAM_WATCHLIST


def run_crawl(
    db_path: Path,
    sources: list[str],
    limit_companies: int | None = None,
    rebuild_history: bool = False,
) -> list[dict]:
    conn = get_connection(db_path)
    init_db(conn)
    query = "SELECT * FROM companies WHERE is_active = 1 ORDER BY id ASC"
    companies = [dict(row) for row in conn.execute(query).fetchall()]
    if limit_companies:
        companies = companies[:limit_companies]

    summaries: list[dict] = []
    for src_name in sources:
        adapter_cls = SOURCE_REGISTRY.get(src_name)
        if not adapter_cls:
            summaries.append({"source": src_name, "status": "FAILED", "error": f"Unknown source '{src_name}'"})
            continue

        run_id = start_crawl_run(conn, src_name)
        adapter = adapter_cls()
        try:
            batch = adapter.crawl(companies)
            inserted_jobs = 0
            for job in batch.jobs:
                was_new = upsert_job(
                    conn,
                    {
                        "company_id": job.company_id,
                        "external_id": job.external_id,
                        "source": job.source,
                        "title": job.title,
                        "department": job.department,
                        "seniority": job.seniority,
                        "is_senior": job.is_senior,
                        "location": job.location,
                        "salary_min_vnd": job.salary_min_vnd,
                        "salary_max_vnd": job.salary_max_vnd,
                        "url": job.url,
                        "posted_date": job.posted_date,
                        "status": job.status,
                    },
                )
                if was_new:
                    inserted_jobs += 1

            inserted_movements = 0
            for mov in batch.movements:
                exists = conn.execute(
                    "SELECT id FROM company_movements WHERE company_id = ? AND title = ?",
                    (mov.company_id, mov.title),
                ).fetchone()
                if not exists:
                    conn.execute(
                        """
                        INSERT INTO company_movements (
                            company_id, title, summary, category, impact, event_date, source_name, source_url, is_verified
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                        """,
                        (
                            mov.company_id,
                            mov.title,
                            mov.summary,
                            mov.category,
                            mov.impact,
                            mov.event_date,
                            mov.source_name,
                            mov.source_url,
                        ),
                    )
                    inserted_movements += 1

            conn.commit()
            err_msg = "; ".join(batch.errors[:3])
            finish_crawl_run(
                conn,
                run_id=run_id,
                status=batch.status,
                companies_scanned=batch.companies_scanned,
                jobs_found=len(batch.jobs),
                jobs_inserted=inserted_jobs,
                movements_found=inserted_movements,
                error_message=err_msg,
            )
            summaries.append(
                {
                    "run_id": run_id,
                    "source": src_name,
                    "status": batch.status,
                    "companies_scanned": batch.companies_scanned,
                    "jobs_found": len(batch.jobs),
                    "jobs_inserted": inserted_jobs,
                    "movements_found": inserted_movements,
                    "error": err_msg,
                }
            )
        except Exception as exc:
            finish_crawl_run(conn, run_id=run_id, status="FAILED", error_message=str(exc))
            summaries.append({"run_id": run_id, "source": src_name, "status": "FAILED", "error": str(exc)})

    if rebuild_history:
        rebuild_snapshots_from_live_jobs(conn)
    else:
        recompute_latest_snapshots(conn)
    conn.close()
    return summaries


def init_live_database(db_path: Path, sources: list[str]) -> list[dict]:
    """Wipe all seeded records, load the 30 real VN watchlist companies, and crawl 100% live data."""
    conn = get_connection(db_path)
    init_db(conn)
    for tbl in ("crawl_runs", "company_movements", "candidate_moves", "hiring_snapshots", "job_postings", "companies"):
        conn.execute(f"DELETE FROM {tbl}")
    for comp in VIETNAM_WATCHLIST:
        upsert_company(conn, comp)
    conn.commit()
    conn.close()
    return run_crawl(db_path, sources, rebuild_history=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="talent-crawler", description="TalentInsight Vietnam crawler CLI")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Path to SQLite database")
    sub = parser.add_subparsers(dest="command", required=True)

    p_seed = sub.add_parser("seed", help="Seed Vietnam Top 30 Tech/CFC/Banking baseline data")
    p_seed.add_argument("--reset", action="store_true", help="Clear existing data before seeding")

    p_live = sub.add_parser("init-live", help="Wipe seed data and populate 100% live-crawled Vietnam market data")
    p_live.add_argument(
        "--source",
        default="company_ats,vietnamworks,topdev,careerviet,careerlink,vn_news_rss,itviec",
        help="Comma-separated live sources to crawl",
    )

    p_crawl = sub.add_parser("crawl", help="Run live crawlers for one or more sources")
    p_crawl.add_argument(
        "--source",
        default="all",
        help="Comma-separated source names or 'all' (topdev,itviec,vietnamworks,careerviet,company_ats,vn_news_rss)",
    )
    p_crawl.add_argument("--limit", type=int, default=None, help="Limit number of companies per crawl run")

    p_import = sub.add_parser("import-moves", help="Import Candidate Inflow-Outflow transitions from CSV")
    p_import.add_argument("--file", type=Path, required=True, help="Path to CSV file")

    sub.add_parser("snapshots", help="Recompute latest weekly hiring snapshots")

    args = parser.parse_args(argv)

    if args.command == "seed":
        conn = get_connection(args.db)
        result = seed_database(conn, reset=args.reset)
        conn.close()
        print(json.dumps(result, indent=2))
        return 0

    if args.command == "init-live":
        sources = [s.strip() for s in args.source.split(",") if s.strip()]
        result = init_live_database(args.db, sources)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "crawl":
        sources = list(SOURCE_REGISTRY.keys()) if args.source == "all" else [s.strip() for s in args.source.split(",") if s.strip()]
        result = run_crawl(args.db, sources, limit_companies=args.limit)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if args.command == "import-moves":
        conn = get_connection(args.db)
        init_db(conn)
        csv_text = args.file.read_text(encoding="utf-8")
        result = import_candidate_moves_csv(conn, csv_text)
        conn.close()
        print(json.dumps(result, indent=2))
        return 0

    if args.command == "snapshots":
        conn = get_connection(args.db)
        init_db(conn)
        updated = recompute_latest_snapshots(conn)
        conn.close()
        print(json.dumps({"snapshots_updated": updated}))
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
