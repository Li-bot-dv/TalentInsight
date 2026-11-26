"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { SectorBadge, SeniorityBadge } from "@/components/Badges";
import { SENIORITY_LABELS, SOURCE_LABELS, formatSalaryVnd, formatShortDate } from "@/lib/format";
import type { JobPostingRow, Sector, SeniorityTier } from "@/lib/types";

export default function SeniorHiringView({
  initialJobs,
}: {
  initialJobs: JobPostingRow[];
}) {
  const [sector, setSector] = useState("ALL");
  const [seniority, setSeniority] = useState("ALL");
  const [department, setDepartment] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [search, setSearch] = useState("");
  const [includeMid, setIncludeMid] = useState(false);

  const sectorJobs = useMemo(
    () => (sector === "ALL" ? initialJobs : initialJobs.filter((j) => j.sector === sector)),
    [initialJobs, sector]
  );

  const analytics = useMemo(() => {
    const seniorOnly = sectorJobs.filter((j) => j.is_senior === 1);
    const tierMap = new Map<SeniorityTier, number>();
    const deptMap = new Map<string, number>();
    const compMap = new Map<
      string,
      { slug: string; short_name: string; sector: Sector; senior_openings: number; exec_openings: number }
    >();

    for (const j of seniorOnly) {
      tierMap.set(j.seniority, (tierMap.get(j.seniority) ?? 0) + 1);
      deptMap.set(j.department, (deptMap.get(j.department) ?? 0) + 1);
      const c = compMap.get(j.company_slug) ?? {
        slug: j.company_slug,
        short_name: j.company_short_name,
        sector: j.sector,
        senior_openings: 0,
        exec_openings: 0,
      };
      c.senior_openings += 1;
      if (["C_LEVEL", "VP", "DIRECTOR_HEAD"].includes(j.seniority)) c.exec_openings += 1;
      compMap.set(j.company_slug, c);
    }

    return {
      byTier: Array.from(tierMap.entries())
        .map(([seniority, count]) => ({ seniority, count }))
        .sort((a, b) => b.count - a.count),
      byDept: Array.from(deptMap.entries())
        .map(([department, count]) => ({ department, count }))
        .sort((a, b) => b.count - a.count),
      topHiringCompanies: Array.from(compMap.values())
        .sort((a, b) => b.senior_openings - a.senior_openings)
        .slice(0, 6),
    };
  }, [sectorJobs]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sectorJobs
      .filter((j) => (includeMid ? true : j.is_senior === 1))
      .filter((j) => (seniority === "ALL" ? true : j.seniority === seniority))
      .filter((j) => (department === "ALL" ? true : j.department === department))
      .filter((j) => (location === "ALL" ? true : j.location === location))
      .filter((j) =>
        !q
          ? true
          : j.title.toLowerCase().includes(q) ||
            j.company_name.toLowerCase().includes(q) ||
            j.company_short_name.toLowerCase().includes(q)
      )
      .slice(0, 150);
  }, [sectorJobs, includeMid, seniority, department, location, search]);

  const maxTier = Math.max(1, ...analytics.byTier.map((t) => t.count));
  const maxDept = Math.max(1, ...analytics.byDept.map((d) => d.count));

  return (
    <div className="space-y-6">
      <header className="pb-4 border-b border-[#e5e2d9]">
        <div className="section-kicker">Executive &amp; Leadership Talent Demand</div>
        <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#14171a]">
          Senior &amp; Executive Hiring Tracker
        </h1>
        <p className="mt-1 text-sm text-[#525b66]">
          Monitors C-Level, VP, Director/Head, Principal/Staff, and Senior Manager requisitions crawled across Vietnam
          job boards and direct company career portals.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="surface-card p-5">
          <h2 className="text-sm font-bold text-[#14171a] mb-3">Openings by Seniority Tier</h2>
          <div className="space-y-2.5">
            {analytics.byTier.map((t) => (
              <div key={t.seniority} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#3f4650]">{SENIORITY_LABELS[t.seniority] ?? t.seniority}</span>
                  <span className="font-mono font-semibold text-[#14171a] tabular-nums">{t.count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#efede6] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1e3a5f]"
                    style={{ width: `${Math.round((t.count / maxTier) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="text-sm font-bold text-[#14171a] mb-3">Senior Demand by Function</h2>
          <div className="space-y-2.5">
            {analytics.byDept.slice(0, 6).map((d) => (
              <div key={d.department} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#3f4650]">{d.department}</span>
                  <span className="font-mono font-semibold text-[#14171a] tabular-nums">{d.count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#efede6] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0f766e]"
                    style={{ width: `${Math.round((d.count / maxDept) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card p-5">
          <h2 className="text-sm font-bold text-[#14171a] mb-3">Most Aggressive Senior Hirers</h2>
          <div className="divide-y divide-[#efede6]">
            {analytics.topHiringCompanies.map((c) => (
              <div key={c.slug} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={`/companies/${c.slug}`}
                    className="font-semibold text-[#14171a] hover:text-[#0f766e] truncate"
                  >
                    {c.short_name}
                  </Link>
                  <SectorBadge sector={c.sector} />
                </div>
                <div className="font-mono text-right shrink-0">
                  <span className="font-bold text-[#14171a]">{c.senior_openings}</span>
                  <span className="text-[#7c8490] ml-1">({c.exec_openings} exec)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-[#7c8490] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="senior-jobs-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search role title (e.g. Head of Credit, VP, Principal, Giám đốc)..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[#d3cec2] bg-[#faf9f6] text-sm focus:outline-none focus:border-[#0f766e]"
          />
        </div>

        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
        >
          <option value="ALL">All Sectors</option>
          <option value="TECH">Tech &amp; FinTech</option>
          <option value="CFC">Consumer Finance (CFC)</option>
          <option value="BANKING">Commercial Banking</option>
        </select>

        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
        >
          <option value="ALL">All Seniority Tiers</option>
          <option value="C_LEVEL">C-Level / CXO</option>
          <option value="VP">VP / SVP</option>
          <option value="DIRECTOR_HEAD">Director / Head</option>
          <option value="PRINCIPAL_STAFF">Principal / Staff</option>
          <option value="SENIOR_MANAGER">Senior Manager / Lead</option>
        </select>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
        >
          <option value="ALL">All Functions</option>
          <option value="Engineering">Engineering</option>
          <option value="Data & AI">Data &amp; AI</option>
          <option value="Risk & Credit">Risk &amp; Credit</option>
          <option value="Digital Banking">Digital Banking</option>
          <option value="Product">Product</option>
          <option value="Operations & Collections">Operations &amp; Collections</option>
          <option value="Compliance & Legal">Compliance &amp; Legal</option>
          <option value="Sales & BD">Sales &amp; BD</option>
        </select>

        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
        >
          <option value="ALL">All Cities</option>
          <option value="Ho Chi Minh City">Ho Chi Minh City</option>
          <option value="Hanoi">Hanoi</option>
          <option value="Da Nang">Da Nang</option>
        </select>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#4e5661] cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={includeMid}
            onChange={(e) => setIncludeMid(e.target.checked)}
            className="rounded border-[#d3cec2]"
          />
          Include Senior IC &amp; Mid roles
        </label>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e5e2d9] flex items-center justify-between text-xs text-[#646d78]">
          <span>
            Showing <strong className="text-[#14171a] font-mono">{filteredJobs.length}</strong> active requisitions
          </span>
          <span>EN &amp; Vietnamese titles classified automatically</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full data-table text-sm">
            <thead>
              <tr>
                <th>Role Title</th>
                <th>Company</th>
                <th>Tier</th>
                <th>Function</th>
                <th>City</th>
                <th>Est. Monthly Band</th>
                <th>Source</th>
                <th className="text-right">Posted</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-xs text-[#7c8490]">
                    No openings match your current filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="max-w-[300px]">
                      <div className="font-semibold text-[#14171a] leading-snug">{job.title}</div>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#0f766e] hover:underline mt-0.5"
                        >
                          Career portal <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/companies/${job.company_slug}`}
                        className="font-semibold text-[#14171a] hover:text-[#0f766e] block"
                      >
                        {job.company_short_name}
                      </Link>
                      <div className="mt-0.5">
                        <SectorBadge sector={job.sector} />
                      </div>
                    </td>
                    <td>
                      <SeniorityBadge tier={job.seniority} />
                    </td>
                    <td className="text-xs text-[#3f4650]">{job.department}</td>
                    <td className="text-xs text-[#4e5661] whitespace-nowrap">{job.location}</td>
                    <td className="font-mono text-xs font-medium text-[#14171a] whitespace-nowrap">
                      {formatSalaryVnd(job.salary_min_vnd, job.salary_max_vnd)}
                    </td>
                    <td className="text-xs text-[#646d78] whitespace-nowrap">
                      {SOURCE_LABELS[job.source] ?? job.source}
                    </td>
                    <td className="text-right font-mono text-xs text-[#646d78] whitespace-nowrap">
                      {formatShortDate(job.posted_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
