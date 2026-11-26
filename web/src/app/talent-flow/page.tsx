"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { DeltaValue, SectorBadge, SeniorityBadge } from "@/components/Badges";
import ImportMovesModal from "@/components/ImportMovesModal";
import TalentFlowDiagram from "@/components/TalentFlowDiagram";
import { formatShortDate } from "@/lib/format";
import type {
  CandidateMoveRow,
  CompanyFlowEdge,
  CompanyNetFlow,
  SectorFlowEdge,
} from "@/lib/types";

interface TalentFlowResponse {
  totalMoves: number;
  seniorMoves: number;
  sectorFlows: SectorFlowEdge[];
  topCorridors: CompanyFlowEdge[];
  netFlows: CompanyNetFlow[];
  recentMoves: CandidateMoveRow[];
}

export default function TalentFlowPage() {
  const [data, setData] = useState<TalentFlowResponse | null>(null);
  const [sector, setSector] = useState("ALL");
  const [seniorOnly, setSeniorOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ sector, seniorOnly: String(seniorOnly) });
    fetch(`/api/talent-flow?${params.toString()}`)
      .then((r) => r.json())
      .then((json: TalentFlowResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sector, seniorOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const maxAbsNet = Math.max(1, ...(data?.netFlows.map((n) => Math.abs(n.net)) ?? [1]));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-[#e5e2d9]">
        <div>
          <div className="section-kicker">Candidate Inflow – Outflow &amp; Poaching Corridors</div>
          <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#14171a]">
            Talent Migration Matrix
          </h1>
          <p className="mt-1 text-sm text-[#525b66]">
            Track net candidate gains, attrition outflows, and company-to-company hiring corridors across Vietnam Tech,
            Consumer Finance, and Banking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            id="flow-sector-filter"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
          >
            <option value="ALL">All Sectors</option>
            <option value="TECH">Tech &amp; FinTech</option>
            <option value="CFC">Consumer Finance (CFC)</option>
            <option value="BANKING">Commercial Banking</option>
          </select>

          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold text-[#14171a] cursor-pointer">
            <input
              type="checkbox"
              checked={seniorOnly}
              onChange={(e) => setSeniorOnly(e.target.checked)}
              className="rounded border-[#d3cec2]"
            />
            Senior &amp; Exec Only
          </label>

          <button
            type="button"
            id="open-csv-import-btn"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#14171a] text-white text-xs font-semibold hover:bg-[#2a2f36]"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV Moves
          </button>
        </div>
      </header>

      {loading || !data ? (
        <div className="surface-card p-8 text-center text-xs text-[#7c8490]">Loading talent migration data...</div>
      ) : (
        <>
          {/* Cross-sector Sankey Diagram + Summary */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="surface-card p-5 lg:col-span-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-bold tracking-tight text-[#14171a]">
                    Cross-Sector Candidate Flow (Outflow → Inflow)
                  </h2>
                  <p className="text-xs text-[#646d78]">
                    Visualizing {data.totalMoves} tracked transitions ({data.seniorMoves} senior/leadership moves)
                  </p>
                </div>
              </div>
              <TalentFlowDiagram edges={data.sectorFlows} />
            </div>

            <div className="surface-card p-5 lg:col-span-4 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold tracking-tight text-[#14171a]">Key Migration Signals</h2>
                <p className="text-xs text-[#646d78] mb-4">Observed structural flows in Vietnam market</p>
                <ul className="space-y-3 text-xs leading-relaxed text-[#3f4650]">
                  <li className="p-3 rounded-lg bg-[#faf9f6] border border-[#e5e2d9]">
                    <span className="font-bold text-[#14171a] block mb-0.5">CFC → Tier-1 Banking &amp; Digital Banks</span>
                    Credit risk, scoring, and digital lending leaders are flowing from FE Credit, Home Credit, and
                    Lotte Finance into Techcombank, VPBank, VIB, and Cake.
                  </li>
                  <li className="p-3 rounded-lg bg-[#faf9f6] border border-[#e5e2d9]">
                    <span className="font-bold text-[#14171a] block mb-0.5">Outsourcing &amp; E-Commerce → Bank Tech Hubs</span>
                    Senior engineers from FPT Software, Shopee, and Bosch BGSV are a primary talent pipeline for NAB
                    Vietnam, Techcombank, MB Bank, and MoMo.
                  </li>
                  <li className="p-3 rounded-lg bg-[#faf9f6] border border-[#e5e2d9]">
                    <span className="font-bold text-[#14171a] block mb-0.5">Bring Your Own Talent Data</span>
                    Use <strong>Import CSV Moves</strong> to merge your headhunter logs or LinkedIn Talent Insights
                    exports directly into the migration matrix.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Net Gain/Loss Leaderboard + Top Corridors */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="surface-card overflow-hidden lg:col-span-6">
              <div className="px-5 py-4 border-b border-[#e5e2d9]">
                <h2 className="text-sm font-bold text-[#14171a]">Net Talent Gain / Loss Leaderboard</h2>
                <p className="text-xs text-[#646d78]">Ranked by Net Flow (Inflow minus Outflow)</p>
              </div>
              <div className="divide-y divide-[#efede6] max-h-[470px] overflow-y-auto">
                {data.netFlows.map((item) => {
                  const pct = Math.round((Math.abs(item.net) / maxAbsNet) * 100);
                  return (
                    <div key={item.slug} className="px-5 py-3 hover:bg-[#faf9f6] flex items-center gap-3">
                      <div className="w-36 shrink-0 min-w-0">
                        <Link
                          href={`/companies/${item.slug}`}
                          className="text-xs font-bold text-[#14171a] hover:text-[#0f766e] truncate block"
                        >
                          {item.short_name}
                        </Link>
                        <div className="text-[10px] font-mono text-[#7c8490]">
                          {item.inflow} in · {item.outflow} out
                        </div>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <div className="w-1/2 flex justify-end">
                          {item.net < 0 && (
                            <div
                              className="h-2.5 rounded-l bg-rose-600/80"
                              style={{ width: `${Math.max(8, pct)}%` }}
                            />
                          )}
                        </div>
                        <div className="w-px h-4 bg-[#d3cec2]" />
                        <div className="w-1/2 flex justify-start">
                          {item.net > 0 && (
                            <div
                              className="h-2.5 rounded-r bg-emerald-600/85"
                              style={{ width: `${Math.max(8, pct)}%` }}
                            />
                          )}
                        </div>
                      </div>

                      <div className="w-12 text-right shrink-0">
                        <DeltaValue value={item.net} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="surface-card overflow-hidden lg:col-span-6">
              <div className="px-5 py-4 border-b border-[#e5e2d9]">
                <h2 className="text-sm font-bold text-[#14171a]">Top Company-to-Company Corridors</h2>
                <p className="text-xs text-[#646d78]">Highest-volume hiring pathways between tracked employers</p>
              </div>
              <div className="overflow-x-auto max-h-[470px] overflow-y-auto">
                <table className="w-full data-table text-xs">
                  <thead>
                    <tr>
                      <th>Origin → Destination</th>
                      <th>Primary Function</th>
                      <th className="text-right">Senior</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCorridors.map((c, idx) => (
                      <tr key={`${c.from_company}-${c.to_company}-${idx}`}>
                        <td>
                          <div className="flex items-center gap-1.5 font-semibold text-[#14171a]">
                            <span>{c.from_company}</span>
                            <ArrowRight className="h-3 w-3 text-[#7c8490] shrink-0" />
                            <span className="text-[#0f766e]">{c.to_company}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <SectorBadge sector={c.from_sector} />
                            <span className="text-[10px] text-[#7c8490]">→</span>
                            <SectorBadge sector={c.to_sector} />
                          </div>
                        </td>
                        <td className="text-[#4e5661]">{c.top_department}</td>
                        <td className="text-right font-mono font-semibold text-[#14171a]">{c.senior_count}</td>
                        <td className="text-right font-mono font-bold text-[#14171a]">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Recent Transition Log */}
          <section className="surface-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#14171a]">Recent Tracked Candidate Transitions</h2>
                <p className="text-xs text-[#646d78]">Anonymized role-level movement records</p>
              </div>
              <span className="text-xs font-mono text-[#7c8490]">Showing latest {data.recentMoves.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full data-table text-xs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Role Title</th>
                    <th>Seniority</th>
                    <th>Function</th>
                    <th>City</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentMoves.slice(0, 40).map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono text-[#646d78] whitespace-nowrap">{formatShortDate(m.move_date)}</td>
                      <td className="font-semibold text-[#3f4650] whitespace-nowrap">{m.from_company_name}</td>
                      <td className="font-semibold text-[#0f766e] whitespace-nowrap">{m.to_company_name}</td>
                      <td className="font-medium text-[#14171a]">{m.role_title}</td>
                      <td>
                        <SeniorityBadge tier={m.seniority} />
                      </td>
                      <td className="text-[#4e5661]">{m.department}</td>
                      <td className="text-[#646d78] whitespace-nowrap">{m.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <ImportMovesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
      />
    </div>
  );
}
