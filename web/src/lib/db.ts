import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  CandidateMoveRow,
  CompanyFlowEdge,
  CompanyMovementRow,
  CompanyNetFlow,
  CompanyVelocityRow,
  CrawlRunRow,
  JobPostingRow,
  Sector,
  SectorFlowEdge,
  VelocityStatus,
  WeeklySectorTrend,
} from "./types";

const globalForDb = globalThis as unknown as { __talentDb?: DatabaseSync };

export function getDbPath(): string {
  if (process.env.TALENT_DB_PATH) return process.env.TALENT_DB_PATH;
  const candidate = path.resolve(process.cwd(), "..", "data", "talent_insight.db");
  if (fs.existsSync(candidate)) return candidate;
  return path.resolve(process.cwd(), "data", "talent_insight.db");
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__talentDb) {
    const dbPath = getDbPath();
    const db = new DatabaseSync(dbPath, { timeout: 10000 });
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    globalForDb.__talentDb = db;
  }
  return globalForDb.__talentDb;
}

export function getLatestSnapshotWeek(): string {
  const db = getDb();
  const row = db.prepare("SELECT MAX(snapshot_week) AS w FROM hiring_snapshots").get() as
    | { w: string | null }
    | undefined;
  return row?.w ?? "";
}

export function getCompaniesVelocity(options?: {
  sector?: string;
  status?: string;
  search?: string;
}): CompanyVelocityRow[] {
  const db = getDb();
  const latestWeek = getLatestSnapshotWeek();

  const conditions: string[] = ["c.is_active = 1"];
  const params: unknown[] = [latestWeek];

  if (options?.sector && options.sector !== "ALL") {
    conditions.push("c.sector = ?");
    params.push(options.sector);
  }
  if (options?.status && options.status !== "ALL") {
    conditions.push("COALESCE(s.velocity_status, 'STABLE') = ?");
    params.push(options.status);
  }
  if (options?.search && options.search.trim()) {
    conditions.push("(LOWER(c.name) LIKE ? OR LOWER(c.short_name) LIKE ? OR LOWER(c.sub_sector) LIKE ?)");
    const q = `%${options.search.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }

  const sql = `
    SELECT
      c.id, c.slug, c.name, c.short_name, c.sector, c.sub_sector,
      c.hq_city, c.headcount_band, c.website_url, c.careers_url, c.ats_type, c.is_active,
      COALESCE(s.active_jobs, 0) AS active_jobs,
      COALESCE(s.new_jobs, 0) AS new_jobs,
      COALESCE(s.closed_jobs, 0) AS closed_jobs,
      COALESCE(s.senior_jobs, 0) AS senior_jobs,
      COALESCE(s.tech_jobs, 0) AS tech_jobs,
      COALESCE(s.wow_change_pct, 0) AS wow_change_pct,
      COALESCE(s.mom_change_pct, 0) AS mom_change_pct,
      COALESCE(s.velocity_status, 'STABLE') AS velocity_status
    FROM companies c
    LEFT JOIN hiring_snapshots s
      ON s.company_id = c.id AND s.snapshot_week = ?
    WHERE ${conditions.join(" AND ")}
    ORDER BY COALESCE(s.mom_change_pct, 0) DESC, COALESCE(s.active_jobs, 0) DESC
  `;

  const rows = db.prepare(sql).all(...params) as unknown as Array<
    Omit<CompanyVelocityRow, "senior_ratio_pct" | "net_talent_flow" | "inflow_count" | "outflow_count" | "sparkline">
  >;

  // Fetch 8-week sparklines in one query
  const sparkRows = db
    .prepare(
      `
      SELECT company_id, snapshot_week, active_jobs
      FROM hiring_snapshots
      WHERE snapshot_week >= (
        SELECT DISTINCT snapshot_week FROM hiring_snapshots ORDER BY snapshot_week DESC LIMIT 1 OFFSET 7
      )
      ORDER BY company_id ASC, snapshot_week ASC
    `
    )
    .all() as Array<{ company_id: number; snapshot_week: string; active_jobs: number }>;

  const sparkMap = new Map<number, number[]>();
  for (const r of sparkRows) {
    const arr = sparkMap.get(r.company_id) ?? [];
    arr.push(Number(r.active_jobs));
    sparkMap.set(r.company_id, arr);
  }

  // Fetch inflow / outflow counts per company
  const inflowRows = db
    .prepare("SELECT to_company_id AS cid, COUNT(*) AS cnt FROM candidate_moves WHERE to_company_id IS NOT NULL GROUP BY to_company_id")
    .all() as Array<{ cid: number; cnt: number }>;
  const outflowRows = db
    .prepare("SELECT from_company_id AS cid, COUNT(*) AS cnt FROM candidate_moves WHERE from_company_id IS NOT NULL GROUP BY from_company_id")
    .all() as Array<{ cid: number; cnt: number }>;

  const inflowMap = new Map<number, number>(inflowRows.map((r) => [Number(r.cid), Number(r.cnt)]));
  const outflowMap = new Map<number, number>(outflowRows.map((r) => [Number(r.cid), Number(r.cnt)]));

  return rows.map((r) => {
    const active = Number(r.active_jobs);
    const senior = Number(r.senior_jobs);
    const inflow = inflowMap.get(r.id) ?? 0;
    const outflow = outflowMap.get(r.id) ?? 0;
    return {
      ...r,
      active_jobs: active,
      new_jobs: Number(r.new_jobs),
      closed_jobs: Number(r.closed_jobs),
      senior_jobs: senior,
      tech_jobs: Number(r.tech_jobs),
      wow_change_pct: Number(r.wow_change_pct),
      mom_change_pct: Number(r.mom_change_pct),
      velocity_status: r.velocity_status as VelocityStatus,
      senior_ratio_pct: active > 0 ? Math.round((senior / active) * 1000) / 10 : 0,
      inflow_count: inflow,
      outflow_count: outflow,
      net_talent_flow: inflow - outflow,
      sparkline: sparkMap.get(r.id) ?? [active],
    };
  });
}

export function getWeeklySectorTrends(): WeeklySectorTrend[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT s.snapshot_week AS week, c.sector, SUM(s.active_jobs) AS jobs
      FROM hiring_snapshots s
      JOIN companies c ON c.id = s.company_id
      GROUP BY s.snapshot_week, c.sector
      ORDER BY s.snapshot_week ASC
    `
    )
    .all() as Array<{ week: string; sector: Sector; jobs: number }>;

  const byWeek = new Map<string, WeeklySectorTrend>();
  for (const r of rows) {
    const entry = byWeek.get(r.week) ?? { week: r.week, TECH: 0, CFC: 0, BANKING: 0, total: 0 };
    entry[r.sector] = Number(r.jobs);
    entry.total = entry.TECH + entry.CFC + entry.BANKING;
    byWeek.set(r.week, entry);
  }
  return Array.from(byWeek.values());
}

export function getOverviewData(sector?: string) {
  const companies = getCompaniesVelocity({ sector });
  const totalActiveJobs = companies.reduce((acc, c) => acc + c.active_jobs, 0);
  const totalSeniorJobs = companies.reduce((acc, c) => acc + c.senior_jobs, 0);
  const totalNewJobs = companies.reduce((acc, c) => acc + c.new_jobs, 0);
  const avgMomVelocity =
    companies.length > 0
      ? Math.round((companies.reduce((acc, c) => acc + c.mom_change_pct, 0) / companies.length) * 10) / 10
      : 0;
  const surgingCount = companies.filter((c) => c.velocity_status === "SURGE" || c.velocity_status === "GROWING").length;
  const contractingCount = companies.filter(
    (c) => c.velocity_status === "SLOWDOWN" || c.velocity_status === "FREEZE"
  ).length;

  const topBoosts = [...companies].sort((a, b) => b.mom_change_pct - a.mom_change_pct).slice(0, 6);
  const topDecreases = [...companies].sort((a, b) => a.mom_change_pct - b.mom_change_pct).slice(0, 6);

  const sectorBreakdown = (["TECH", "CFC", "BANKING"] as Sector[]).map((sec) => {
    const allInSec = getCompaniesVelocity({ sector: sec });
    const jobs = allInSec.reduce((a, c) => a + c.active_jobs, 0);
    const senior = allInSec.reduce((a, c) => a + c.senior_jobs, 0);
    const avgMom =
      allInSec.length > 0
        ? Math.round((allInSec.reduce((a, c) => a + c.mom_change_pct, 0) / allInSec.length) * 10) / 10
        : 0;
    const netFlow = allInSec.reduce((a, c) => a + c.net_talent_flow, 0);
    return {
      sector: sec,
      companies: allInSec.length,
      active_jobs: jobs,
      senior_jobs: senior,
      senior_share_pct: jobs > 0 ? Math.round((senior / jobs) * 1000) / 10 : 0,
      avg_mom_pct: avgMom,
      net_talent_flow: netFlow,
    };
  });

  const recentSeniorJobs = getJobs({ sector, seniorOnly: true, limit: 8 });
  const recentMovements = getMovements({ sector, limit: 6 });
  const weeklyTrends = getWeeklySectorTrends();

  const topNetGainer = [...companies].sort((a, b) => b.net_talent_flow - a.net_talent_flow)[0] ?? null;

  return {
    latestWeek: getLatestSnapshotWeek(),
    kpis: {
      trackedCompanies: companies.length,
      totalActiveJobs,
      totalNewJobs,
      totalSeniorJobs,
      seniorSharePct: totalActiveJobs > 0 ? Math.round((totalSeniorJobs / totalActiveJobs) * 1000) / 10 : 0,
      avgMomVelocity,
      surgingCount,
      contractingCount,
      topNetGainer: topNetGainer
        ? { short_name: topNetGainer.short_name, slug: topNetGainer.slug, net: topNetGainer.net_talent_flow }
        : null,
    },
    sectorBreakdown,
    weeklyTrends,
    topBoosts,
    topDecreases,
    recentSeniorJobs,
    recentMovements,
  };
}

export function getJobs(filters?: {
  sector?: string;
  seniorOnly?: boolean;
  seniority?: string;
  department?: string;
  location?: string;
  source?: string;
  companySlug?: string;
  search?: string;
  limit?: number;
}): JobPostingRow[] {
  const db = getDb();
  const conds: string[] = ["j.status = 'ACTIVE'"];
  const params: unknown[] = [];

  if (filters?.sector && filters.sector !== "ALL") {
    conds.push("c.sector = ?");
    params.push(filters.sector);
  }
  if (filters?.seniorOnly) {
    conds.push("j.is_senior = 1");
  }
  if (filters?.seniority && filters.seniority !== "ALL") {
    conds.push("j.seniority = ?");
    params.push(filters.seniority);
  }
  if (filters?.department && filters.department !== "ALL") {
    conds.push("j.department = ?");
    params.push(filters.department);
  }
  if (filters?.location && filters.location !== "ALL") {
    conds.push("j.location = ?");
    params.push(filters.location);
  }
  if (filters?.source && filters.source !== "ALL") {
    conds.push("j.source = ?");
    params.push(filters.source);
  }
  if (filters?.companySlug) {
    conds.push("c.slug = ?");
    params.push(filters.companySlug);
  }
  if (filters?.search && filters.search.trim()) {
    conds.push("(LOWER(j.title) LIKE ? OR LOWER(c.name) LIKE ? OR LOWER(c.short_name) LIKE ?)");
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }

  const limit = filters?.limit ?? 120;
  params.push(limit);

  const sql = `
    SELECT
      j.id, j.company_id, c.slug AS company_slug, c.name AS company_name,
      c.short_name AS company_short_name, c.sector, j.source, j.title,
      j.department, j.seniority, j.is_senior, j.location,
      j.salary_min_vnd, j.salary_max_vnd, j.url, j.posted_date, j.status
    FROM job_postings j
    JOIN companies c ON c.id = j.company_id
    WHERE ${conds.join(" AND ")}
    ORDER BY
      CASE j.seniority
        WHEN 'C_LEVEL' THEN 1
        WHEN 'VP' THEN 2
        WHEN 'DIRECTOR_HEAD' THEN 3
        WHEN 'PRINCIPAL_STAFF' THEN 4
        WHEN 'SENIOR_MANAGER' THEN 5
        WHEN 'SENIOR' THEN 6
        ELSE 7
      END ASC,
      j.posted_date DESC
    LIMIT ?
  `;

  return db.prepare(sql).all(...params) as unknown as JobPostingRow[];
}

export function getSeniorHiringAnalytics(sector?: string) {
  const db = getDb();
  const sectorFilter = sector && sector !== "ALL" ? "AND c.sector = ?" : "";
  const params = sector && sector !== "ALL" ? [sector] : [];

  const byTier = db
    .prepare(
      `
      SELECT j.seniority, COUNT(*) AS count
      FROM job_postings j
      JOIN companies c ON c.id = j.company_id
      WHERE j.status = 'ACTIVE' AND j.is_senior = 1 ${sectorFilter}
      GROUP BY j.seniority
      ORDER BY count DESC
    `
    )
    .all(...params) as Array<{ seniority: string; count: number }>;

  const byDept = db
    .prepare(
      `
      SELECT j.department, COUNT(*) AS count
      FROM job_postings j
      JOIN companies c ON c.id = j.company_id
      WHERE j.status = 'ACTIVE' AND j.is_senior = 1 ${sectorFilter}
      GROUP BY j.department
      ORDER BY count DESC
    `
    )
    .all(...params) as Array<{ department: string; count: number }>;

  const topHiringCompanies = db
    .prepare(
      `
      SELECT
        c.slug, c.short_name, c.sector,
        COUNT(*) AS senior_openings,
        SUM(CASE WHEN j.seniority IN ('C_LEVEL', 'VP', 'DIRECTOR_HEAD') THEN 1 ELSE 0 END) AS exec_openings
      FROM job_postings j
      JOIN companies c ON c.id = j.company_id
      WHERE j.status = 'ACTIVE' AND j.is_senior = 1 ${sectorFilter}
      GROUP BY c.id
      ORDER BY senior_openings DESC
      LIMIT 10
    `
    )
    .all(...params) as Array<{
    slug: string;
    short_name: string;
    sector: Sector;
    senior_openings: number;
    exec_openings: number;
  }>;

  return { byTier, byDept, topHiringCompanies };
}

export function getTalentFlowData(options?: { sector?: string; seniorOnly?: boolean }) {
  const db = getDb();
  const conds: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (options?.sector && options.sector !== "ALL") {
    conds.push("(from_sector = ? OR to_sector = ?)");
    params.push(options.sector, options.sector);
  }
  if (options?.seniorOnly) {
    conds.push("is_senior = 1");
  }
  const whereClause = conds.join(" AND ");

  const sectorFlows = db
    .prepare(
      `
      SELECT from_sector, to_sector, COUNT(*) AS count
      FROM candidate_moves
      WHERE ${whereClause}
      GROUP BY from_sector, to_sector
      ORDER BY count DESC
    `
    )
    .all(...params) as unknown as SectorFlowEdge[];

  const topCorridors = db
    .prepare(
      `
      SELECT
        from_company_name AS from_company,
        from_sector,
        to_company_name AS to_company,
        to_sector,
        COUNT(*) AS count,
        SUM(is_senior) AS senior_count,
        MAX(department) AS top_department
      FROM candidate_moves
      WHERE ${whereClause}
      GROUP BY from_company_name, from_sector, to_company_name, to_sector
      ORDER BY count DESC, senior_count DESC
      LIMIT 24
    `
    )
    .all(...params) as unknown as CompanyFlowEdge[];

  const companyCond = options?.seniorOnly ? "AND is_senior = 1" : "";
  const companies = db
    .prepare("SELECT id, slug, short_name, sector FROM companies WHERE is_active = 1")
    .all() as Array<{ id: number; slug: string; short_name: string; sector: Sector }>;

  const inflows = db
    .prepare(
      `
      SELECT to_company_id AS cid, COUNT(*) AS cnt, SUM(is_senior) AS sen
      FROM candidate_moves
      WHERE to_company_id IS NOT NULL ${companyCond}
      GROUP BY to_company_id
    `
    )
    .all() as Array<{ cid: number; cnt: number; sen: number }>;

  const outflows = db
    .prepare(
      `
      SELECT from_company_id AS cid, COUNT(*) AS cnt, SUM(is_senior) AS sen
      FROM candidate_moves
      WHERE from_company_id IS NOT NULL ${companyCond}
      GROUP BY from_company_id
    `
    )
    .all() as Array<{ cid: number; cnt: number; sen: number }>;

  const inMap = new Map(inflows.map((r) => [Number(r.cid), { cnt: Number(r.cnt), sen: Number(r.sen) }]));
  const outMap = new Map(outflows.map((r) => [Number(r.cid), { cnt: Number(r.cnt), sen: Number(r.sen) }]));

  let netFlows: CompanyNetFlow[] = companies.map((c) => {
    const inf = inMap.get(c.id) ?? { cnt: 0, sen: 0 };
    const outf = outMap.get(c.id) ?? { cnt: 0, sen: 0 };
    return {
      company_id: c.id,
      slug: c.slug,
      short_name: c.short_name,
      sector: c.sector,
      inflow: inf.cnt,
      outflow: outf.cnt,
      net: inf.cnt - outf.cnt,
      senior_inflow: inf.sen,
      senior_outflow: outf.sen,
    };
  });

  if (options?.sector && options.sector !== "ALL") {
    netFlows = netFlows.filter((n) => n.sector === options.sector);
  }
  netFlows.sort((a, b) => b.net - a.net || b.inflow - a.inflow);

  const recentMoves = db
    .prepare(
      `
      SELECT *
      FROM candidate_moves
      WHERE ${whereClause}
      ORDER BY move_date DESC, id DESC
      LIMIT 80
    `
    )
    .all(...params) as unknown as CandidateMoveRow[];

  const totalMovesRow = db
    .prepare(`SELECT COUNT(*) AS total, SUM(is_senior) AS senior_total FROM candidate_moves WHERE ${whereClause}`)
    .get(...params) as { total: number; senior_total: number | null };

  return {
    totalMoves: Number(totalMovesRow?.total ?? 0),
    seniorMoves: Number(totalMovesRow?.senior_total ?? 0),
    sectorFlows,
    topCorridors,
    netFlows,
    recentMoves,
  };
}

export function getMovements(filters?: {
  sector?: string;
  category?: string;
  impact?: string;
  companySlug?: string;
  search?: string;
  limit?: number;
}): CompanyMovementRow[] {
  const db = getDb();
  const conds: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (filters?.sector && filters.sector !== "ALL") {
    conds.push("c.sector = ?");
    params.push(filters.sector);
  }
  if (filters?.category && filters.category !== "ALL") {
    conds.push("m.category = ?");
    params.push(filters.category);
  }
  if (filters?.impact && filters.impact !== "ALL") {
    conds.push("m.impact = ?");
    params.push(filters.impact);
  }
  if (filters?.companySlug) {
    conds.push("c.slug = ?");
    params.push(filters.companySlug);
  }
  if (filters?.search && filters.search.trim()) {
    conds.push("(LOWER(m.title) LIKE ? OR LOWER(m.summary) LIKE ? OR LOWER(c.short_name) LIKE ?)");
    const q = `%${filters.search.trim().toLowerCase()}%`;
    params.push(q, q, q);
  }

  params.push(filters?.limit ?? 60);

  return db
    .prepare(
      `
      SELECT
        m.id, m.company_id, c.slug AS company_slug, c.name AS company_name,
        c.short_name AS company_short_name, c.sector, m.title, m.summary,
        m.category, m.impact, m.event_date, m.source_name, m.source_url, m.is_verified
      FROM company_movements m
      JOIN companies c ON c.id = m.company_id
      WHERE ${conds.join(" AND ")}
      ORDER BY m.event_date DESC, m.id DESC
      LIMIT ?
    `
    )
    .all(...params) as unknown as CompanyMovementRow[];
}

export function getCompanyDetail(slug: string) {
  const db = getDb();
  const all = getCompaniesVelocity();
  const company = all.find((c) => c.slug === slug);
  if (!company) return null;

  const history = db
    .prepare(
      `
      SELECT snapshot_week, active_jobs, new_jobs, closed_jobs, senior_jobs, tech_jobs, wow_change_pct, mom_change_pct, velocity_status
      FROM hiring_snapshots
      WHERE company_id = ?
      ORDER BY snapshot_week ASC
    `
    )
    .all(company.id)
    .map((row) => ({
      snapshot_week: String(row.snapshot_week),
      active_jobs: Number(row.active_jobs),
      new_jobs: Number(row.new_jobs),
      closed_jobs: Number(row.closed_jobs),
      senior_jobs: Number(row.senior_jobs),
      tech_jobs: Number(row.tech_jobs),
      wow_change_pct: Number(row.wow_change_pct),
      mom_change_pct: Number(row.mom_change_pct),
      velocity_status: String(row.velocity_status) as VelocityStatus,
    }));

  const jobs = getJobs({ companySlug: slug, limit: 80 }).map((j) => ({ ...j }));
  const movements = getMovements({ companySlug: slug, limit: 20 }).map((m) => ({ ...m }));

  const topSources = db
    .prepare(
      `
      SELECT from_company_name AS company, from_sector AS sector, COUNT(*) AS count, SUM(is_senior) AS senior_count
      FROM candidate_moves
      WHERE to_company_id = ?
      GROUP BY from_company_name, from_sector
      ORDER BY count DESC
      LIMIT 8
    `
    )
    .all(company.id)
    .map((r) => ({
      company: String(r.company),
      sector: String(r.sector),
      count: Number(r.count),
      senior_count: Number(r.senior_count ?? 0),
    }));

  const topDestinations = db
    .prepare(
      `
      SELECT to_company_name AS company, to_sector AS sector, COUNT(*) AS count, SUM(is_senior) AS senior_count
      FROM candidate_moves
      WHERE from_company_id = ?
      GROUP BY to_company_name, to_sector
      ORDER BY count DESC
      LIMIT 8
    `
    )
    .all(company.id)
    .map((r) => ({
      company: String(r.company),
      sector: String(r.sector),
      count: Number(r.count),
      senior_count: Number(r.senior_count ?? 0),
    }));

  const departmentMix = db
    .prepare(
      `
      SELECT department, COUNT(*) AS count, SUM(is_senior) AS senior_count
      FROM job_postings
      WHERE company_id = ? AND status = 'ACTIVE'
      GROUP BY department
      ORDER BY count DESC
    `
    )
    .all(company.id)
    .map((r) => ({
      department: String(r.department),
      count: Number(r.count),
      senior_count: Number(r.senior_count ?? 0),
    }));

  return {
    company,
    history,
    jobs,
    movements,
    topSources,
    topDestinations,
    departmentMix,
  };
}

export function getCrawlerStatus() {
  const db = getDb();
  const runs = db
    .prepare("SELECT * FROM crawl_runs ORDER BY id DESC LIMIT 30")
    .all() as unknown as CrawlRunRow[];

  const sourceCounts = db
    .prepare(
      `
      SELECT source, COUNT(*) AS active_jobs, MAX(last_seen_at) AS last_seen
      FROM job_postings
      WHERE status = 'ACTIVE'
      GROUP BY source
    `
    )
    .all() as Array<{ source: string; active_jobs: number; last_seen: string }>;

  const companies = getCompaniesVelocity();

  return { runs, sourceCounts, companies };
}

export function createCompany(input: {
  name: string;
  short_name?: string;
  sector: Sector;
  sub_sector?: string;
  hq_city?: string;
  headcount_band?: string;
  website_url?: string;
  careers_url?: string;
  ats_type?: string;
  ats_board_token?: string;
}) {
  const db = getDb();
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const shortName = input.short_name?.trim() || input.name.trim();
  const keywords = JSON.stringify([input.name.trim(), shortName]);

  db.prepare(
    `
    INSERT INTO companies (
      slug, name, short_name, sector, sub_sector, hq_city, headcount_band,
      website_url, careers_url, ats_type, ats_board_token, search_keywords, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `
  ).run(
    slug,
    input.name.trim(),
    shortName,
    input.sector,
    input.sub_sector?.trim() || "",
    input.hq_city?.trim() || "Ho Chi Minh City",
    input.headcount_band?.trim() || "1,000-5,000",
    input.website_url?.trim() || "",
    input.careers_url?.trim() || "",
    input.ats_type?.trim() || "custom",
    input.ats_board_token?.trim() || "",
    keywords
  );

  return db.prepare("SELECT * FROM companies WHERE slug = ?").get(slug);
}

export function deleteCompanyBySlug(slug: string) {
  const db = getDb();
  const res = db.prepare("DELETE FROM companies WHERE slug = ?").run(slug);
  return Number(res.changes);
}

export function createMovement(input: {
  company_id: number;
  title: string;
  summary: string;
  category: string;
  impact: string;
  event_date?: string;
  source_name?: string;
  source_url?: string;
}) {
  const db = getDb();
  const eventDate = input.event_date || new Date().toISOString().slice(0, 10);
  const res = db
    .prepare(
      `
      INSERT INTO company_movements (
        company_id, title, summary, category, impact, event_date, source_name, source_url, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `
    )
    .run(
      input.company_id,
      input.title.trim(),
      input.summary.trim(),
      input.category,
      input.impact,
      eventDate,
      input.source_name?.trim() || "Analyst Note",
      input.source_url?.trim() || ""
    );

  return db.prepare("SELECT * FROM company_movements WHERE id = ?").get(Number(res.lastInsertRowid));
}
