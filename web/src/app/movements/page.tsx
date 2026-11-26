"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, Search, X } from "lucide-react";
import { CategoryBadge, ImpactBadge, SectorBadge } from "@/components/Badges";
import { formatShortDate } from "@/lib/format";
import type { CompanyMovementRow, CompanyVelocityRow } from "@/lib/types";

export default function CompanyMovementsPage() {
  const [movements, setMovements] = useState<CompanyMovementRow[]>([]);
  const [companies, setCompanies] = useState<CompanyVelocityRow[]>([]);
  const [sector, setSector] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [impact, setImpact] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form state for adding an analyst movement note
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [formCategory, setFormCategory] = useState("LEADERSHIP");
  const [formImpact, setFormImpact] = useState("POSITIVE");
  const [sourceName, setSourceName] = useState("Analyst Field Intel");
  const [saving, setSaving] = useState(false);

  const loadMovements = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ sector, category, impact, search });
    fetch(`/api/movements?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        setMovements(json.movements || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sector, category, impact, search]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((json) => {
        const list = json.companies || [];
        setCompanies(list);
        if (list.length > 0) setCompanyId(String(list[0].id));
      })
      .catch(() => {});
  }, []);

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !title.trim() || !summary.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: Number(companyId),
          title,
          summary,
          category: formCategory,
          impact: formImpact,
          source_name: sourceName,
        }),
      });
      if (res.ok) {
        setTitle("");
        setSummary("");
        setShowModal(false);
        loadMovements();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-4 border-b border-[#e5e2d9]">
        <div>
          <div className="section-kicker">Organizational &amp; Strategic Signals</div>
          <h1 className="mt-1 text-2xl sm:text-[28px] font-bold tracking-[-0.025em] text-[#14171a]">
            Company Movement Feed
          </h1>
          <p className="mt-1 text-sm text-[#525b66]">
            Executive appointments, new Vietnam tech hubs, restructuring/layoffs, M&amp;A transitions, and hiring
            drives across your watchlist.
          </p>
        </div>

        <button
          type="button"
          id="log-movement-btn"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#14171a] text-white text-xs font-semibold hover:bg-[#2a2f36] self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Log Market Intel
        </button>
      </header>

      {/* Filters */}
      <section className="surface-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-[#7c8490] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, leadership move, restructuring, M&A..."
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
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
        >
          <option value="ALL">All Categories</option>
          <option value="LEADERSHIP">Leadership Move</option>
          <option value="EXPANSION">Hub &amp; Expansion</option>
          <option value="HIRING_DRIVE">Hiring Drive</option>
          <option value="RESTRUCTURING">Restructuring</option>
          <option value="M_AND_A">M&amp;A / Strategic</option>
          <option value="PRODUCT_TECH">Tech &amp; Product</option>
        </select>

        <select
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          className="px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-xs font-semibold"
        >
          <option value="ALL">All Polarities</option>
          <option value="POSITIVE">Expansionary</option>
          <option value="NEGATIVE">Contractionary</option>
          <option value="NEUTRAL">Structural</option>
        </select>
      </section>

      {/* Feed Cards */}
      <section className="space-y-3">
        {loading ? (
          <div className="surface-card p-8 text-center text-xs text-[#7c8490]">Loading movement signals...</div>
        ) : movements.length === 0 ? (
          <div className="surface-card p-8 text-center text-xs text-[#7c8490]">
            No company movements match the selected filters.
          </div>
        ) : (
          movements.map((m) => (
            <article key={m.id} className="surface-card p-5 hover:border-[#d3cec2] transition-colors">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Link
                  href={`/companies/${m.company_slug}`}
                  className="text-sm font-bold text-[#14171a] hover:text-[#0f766e]"
                >
                  {m.company_name}
                </Link>
                <SectorBadge sector={m.sector} />
                <CategoryBadge category={m.category} />
                <ImpactBadge impact={m.impact} />
                <span className="ml-auto font-mono text-xs text-[#7c8490]">{formatShortDate(m.event_date)}</span>
              </div>

              <h2 className="text-base font-bold text-[#14171a] leading-snug">{m.title}</h2>
              <p className="mt-1.5 text-sm text-[#4e5661] leading-relaxed">{m.summary}</p>

              <div className="mt-3 pt-2.5 border-t border-[#efede6] flex items-center justify-between text-xs text-[#7c8490]">
                <span>Source: {m.source_name}</span>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/companies/${m.company_slug}`}
                    className="font-semibold text-[#0f766e] hover:underline"
                  >
                    Company Deep-Dive →
                  </Link>
                  {m.source_url && (
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-[#14171a]"
                    >
                      Reference <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Log Movement Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <form
            onSubmit={handleSaveNote}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-[#e5e2d9] rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#14171a]">Log Company Movement Signal</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-[#646d78]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3f4650] mb-1">Company</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-sm"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.sector})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4650] mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-sm"
                  >
                    <option value="LEADERSHIP">Leadership Move</option>
                    <option value="EXPANSION">Hub &amp; Expansion</option>
                    <option value="HIRING_DRIVE">Hiring Drive</option>
                    <option value="RESTRUCTURING">Restructuring</option>
                    <option value="M_AND_A">M&amp;A / Strategic</option>
                    <option value="PRODUCT_TECH">Tech &amp; Product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4650] mb-1">Hiring Impact</label>
                  <select
                    value={formImpact}
                    onChange={(e) => setFormImpact(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#d3cec2] bg-white text-sm"
                  >
                    <option value="POSITIVE">Expansionary</option>
                    <option value="NEGATIVE">Contractionary</option>
                    <option value="NEUTRAL">Structural</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3f4650] mb-1">Headline</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Techcombank opens new Data Science squad in Da Nang"
                  className="w-full px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3f4650] mb-1">Summary / Context</label>
                <textarea
                  required
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Key details on team size, leadership sponsor, or hiring implications..."
                  className="w-full px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3f4650] mb-1">Source</label>
                <input
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#d3cec2] text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-3.5 bg-[#faf9f6] border-t border-[#e5e2d9] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 rounded-md text-xs font-medium text-[#4e5661]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#14171a] text-white hover:bg-[#2a2f36]"
              >
                {saving ? "Saving..." : "Save Intelligence"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
