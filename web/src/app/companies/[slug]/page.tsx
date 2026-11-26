import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  CategoryBadge,
  DeltaValue,
  ImpactBadge,
  SectorBadge,
  SeniorityBadge,
  VelocityBadge,
} from "@/components/Badges";
import CompanyHistoryChart from "@/components/CompanyHistoryChart";
import { getCompanyDetail } from "@/lib/db";
import { SOURCE_LABELS, formatPct, formatSalaryVnd, formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = getCompanyDetail(slug);
  if (!detail) notFound();

  const { company, history, jobs, movements, topSources, topDestinations, departmentMix } = detail;
  const seniorJobs = jobs.filter((j) => j.is_senior === 1);
  const maxDept = Math.max(1, ...departmentMix.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/velocity"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#525b66] hover:text-[#14171a]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Hiring Velocity Radar
        </Link>
      </div>

      {/* Header */}
      <header className="surface-card p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SectorBadge sector={company.sector} />
            <VelocityBadge status={company.velocity_status} />
            <span className="text-xs text-[#7c8490]">
              {company.hq_city} · {company.headcount_band} employees
            </span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-[#14171a]">
            {company.name}
          </h1>
          <p className="mt-1 text-sm text-[#525b66]">{company.sub_sector}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {company.careers_url && (
            <a
              href={company.careers_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#14171a] text-white text-xs font-semibold hover:bg-[#2a2f36]"
            >
              Careers Portal <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {company.website_url && (
            <a
              href={company.website_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold text-[#14171a] hover:bg-[#faf9f6]"
            >
              Website <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </header>

      {/* KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface-card p-4">
          <div className="section-kicker">Active Roles</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{company.active_jobs}</div>
          <div className="text-xs text-[#646d78] mt-0.5">+{company.new_jobs} newly spotted this week</div>
        </div>
        <div className="surface-card p-4">
          <div className="section-kicker">MoM Hiring Velocity</div>
          <div
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              company.mom_change_pct >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatPct(company.mom_change_pct)}
          </div>
          <div className="text-xs text-[#646d78] mt-0.5">WoW: {formatPct(company.wow_change_pct)}</div>
        </div>
        <div className="surface-card p-4">
          <div className="section-kicker">Senior &amp; Exec Share</div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums">{company.senior_ratio_pct}%</div>
          <div className="text-xs text-[#646d78] mt-0.5">{company.senior_jobs} leadership &amp; staff roles</div>
        </div>
        <div className="surface-card p-4">
          <div className="section-kicker">Net Candidate Flow</div>
          <div
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              company.net_talent_flow >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {company.net_talent_flow > 0 ? `+${company.net_talent_flow}` : company.net_talent_flow}
          </div>
          <div className="text-xs text-[#646d78] mt-0.5">
            {company.inflow_count} inflow · {company.outflow_count} outflow
          </div>
        </div>
      </section>

      {/* History Chart + Department Mix */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="surface-card p-5 lg:col-span-8">
          <h2 className="text-base font-bold text-[#14171a]">16-Week Hiring Trajectory</h2>
          <p className="text-xs text-[#646d78] mb-3">Total active requisitions vs. senior &amp; leadership demand</p>
          <CompanyHistoryChart data={history} />
        </div>

        <div className="surface-card p-5 lg:col-span-4">
          <h2 className="text-base font-bold text-[#14171a]">Hiring Mix by Function</h2>
          <p className="text-xs text-[#646d78] mb-4">Active role distribution</p>
          <div className="space-y-3">
            {departmentMix.map((d) => (
              <div key={d.department} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#14171a]">{d.department}</span>
                  <span className="font-mono text-[#4e5661]">
                    <strong className="text-[#14171a]">{d.count}</strong> ({d.senior_count} sr)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#efede6] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0f766e]"
                    style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inflow vs Outflow */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="surface-card p-5">
          <h2 className="text-sm font-bold text-[#14171a] mb-3">Top Talent Sources (Inflow From)</h2>
          {topSources.length === 0 ? (
            <p className="text-xs text-[#7c8490]">No recorded inflow transitions yet.</p>
          ) : (
            <div className="divide-y divide-[#efede6]">
              {topSources.map((s) => (
                <div key={s.company} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#14171a]">{s.company}</span>
                    <SectorBadge sector={s.sector} />
                  </div>
                  <div className="font-mono">
                    <DeltaValue value={s.count} /> <span className="text-[#7c8490]">({s.senior_count} sr)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="surface-card p-5">
          <h2 className="text-sm font-bold text-[#14171a] mb-3">Top Talent Destinations (Outflow To)</h2>
          {topDestinations.length === 0 ? (
            <p className="text-xs text-[#7c8490]">No recorded outflow transitions yet.</p>
          ) : (
            <div className="divide-y divide-[#efede6]">
              {topDestinations.map((d) => (
                <div key={d.company} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#14171a]">{d.company}</span>
                    <SectorBadge sector={d.sector} />
                  </div>
                  <div className="font-mono">
                    <DeltaValue value={-d.count} /> <span className="text-[#7c8490]">({d.senior_count} sr)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Movements + Open Roles */}
      {movements.length > 0 && (
        <section className="surface-card p-5">
          <h2 className="text-sm font-bold text-[#14171a] mb-3">Company Movement Timeline</h2>
          <div className="space-y-3">
            {movements.map((m) => (
              <div key={m.id} className="p-3.5 rounded-lg bg-[#faf9f6] border border-[#e5e2d9]">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <CategoryBadge category={m.category} />
                  <ImpactBadge impact={m.impact} />
                  <span className="ml-auto font-mono text-[11px] text-[#7c8490]">{formatShortDate(m.event_date)}</span>
                </div>
                <div className="text-sm font-bold text-[#14171a]">{m.title}</div>
                <p className="mt-1 text-xs text-[#4e5661] leading-relaxed">{m.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#14171a]">
              Active Openings ({jobs.length} total · {seniorJobs.length} senior/leadership)
            </h2>
            <p className="text-xs text-[#646d78]">Sorted by seniority tier and recency</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table text-xs">
            <thead>
              <tr>
                <th>Role Title</th>
                <th>Tier</th>
                <th>Function</th>
                <th>City</th>
                <th>Salary Band</th>
                <th>Source</th>
                <th className="text-right">Posted</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="font-semibold text-[#14171a]">{j.title}</td>
                  <td>
                    <SeniorityBadge tier={j.seniority} />
                  </td>
                  <td className="text-[#4e5661]">{j.department}</td>
                  <td className="text-[#4e5661]">{j.location}</td>
                  <td className="font-mono text-[#14171a]">{formatSalaryVnd(j.salary_min_vnd, j.salary_max_vnd)}</td>
                  <td className="text-[#646d78]">{SOURCE_LABELS[j.source] ?? j.source}</td>
                  <td className="text-right font-mono text-[#646d78]">{formatShortDate(j.posted_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
