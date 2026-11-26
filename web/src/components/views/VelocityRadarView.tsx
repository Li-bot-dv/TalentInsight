"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { DeltaValue, SectorBadge, VelocityBadge } from "@/components/Badges";
import { TrendSparkline } from "@/components/TrendSparkline";
import type { CompanyVelocityRow } from "@/lib/types";

type SortKey = "mom_change_pct" | "wow_change_pct" | "active_jobs" | "senior_ratio_pct" | "net_talent_flow";

export default function VelocityRadarView({
  initialCompanies,
}: {
  initialCompanies: CompanyVelocityRow[];
}) {
  const [sector, setSector] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("mom_change_pct");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialCompanies
      .filter((c) => (sector === "ALL" ? true : c.sector === sector))
      .filter((c) => (status === "ALL" ? true : c.velocity_status === status))
      .filter((c) =>
        !q
          ? true
          : c.name.toLowerCase().includes(q) ||
            c.short_name.toLowerCase().includes(q) ||
            c.sub_sector.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const diff = a[sortBy] - b[sortBy];
        return sortDir === "desc" ? -diff : diff;
      });
  }, [initialCompanies, sector, status, search, sortBy, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  const sectorScoped = useMemo(
    () => (sector === "ALL" ? initialCompanies : initialCompanies.filter((c) => c.sector === sector)),
    [initialCompanies, sector]
  );

  const surgeCount = sectorScoped.filter((c) => c.velocity_status === "SURGE").length;
  const growingCount = sectorScoped.filter((c) => c.velocity_status === "GROWING").length;
  const slowdownCount = sectorScoped.filter((c) => c.velocity_status === "SLOWDOWN").length;
  const freezeCount = sectorScoped.filter((c) => c.velocity_status === "FREEZE").length;

  return (
    <div className="space-y-6">
      <header className="pb-4 border-b border-[#e5e2d9]">
        <div className="section-kicker">Hiring Boost &amp; Contraction Monitor</div>
        <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#14171a]">
          Hiring Velocity Radar
        </h1>
        <p className="mt-1 text-sm text-[#525b66]">
          Track week-over-week and month-over-month requisition acceleration, hiring freezes, and senior hiring share
          across all tracked employers.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "SURGE", label: "Hiring Surge (≥+20%)", count: surgeCount, tone: "text-emerald-700" },
          { key: "GROWING", label: "Growing (+6% to +19%)", count: growingCount, tone: "text-teal-700" },
          { key: "SLOWDOWN", label: "Slowdown (-8% to -24%)", count: slowdownCount, tone: "text-amber-700" },
          { key: "FREEZE", label: "Contraction / Freeze", count: freezeCount, tone: "text-rose-700" },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setStatus((prev) => (prev === card.key ? "ALL" : card.key))}
            className={`surface-card p-4 text-left transition-colors ${
              status === card.key ? "ring-2 ring-[#14171a]" : "hover:bg-[#faf9f6]"
            }`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#646d78]">{card.label}</div>
            <div className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${card.tone}`}>{card.count}</div>
          </button>
        ))}
      </section>

      <section className="surface-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-[#7c8490] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="velocity-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by company name or sub-sector..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-[#d3cec2] bg-[#faf9f6] text-sm focus:outline-none focus:border-[#0f766e]"
          />
        </div>

        <select
          id="velocity-sector-filter"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold text-[#14171a]"
        >
          <option value="ALL">All Sectors</option>
          <option value="TECH">Tech &amp; FinTech</option>
          <option value="CFC">Consumer Finance (CFC)</option>
          <option value="BANKING">Commercial Banking</option>
        </select>

        <select
          id="velocity-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold text-[#14171a]"
        >
          <option value="ALL">All Statuses</option>
          <option value="SURGE">Hiring Surge</option>
          <option value="GROWING">Growing</option>
          <option value="STABLE">Stable</option>
          <option value="SLOWDOWN">Slowdown</option>
          <option value="FREEZE">Contraction / Freeze</option>
        </select>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table text-sm">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>Status</th>
                <th>8-Wk Curve</th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("active_jobs")}
                    className="inline-flex items-center gap-1 hover:text-[#14171a]"
                  >
                    Active <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("wow_change_pct")}
                    className="inline-flex items-center gap-1 hover:text-[#14171a]"
                  >
                    WoW <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("mom_change_pct")}
                    className="inline-flex items-center gap-1 hover:text-[#14171a]"
                  >
                    MoM <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("senior_ratio_pct")}
                    className="inline-flex items-center gap-1 hover:text-[#14171a]"
                  >
                    Senior % <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("net_talent_flow")}
                    className="inline-flex items-center gap-1 hover:text-[#14171a]"
                  >
                    Net Flow <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-xs text-[#7c8490]">
                    No companies match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.slug}>
                    <td>
                      <Link
                        href={`/companies/${c.slug}`}
                        className="font-semibold text-[#14171a] hover:text-[#0f766e] block"
                      >
                        {c.name}
                      </Link>
                      <span className="text-[11px] text-[#7c8490]">
                        {c.sub_sector} · {c.hq_city}
                      </span>
                    </td>
                    <td>
                      <SectorBadge sector={c.sector} />
                    </td>
                    <td>
                      <VelocityBadge status={c.velocity_status} />
                    </td>
                    <td>
                      <TrendSparkline data={c.sparkline} positive={c.mom_change_pct >= 0} />
                    </td>
                    <td className="text-right font-mono text-xs font-semibold tabular-nums">
                      {c.active_jobs}
                      <span className="block text-[10px] font-normal text-[#7c8490]">+{c.new_jobs} new</span>
                    </td>
                    <td className="text-right">
                      <DeltaValue value={c.wow_change_pct} suffix="%" />
                    </td>
                    <td className="text-right">
                      <DeltaValue value={c.mom_change_pct} suffix="%" />
                    </td>
                    <td className="text-right font-mono text-xs tabular-nums text-[#14171a]">
                      {c.senior_ratio_pct.toFixed(0)}%
                      <span className="block text-[10px] text-[#7c8490]">{c.senior_jobs} roles</span>
                    </td>
                    <td className="text-right">
                      <DeltaValue value={c.net_talent_flow} />
                      <span className="block text-[10px] font-mono text-[#7c8490]">
                        {c.inflow_count} in / {c.outflow_count} out
                      </span>
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
