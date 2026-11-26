"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { SectorBadge } from "@/components/Badges";
import { SOURCE_LABELS } from "@/lib/format";
import type { CompanyVelocityRow, CrawlRunRow, Sector } from "@/lib/types";

export interface CrawlerStatusDataset {
  runs: CrawlRunRow[];
  sourceCounts: Array<{ source: string; active_jobs: number; last_seen: string }>;
  companies: CompanyVelocityRow[];
}

const CRAWLER_SOURCES = [
  { key: "topdev", name: "TopDev Vietnam", desc: "Public VN tech job board API (v2)" },
  { key: "vietnamworks", name: "VietnamWorks", desc: "Major VN banking, CFC & tech job board" },
  { key: "itviec", name: "ITviec", desc: "Senior Vietnam engineering & product listings" },
  { key: "careerviet", name: "CareerViet", desc: "Commercial banking & consumer finance listings" },
  { key: "company_ats", name: "Company Career Sites / ATS", desc: "Greenhouse, Lever & JSON-LD career portals" },
  { key: "vn_news_rss", name: "VN Finance & Tech RSS", desc: "VnExpress & CafeF company movement detector" },
];

export default function CrawlersView({
  initialData,
}: {
  initialData: CrawlerStatusDataset;
}) {
  const router = useRouter();
  const [data, setData] = useState<CrawlerStatusDataset>(initialData);
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [crawlNotice, setCrawlNotice] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [sector, setSector] = useState<Sector>("TECH");
  const [subSector, setSubSector] = useState("");
  const [hqCity, setHqCity] = useState("Ho Chi Minh City");
  const [careersUrl, setCareersUrl] = useState("");
  const [atsType, setAtsType] = useState("custom");
  const [formErr, setFormErr] = useState<string | null>(null);

  async function triggerCrawl(sourceKey: string) {
    setRunningSource(sourceKey);
    setCrawlNotice(null);
    try {
      const res = await fetch("/api/crawlers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceKey, limit: 5 }),
      });
      const json = await res.json();
      if (json.status) setData(json.status);
      if (!res.ok) {
        setCrawlNotice(`Crawl warning (${sourceKey}): ${json.error}`);
      } else {
        const first = Array.isArray(json.results) ? json.results[0] : null;
        setCrawlNotice(
          first
            ? `${SOURCE_LABELS[sourceKey] ?? sourceKey}: ${first.status} — scanned ${first.companies_scanned} companies, found ${first.jobs_found} jobs, ${first.movements_found} news movements${
                first.error ? ` (${first.error})` : ""
              }.`
            : `Completed crawl for ${sourceKey}.`
        );
      }
      router.refresh();
    } catch {
      setCrawlNotice("Failed to invoke crawler endpoint.");
    } finally {
      setRunningSource(null);
    }
  }

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        short_name: shortName || name,
        sector,
        sub_sector: subSector,
        hq_city: hqCity,
        careers_url: careersUrl,
        ats_type: atsType,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFormErr(json.error || "Could not add company");
      return;
    }
    setName("");
    setShortName("");
    setSubSector("");
    setCareersUrl("");
    setShowAdd(false);
    router.refresh();
  }

  async function handleDeleteCompany(slug: string, displayName: string) {
    if (!confirm(`Remove ${displayName} from your Vietnam watchlist?`)) return;
    await fetch(`/api/companies/${slug}`, { method: "DELETE" });
    setData((prev) => ({
      ...prev,
      companies: prev.companies.filter((c) => c.slug !== slug),
    }));
    router.refresh();
  }

  const countsMap = new Map((data.sourceCounts || []).map((s) => [s.source, s]));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-[#e5e2d9]">
        <div>
          <div className="section-kicker">Data Pipeline &amp; Employer Universe</div>
          <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#14171a]">
            Watchlist &amp; Crawler Operations
          </h1>
          <p className="mt-1 text-sm text-[#525b66]">
            Manage tracked Vietnam Tech/CFC/Banking employers, trigger live crawlers, and monitor source health and
            anti-bot status transparently.
          </p>
        </div>

        <button
          type="button"
          id="add-company-toggle-btn"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#14171a] text-white text-xs font-semibold hover:bg-[#2a2f36] self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Employer to Watchlist
        </button>
      </header>

      {crawlNotice && (
        <div className="rounded-lg border border-[#d3cec2] bg-white px-4 py-3 text-xs font-medium text-[#14171a]">
          {crawlNotice}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAddCompany} className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#14171a]">Add Company to Vietnam Watchlist</h2>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-[#646d78]">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Company Name (e.g. Timo Digital Bank)"
              className="px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
            />
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Short Name (e.g. Timo)"
              className="px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
            />
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value as Sector)}
              className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-sm"
            >
              <option value="TECH">Tech &amp; FinTech</option>
              <option value="CFC">Consumer Finance (CFC)</option>
              <option value="BANKING">Commercial Banking</option>
            </select>
            <input
              value={subSector}
              onChange={(e) => setSubSector(e.target.value)}
              placeholder="Sub-sector (e.g. Digital Bank)"
              className="px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
            />
            <input
              value={careersUrl}
              onChange={(e) => setCareersUrl(e.target.value)}
              placeholder="Careers URL (https://...)"
              className="px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
            />
            <div className="flex gap-2">
              <select
                value={hqCity}
                onChange={(e) => setHqCity(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-sm"
              >
                <option value="Ho Chi Minh City">Ho Chi Minh City</option>
                <option value="Hanoi">Hanoi</option>
                <option value="Da Nang">Da Nang</option>
              </select>
              <select
                value={atsType}
                onChange={(e) => setAtsType(e.target.value)}
                className="px-2.5 py-2 rounded-md border border-[#d3cec2] bg-white text-xs"
              >
                <option value="custom">Custom HTML</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
              </select>
            </div>
          </div>
          {formErr && <p className="text-xs text-rose-700">{formErr}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md bg-[#0f766e] text-white text-xs font-semibold hover:bg-[#0d625b]"
            >
              Save to Watchlist
            </button>
          </div>
        </form>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CRAWLER_SOURCES.map((src) => {
          const stat = countsMap.get(src.key);
          const isRunning = runningSource === src.key;
          return (
            <div key={src.key} className="surface-card p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-[#14171a]">{src.name}</h2>
                  <span className="font-mono text-xs font-semibold text-[#0f766e]">
                    {src.key === "vn_news_rss" ? "RSS Feed" : `${stat?.active_jobs ?? 0} active`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#646d78]">{src.desc}</p>
              </div>
              <button
                type="button"
                disabled={runningSource !== null}
                onClick={() => triggerCrawl(src.key)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[#d3cec2] bg-[#faf9f6] text-xs font-semibold text-[#14171a] hover:bg-[#efede6] disabled:opacity-50"
              >
                {isRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? "Crawling (5-company sample)..." : "Run Live Crawl"}
              </button>
            </div>
          );
        })}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e2d9]">
          <h2 className="text-sm font-bold text-[#14171a]">Recent Crawl Execution Log</h2>
          <p className="text-xs text-[#646d78]">
            Respects polite rate limits; anti-bot/CAPTCHA gates are reported transparently without bypass attempts.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table text-xs">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th className="text-right">Companies</th>
                <th className="text-right">Jobs Found</th>
                <th className="text-right">New Inserted</th>
                <th className="text-right">Movements</th>
                <th>Notes</th>
                <th className="text-right">Started</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold text-[#14171a]">{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        r.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-800"
                          : r.status === "PARTIAL"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-rose-50 text-rose-800"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-right font-mono">{r.companies_scanned}</td>
                  <td className="text-right font-mono">{r.jobs_found}</td>
                  <td className="text-right font-mono">{r.jobs_inserted}</td>
                  <td className="text-right font-mono">{r.movements_found}</td>
                  <td className="text-[#646d78] max-w-[260px] truncate">{r.error_message || "—"}</td>
                  <td className="text-right font-mono text-[#646d78] whitespace-nowrap">
                    {r.started_at?.slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#14171a]">
              Tracked Vietnam Watchlist ({data.companies.length} Employers)
            </h2>
            <p className="text-xs text-[#646d78]">Tech, Consumer Finance (CFC), and Commercial Banking targets</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full data-table text-xs">
            <thead>
              <tr>
                <th>Company</th>
                <th>Sector</th>
                <th>HQ City</th>
                <th>Careers Portal</th>
                <th className="text-right">Active Jobs</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <tr key={c.slug}>
                  <td>
                    <Link href={`/companies/${c.slug}`} className="font-semibold text-[#14171a] hover:text-[#0f766e]">
                      {c.name}
                    </Link>
                    <div className="text-[11px] text-[#7c8490]">{c.sub_sector}</div>
                  </td>
                  <td>
                    <SectorBadge sector={c.sector} />
                  </td>
                  <td className="text-[#4e5661]">{c.hq_city}</td>
                  <td className="max-w-[220px] truncate">
                    {c.careers_url ? (
                      <a
                        href={c.careers_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0f766e] hover:underline"
                      >
                        {c.careers_url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-[#7c8490]">—</span>
                    )}
                  </td>
                  <td className="text-right font-mono font-semibold">{c.active_jobs}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteCompany(c.slug, c.short_name)}
                      className="p-1.5 rounded text-[#7c8490] hover:text-rose-700 hover:bg-rose-50"
                      title={`Remove ${c.short_name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
