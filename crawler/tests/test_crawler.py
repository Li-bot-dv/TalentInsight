"""Unit tests for TalentInsight Vietnam classifiers, database seeding, snapshots, and CSV imports."""

from __future__ import annotations

from pathlib import Path

from talent_crawler.classifiers import classify_department, classify_seniority, classify_velocity_status, normalize_location
from talent_crawler.db import get_connection, init_db, recompute_latest_snapshots
from talent_crawler.importers import import_candidate_moves_csv
from talent_crawler.seed import seed_database


def test_seniority_classifier_en_and_vi() -> None:
    assert classify_seniority("Chief Risk Officer (CRO)") == ("C_LEVEL", True)
    assert classify_seniority("Phó Tổng Giám đốc Công nghệ") == ("C_LEVEL", True)
    assert classify_seniority("VP of Digital Banking") == ("VP", True)
    assert classify_seniority("Head of Credit Risk Analytics") == ("DIRECTOR_HEAD", True)
    assert classify_seniority("Giám đốc Khối Dữ liệu") == ("DIRECTOR_HEAD", True)
    assert classify_seniority("Staff Backend Engineer") == ("PRINCIPAL_STAFF", True)
    assert classify_seniority("Trưởng phòng Thu hồi nợ") == ("SENIOR_MANAGER", True)
    assert classify_seniority("Senior Java Developer") == ("SENIOR", False)
    assert classify_seniority("Backend Software Engineer") == ("MID", False)
    assert classify_seniority("Fresher Data Analyst") == ("JUNIOR", False)


def test_department_and_location_classifiers() -> None:
    assert classify_department("Head of Credit Risk & IFRS9") == "Risk & Credit"
    assert classify_department("Principal ML Scientist (LLM)") == "Data & AI"
    assert classify_department("Director of Collections Strategy") == "Operations & Collections"
    assert normalize_location("TP.HCM, Quận 1") == "Ho Chi Minh City"
    assert normalize_location("Hà Nội") == "Hanoi"
    assert normalize_location("Đà Nẵng") == "Da Nang"


def test_velocity_status() -> None:
    assert classify_velocity_status(30, 28.5) == "SURGE"
    assert classify_velocity_status(25, 10.0) == "GROWING"
    assert classify_velocity_status(20, 1.0) == "STABLE"
    assert classify_velocity_status(15, -14.0) == "SLOWDOWN"
    assert classify_velocity_status(8, -30.0) == "FREEZE"


def test_seed_and_csv_import(tmp_path: Path) -> None:
    db_file = tmp_path / "test.db"
    conn = get_connection(db_file)
    stats = seed_database(conn, reset=True)
    assert stats["companies"] == 30
    assert stats["snapshots"] == 30 * 16
    assert stats["jobs_inserted"] > 400
    assert stats["moves_inserted"] > 100
    assert stats["movements_inserted"] >= 20

    csv_sample = (
        "from_company,to_company,role_title,move_date,location,notes\n"
        "FE Credit,Techcombank,VP of Credit Analytics,2026-11-10,Ho Chi Minh City,Test move\n"
        "Shopee Vietnam,MoMo,Staff ML Engineer,2026-11-11,HCMC,AI squad\n"
    )
    res = import_candidate_moves_csv(conn, csv_sample)
    assert res["inserted"] == 2
    assert res["skipped"] == 0

    updated = recompute_latest_snapshots(conn)
    assert updated == 30
    conn.close()
