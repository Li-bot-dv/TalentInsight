"""CSV importers for Candidate Inflow-Outflow transitions and custom watchlists."""

from __future__ import annotations

import csv
import io
import json
import sqlite3
from datetime import date
from typing import Any

from .classifiers import classify_department, classify_seniority, normalize_location


def _build_company_lookup(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    rows = conn.execute("SELECT id, slug, name, short_name, sector, search_keywords FROM companies").fetchall()
    lookup: dict[str, dict[str, Any]] = {}
    for row in rows:
        info = dict(row)
        keys = [info["name"], info["short_name"], info["slug"]]
        try:
            keys.extend(json.loads(info.get("search_keywords") or "[]"))
        except json.JSONDecodeError:
            pass
        for k in keys:
            norm = (k or "").strip().lower()
            if norm:
                lookup[norm] = info
    return lookup


def _resolve_company(name: str, lookup: dict[str, dict[str, Any]]) -> tuple[int | None, str, str]:
    clean = (name or "").strip()
    if not clean:
        return None, "External / Undisclosed", "OTHER"
    lower = clean.lower()
    if lower in lookup:
        hit = lookup[lower]
        return int(hit["id"]), hit["short_name"], hit["sector"]
    for key, hit in lookup.items():
        if len(key) >= 4 and (key in lower or lower in key):
            return int(hit["id"]), hit["short_name"], hit["sector"]
    return None, clean, "OTHER"


def import_candidate_moves_csv(
    conn: sqlite3.Connection,
    csv_text: str,
    source: str = "csv_import",
) -> dict[str, Any]:
    """Parse CSV text and insert candidate inflow-outflow transitions."""
    lookup = _build_company_lookup(conn)
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    inserted = 0
    skipped = 0
    errors: list[str] = []

    for idx, row in enumerate(reader, start=2):
        norm_row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        from_raw = norm_row.get("from_company") or norm_row.get("previous_company") or norm_row.get("source_company") or ""
        to_raw = norm_row.get("to_company") or norm_row.get("new_company") or norm_row.get("target_company") or ""
        role_title = norm_row.get("role_title") or norm_row.get("title") or norm_row.get("role") or ""

        if not from_raw or not to_raw or not role_title:
            skipped += 1
            errors.append(f"Row {idx}: missing required column (from_company, to_company, role_title)")
            continue

        from_id, from_name, from_sector = _resolve_company(from_raw, lookup)
        to_id, to_name, to_sector = _resolve_company(to_raw, lookup)

        raw_sen = norm_row.get("seniority", "").upper()
        if raw_sen in ("C_LEVEL", "VP", "DIRECTOR_HEAD", "PRINCIPAL_STAFF", "SENIOR_MANAGER", "SENIOR", "MID", "JUNIOR"):
            seniority = raw_sen
            is_senior = raw_sen in ("C_LEVEL", "VP", "DIRECTOR_HEAD", "PRINCIPAL_STAFF", "SENIOR_MANAGER")
        else:
            seniority, is_senior = classify_seniority(role_title)

        department = norm_row.get("department") or classify_department(role_title)
        move_date = (norm_row.get("move_date") or date.today().isoformat())[:10]
        location = normalize_location(norm_row.get("location") or "Ho Chi Minh City")
        notes = norm_row.get("notes") or ""

        conn.execute(
            """
            INSERT INTO candidate_moves (
                from_company_id, from_company_name, from_sector,
                to_company_id, to_company_name, to_sector,
                role_title, department, seniority, is_senior,
                move_date, location, source, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                from_id,
                from_name,
                from_sector,
                to_id,
                to_name,
                to_sector,
                role_title,
                department,
                seniority,
                int(is_senior),
                move_date,
                location,
                source,
                notes,
            ),
        )
        inserted += 1

    conn.commit()
    return {"inserted": inserted, "skipped": skipped, "errors": errors[:10]}
