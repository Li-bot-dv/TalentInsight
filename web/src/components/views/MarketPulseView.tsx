"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Briefcase, Building2, TrendingUp, Users } from "lucide-react";
import {
  CategoryBadge,
  DeltaValue,
  ImpactBadge,
  SectorBadge,
  SeniorityBadge,
  VelocityBadge,
} from "@/components/Badges";
import MarketTrendChart from "@/components/MarketTrendChart";
import { TrendSparkline } from "@/components/TrendSparkline";
import { SECTOR_META, formatPct, formatSalaryVnd, formatShortDate } from "@/lib/format";
import type {
  CompanyMovementRow,
  CompanyVelocityRow,
  JobPostingRow,
  Sector,
  WeeklySectorTrend,
} from "@/lib/types";

export interface OverviewDataset {
  latestWeek: string;
  kpis: {
    trackedCompanies: number;
    totalActiveJobs: number;
    totalNewJobs: number;
    totalSeniorJobs: number;
    seniorSharePct: number;
    avgMomVelocity: number;
    surgingCount: number;
    contractingCount: number;
    topNetGainer: { short_name: string; slug: string; net: number } | null;
  };
  sectorBreakdown: Array<{
    sector: Sector;
    companies: number;
    active_jobs: number;
    senior_jobs: number;
    senior_share_pct: number;
    avg_mom_pct: number;
    net_talent_flow: number;
  }>;
  weeklyTrends: WeeklySectorTrend[];
  topBoosts: CompanyVelocityRow[];
  topDecreases: CompanyVelocityRow[];
  recentSeniorJobs: JobPostingRow[];
  recentMovements: CompanyMovementRow[];
}

const SECTOR_TABS = [
  { key: "ALL", label: "All Sectors (30)" },
  { key: "TECH", label: "Tech & FinTech" },
  { key: "CFC", label: "Consumer Finance (CFC)" },
  { key: "BANKING", label: "Commercial Banking" },
] as const;

export default function MarketPulseView({
  datasets,
}: {
  datasets: Record<string, OverviewDataset>;
}) {
  const [sector, setSector] = useState<string>("ALL");
  const data = datasets[sector] ?? datasets.ALL;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-[#e5e2d9]">
        <div>
          <div className="section-kicker">Vietnam Talent Intelligence · Weekly Edition</div>
          <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#14171a]">
            Market Pulse Overview
          </h1>
          <p className="mt-1 text-sm text-[#525b66]">
            Hiring velocity, senior leadership recruitment, candidate migration, and org movements across Vietnam Tech,
            CFC, and Banking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#efede6] p-1 rounded-lg border border-[#e5e2d9]">
          {SECTOR_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              id={`sector-tab-${tab.key.toLowerCase()}`}
              onClick={() => setSector(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                sector === tab.key
                  ? "bg-white text-[#14171a] shadow-xs"
                  : "text-[#525b66] hover:text-[#14171a]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <span className="section-kicker">Active Open Roles</span>
            <Briefcase className="h-4 w-4 text-[#7c8490]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-[#14171a]">
              {data.kpis.totalActiveJobs.toLocaleString()}
            </span>
            <span className="font-mono text-xs text-emerald-700 font-semibold">
              +{data.kpis.totalNewJobs} this wk
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#646d78]">
            Across {data.kpis.trackedCompanies} tracked employers · week of {formatShortDate(data.latestWeek)}
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <span className="section-kicker">Hiring Velocity (MoM)</span>
            <TrendingUp className="h-4 w-4 text-[#7c8490]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span
              className={`font-mono text-3xl font-bold tabular-nums tracking-tight ${
                data.kpis.avgMomVelocity >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatPct(data.kpis.avgMomVelocity)}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#646d78]">
            <span className="font-semibold text-emerald-700">{data.kpis.surgingCount} expanding</span> ·{" "}
            <span className="font-semibold text-rose-700">{data.kpis.contractingCount} contracting</span>
          </p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <span className="section-kicker">Senior &amp; Exec Demand</span>
            <Users className="h-4 w-4 text-[#7c8490]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-[#14171a]">
              {data.kpis.totalSeniorJobs}
            </span>
            <span className="font-mono text-xs font-semibold text-[#0f766e]">
              {data.kpis.seniorSharePct}% share
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[#646d78]">C-Level, VP, Director, Head, Staff &amp; Lead roles</p>
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between">
            <span className="section-kicker">Top Talent Magnet</span>
            <Building2 className="h-4 w-4 text-[#7c8490]" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            {data.kpis.topNetGainer ? (
              <>
                <Link
                  href={`/companies/${data.kpis.topNetGainer.slug}`}
                  className="text-xl font-bold tracking-tight text-[#14171a] hover:text-[#0f766e] truncate"
                >
                  {data.kpis.topNetGainer.short_name}
                </Link>
                <span className="font-mono text-sm font-bold text-emerald-700 shrink-0">
                  +{data.kpis.topNetGainer.net} net
                </span>
              </>
            ) : (
              <span className="text-sm text-[#7c8490]">—</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[#646d78]">Highest net candidate inflow in tracked corridors</p>
        </div>
      </section>

      {/* Trend Chart + Sector Comparison */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="surface-card p-5 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#14171a]">
                16-Week Active Hiring Volume by Sector
              </h2>
              <p className="text-xs text-[#646d78]">
                Weekly aggregated openings across Vietnam Tech, Consumer Finance, and Banking
              </p>
            </div>
            <Link
              href="/velocity"
              className="text-xs font-semibold text-[#0f766e] hover:underline inline-flex items-center gap-1"
            >
              Full Radar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <MarketTrendChart data={data.weeklyTrends} />
        </div>

        <div className="surface-card p-5 lg:col-span-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#14171a]">Sector Scorecard</h2>
            <p className="text-xs text-[#646d78] mb-4">
              Comparative hiring momentum, leadership density, and net talent migration
            </p>

            <div className="space-y-3">
              {data.sectorBreakdown.map((sec) => {
                const meta = SECTOR_META[sec.sector];
                return (
                  <div
                    key={sec.sector}
                    className="rounded-lg border border-[#e5e2d9] bg-[#faf9f6] p-3.5 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                        <span className="text-sm font-bold text-[#14171a]">{meta.label}</span>
                        <span className="text-[11px] text-[#7c8490]">({sec.companies})</span>
                      </div>
                      <DeltaValue value={sec.avg_mom_pct} suffix="%" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#eae7de] text-xs">
                      <div>
                        <div className="text-[11px] text-[#7c8490]">Active Roles</div>
                        <div className="font-mono font-semibold text-[#14171a] tabular-nums">{sec.active_jobs}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7c8490]">Senior Share</div>
                        <div className="font-mono font-semibold text-[#14171a] tabular-nums">
                          {sec.senior_share_pct}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#7c8490]">Net Talent Flow</div>
                        <div
                          className={`font-mono font-semibold tabular-nums ${
                            sec.net_talent_flow >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {sec.net_talent_flow > 0 ? `+${sec.net_talent_flow}` : sec.net_talent_flow}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#efede6] flex items-center justify-between text-xs text-[#646d78]">
            <span>CFC outflows are primarily absorbed by Tier-1 Banks &amp; FinTechs.</span>
            <Link href="/talent-flow" className="font-semibold text-[#0f766e] hover:underline shrink-0 ml-2">
              View Flow →
            </Link>
          </div>
        </div>
      </section>

      {/* Hiring Boost vs Hiring Decrease Split */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-700" />
              <h2 className="text-sm font-bold tracking-tight text-[#14171a]">Hiring Boost Leaders (MoM)</h2>
            </div>
            <Link href="/velocity" className="text-xs font-medium text-[#0f766e] hover:underline">
              All surges
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full data-table text-sm">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Sector</th>
                  <th>8-Wk Trend</th>
                  <th className="text-right">Open</th>
                  <th className="text-right">MoM</th>
                </tr>
              </thead>
              <tbody>
                {data.topBoosts.map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link
                        href={`/companies/${c.slug}`}
                        className="font-semibold text-[#14171a] hover:text-[#0f766e]"
                      >
                        {c.short_name}
                      </Link>
                    </td>
                    <td>
                      <SectorBadge sector={c.sector} />
                    </td>
                    <td>
                      <TrendSparkline data={c.sparkline} positive />
                    </td>
                    <td className="text-right font-mono text-xs font-semibold tabular-nums">{c.active_jobs}</td>
                    <td className="text-right">
                      <DeltaValue value={c.mom_change_pct} suffix="%" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-rose-700" />
              <h2 className="text-sm font-bold tracking-tight text-[#14171a]">
                Hiring Decrease &amp; Freeze Alerts (MoM)
              </h2>
            </div>
            <Link href="/velocity" className="text-xs font-medium text-rose-700 hover:underline">
              All alerts
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full data-table text-sm">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th>8-Wk Trend</th>
                  <th className="text-right">Open</th>
                  <th className="text-right">MoM</th>
                </tr>
              </thead>
              <tbody>
                {data.topDecreases.map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link
                        href={`/companies/${c.slug}`}
                        className="font-semibold text-[#14171a] hover:text-[#0f766e]"
                      >
                        {c.short_name}
                      </Link>
                    </td>
                    <td>
                      <VelocityBadge status={c.velocity_status} />
                    </td>
                    <td>
                      <TrendSparkline data={c.sparkline} positive={c.mom_change_pct >= 0} />
                    </td>
                    <td className="text-right font-mono text-xs font-semibold tabular-nums">{c.active_jobs}</td>
                    <td className="text-right">
                      <DeltaValue value={c.mom_change_pct} suffix="%" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bottom Strip: Senior Roles + Company Movements */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="surface-card overflow-hidden lg:col-span-7">
          <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#14171a]">High-Signal Senior Openings</h2>
              <p className="text-xs text-[#646d78]">Latest C-Level, VP, Director/Head, and Principal/Staff roles</p>
            </div>
            <Link
              href="/senior-hiring"
              className="text-xs font-semibold text-[#0f766e] hover:underline inline-flex items-center gap-1"
            >
              All Senior Roles <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[#efede6]">
            {data.recentSeniorJobs.map((job) => (
              <div key={job.id} className="px-5 py-3.5 hover:bg-[#faf9f6] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeniorityBadge tier={job.seniority} />
                    <Link
                      href={`/companies/${job.company_slug}`}
                      className="text-xs font-semibold text-[#4e5661] hover:text-[#0f766e]"
                    >
                      {job.company_short_name}
                    </Link>
                    <span className="text-[11px] text-[#7c8490]">· {job.location}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[#14171a] truncate">{job.title}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs font-semibold text-[#14171a]">
                    {formatSalaryVnd(job.salary_min_vnd, job.salary_max_vnd)}
                  </div>
                  <div className="text-[11px] text-[#7c8490] mt-0.5">{formatShortDate(job.posted_date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card overflow-hidden lg:col-span-5">
          <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[#14171a]">Recent Company Movements</h2>
              <p className="text-xs text-[#646d78]">Leadership shifts, new hubs, M&amp;A &amp; restructuring</p>
            </div>
            <Link
              href="/movements"
              className="text-xs font-semibold text-[#0f766e] hover:underline inline-flex items-center gap-1"
            >
              Full Feed <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[#efede6]">
            {data.recentMovements.map((m) => (
              <article key={m.id} className="px-5 py-3.5 hover:bg-[#faf9f6]">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <Link
                    href={`/companies/${m.company_slug}`}
                    className="text-xs font-bold text-[#14171a] hover:text-[#0f766e]"
                  >
                    {m.company_short_name}
                  </Link>
                  <CategoryBadge category={m.category} />
                  <ImpactBadge impact={m.impact} />
                  <span className="ml-auto text-[11px] font-mono text-[#7c8490]">
                    {formatShortDate(m.event_date)}
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-[#14171a] leading-snug">{m.title}</h3>
                <p className="mt-1 text-xs text-[#646d78] line-clamp-2 leading-relaxed">{m.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
