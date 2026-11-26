import type { ImpactPolarity, MovementCategory, Sector, SeniorityTier, VelocityStatus } from "./types";

export const SECTOR_META: Record<
  Sector,
  { label: string; shortLabel: string; color: string; bg: string; text: string; border: string }
> = {
  TECH: {
    label: "Tech & FinTech",
    shortLabel: "Tech",
    color: "#0F766E",
    bg: "bg-teal-50",
    text: "text-teal-800",
    border: "border-teal-200",
  },
  CFC: {
    label: "Consumer Finance (CFC)",
    shortLabel: "CFC",
    color: "#B45309",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  BANKING: {
    label: "Commercial Banking",
    shortLabel: "Banking",
    color: "#1E3A5F",
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-300",
  },
};

export const VELOCITY_META: Record<
  VelocityStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  SURGE: { label: "Hiring Surge", bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-600" },
  GROWING: { label: "Growing", bg: "bg-teal-50", text: "text-teal-800", dot: "bg-teal-600" },
  STABLE: { label: "Stable", bg: "bg-stone-100", text: "text-stone-700", dot: "bg-stone-500" },
  SLOWDOWN: { label: "Slowdown", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-600" },
  FREEZE: { label: "Contraction", bg: "bg-rose-50", text: "text-rose-800", dot: "bg-rose-600" },
};

export const SENIORITY_LABELS: Record<SeniorityTier, string> = {
  C_LEVEL: "C-Level / CXO",
  VP: "VP / SVP",
  DIRECTOR_HEAD: "Director / Head",
  PRINCIPAL_STAFF: "Principal / Staff",
  SENIOR_MANAGER: "Senior Manager / Lead",
  SENIOR: "Senior IC",
  MID: "Mid-Level",
  JUNIOR: "Junior / Fresher",
};

export const CATEGORY_LABELS: Record<MovementCategory, string> = {
  LEADERSHIP: "Leadership Move",
  EXPANSION: "Hub & Expansion",
  RESTRUCTURING: "Restructuring",
  HIRING_DRIVE: "Hiring Drive",
  M_AND_A: "M&A / Strategic",
  PRODUCT_TECH: "Tech & Product",
};

export const IMPACT_META: Record<ImpactPolarity, { label: string; bg: string; text: string }> = {
  POSITIVE: { label: "Expansionary", bg: "bg-emerald-50", text: "text-emerald-800" },
  NEGATIVE: { label: "Contractionary", bg: "bg-rose-50", text: "text-rose-800" },
  NEUTRAL: { label: "Structural", bg: "bg-stone-100", text: "text-stone-700" },
};

export const SOURCE_LABELS: Record<string, string> = {
  topdev: "TopDev",
  itviec: "ITviec",
  vietnamworks: "VietnamWorks",
  careerviet: "CareerViet",
  company_ats: "Company Career Site",
  vn_news_rss: "VN News RSS",
  csv_import: "CSV Import",
  seed: "Market Baseline",
};

export function formatPct(val: number): string {
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}%`;
}

export function formatSalaryVnd(min: number | null, max: number | null): string {
  if (!min && !max) return "Competitive";
  const toM = (v: number) => `${Math.round(v / 1_000_000)}M`;
  if (min && max) return `${toM(min)}–${toM(max)} VND`;
  if (min) return `From ${toM(min)} VND`;
  return `Up to ${toM(max!)} VND`;
}

export function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
