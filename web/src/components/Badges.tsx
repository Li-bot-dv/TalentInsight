import {
  CATEGORY_LABELS,
  IMPACT_META,
  SECTOR_META,
  SENIORITY_LABELS,
  VELOCITY_META,
  formatPct,
} from "@/lib/format";
import type {
  ImpactPolarity,
  MovementCategory,
  Sector,
  SeniorityTier,
  VelocityStatus,
} from "@/lib/types";

export function SectorBadge({ sector }: { sector: string }) {
  const meta = SECTOR_META[sector as Sector];
  if (!meta) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-stone-100 text-stone-700">
        {sector}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.shortLabel}
    </span>
  );
}

export function VelocityBadge({ status }: { status: VelocityStatus }) {
  const meta = VELOCITY_META[status] ?? VELOCITY_META.STABLE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function DeltaValue({ value, suffix = "" }: { value: number; suffix?: string }) {
  const color =
    value > 0
      ? "text-emerald-700"
      : value < 0
      ? "text-rose-700"
      : "text-stone-500";
  const text = suffix === "%" ? formatPct(value) : `${value > 0 ? "+" : ""}${value}${suffix}`;
  return <span className={`font-mono text-xs font-semibold tabular-nums ${color}`}>{text}</span>;
}

export function SeniorityBadge({ tier }: { tier: SeniorityTier }) {
  const styles: Record<SeniorityTier, string> = {
    C_LEVEL: "bg-[#14171a] text-white",
    VP: "bg-[#1e3a5f] text-white",
    DIRECTOR_HEAD: "bg-teal-50 text-teal-900 border border-teal-200",
    PRINCIPAL_STAFF: "bg-amber-50 text-amber-900 border border-amber-200",
    SENIOR_MANAGER: "bg-stone-100 text-stone-800 border border-stone-200",
    SENIOR: "bg-stone-50 text-stone-700 border border-stone-200",
    MID: "bg-stone-50 text-stone-600",
    JUNIOR: "bg-stone-50 text-stone-500",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${styles[tier] ?? ""}`}>
      {SENIORITY_LABELS[tier] ?? tier}
    </span>
  );
}

export function CategoryBadge({ category }: { category: MovementCategory }) {
  return (
    <span className="inline-flex items-center rounded bg-[#f1efe9] px-2 py-0.5 text-[11px] font-medium text-[#3f4650]">
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

export function ImpactBadge({ impact }: { impact: ImpactPolarity }) {
  const meta = IMPACT_META[impact] ?? IMPACT_META.NEUTRAL;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}
