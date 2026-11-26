export type Sector = "TECH" | "CFC" | "BANKING";
export type VelocityStatus = "SURGE" | "GROWING" | "STABLE" | "SLOWDOWN" | "FREEZE";
export type SeniorityTier =
  | "C_LEVEL"
  | "VP"
  | "DIRECTOR_HEAD"
  | "PRINCIPAL_STAFF"
  | "SENIOR_MANAGER"
  | "SENIOR"
  | "MID"
  | "JUNIOR";

export type MovementCategory =
  | "LEADERSHIP"
  | "EXPANSION"
  | "RESTRUCTURING"
  | "HIRING_DRIVE"
  | "M_AND_A"
  | "PRODUCT_TECH";

export type ImpactPolarity = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface CompanyVelocityRow {
  id: number;
  slug: string;
  name: string;
  short_name: string;
  sector: Sector;
  sub_sector: string;
  hq_city: string;
  headcount_band: string;
  website_url: string;
  careers_url: string;
  ats_type: string;
  is_active: number;
  active_jobs: number;
  new_jobs: number;
  closed_jobs: number;
  senior_jobs: number;
  tech_jobs: number;
  wow_change_pct: number;
  mom_change_pct: number;
  velocity_status: VelocityStatus;
  senior_ratio_pct: number;
  net_talent_flow: number;
  inflow_count: number;
  outflow_count: number;
  sparkline: number[];
}

export interface JobPostingRow {
  id: number;
  company_id: number;
  company_slug: string;
  company_name: string;
  company_short_name: string;
  sector: Sector;
  source: string;
  title: string;
  department: string;
  seniority: SeniorityTier;
  is_senior: number;
  location: string;
  salary_min_vnd: number | null;
  salary_max_vnd: number | null;
  url: string;
  posted_date: string;
  status: string;
}

export interface CompanyMovementRow {
  id: number;
  company_id: number;
  company_slug: string;
  company_name: string;
  company_short_name: string;
  sector: Sector;
  title: string;
  summary: string;
  category: MovementCategory;
  impact: ImpactPolarity;
  event_date: string;
  source_name: string;
  source_url: string;
  is_verified: number;
}

export interface CandidateMoveRow {
  id: number;
  from_company_id: number | null;
  from_company_name: string;
  from_sector: string;
  to_company_id: number | null;
  to_company_name: string;
  to_sector: string;
  role_title: string;
  department: string;
  seniority: SeniorityTier;
  is_senior: number;
  move_date: string;
  location: string;
  source: string;
  notes: string;
}

export interface CrawlRunRow {
  id: number;
  source: string;
  status: string;
  companies_scanned: number;
  jobs_found: number;
  jobs_inserted: number;
  movements_found: number;
  error_message: string;
  started_at: string;
  finished_at: string | null;
}

export interface WeeklySectorTrend {
  week: string;
  TECH: number;
  CFC: number;
  BANKING: number;
  total: number;
}

export interface SectorFlowEdge {
  from_sector: string;
  to_sector: string;
  count: number;
}

export interface CompanyFlowEdge {
  from_company: string;
  from_sector: string;
  to_company: string;
  to_sector: string;
  count: number;
  senior_count: number;
  top_department: string;
}

export interface CompanyNetFlow {
  company_id: number;
  slug: string;
  short_name: string;
  sector: Sector;
  inflow: number;
  outflow: number;
  net: number;
  senior_inflow: number;
  senior_outflow: number;
}
