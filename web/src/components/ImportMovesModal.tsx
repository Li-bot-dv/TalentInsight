"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";

const SAMPLE_CSV = `from_company,to_company,role_title,department,seniority,move_date,location,notes
FE Credit,Techcombank,Head of Credit Risk Analytics,Risk & Credit,DIRECTOR_HEAD,2026-11-18,Ho Chi Minh City,Retail credit analytics move
Shopee Vietnam,MoMo,Staff Backend Engineer,Engineering,PRINCIPAL_STAFF,2026-11-14,Ho Chi Minh City,Core payments platform
Home Credit Vietnam,VIB,VP Digital Lending Product,Product,VP,2026-11-10,Ho Chi Minh City,Digital cards & BNPL squad
FPT Software,NAB Innovation Centre Vietnam,Principal Cloud Architect,Engineering,PRINCIPAL_STAFF,2026-11-05,Ho Chi Minh City,AWS enterprise cloud team`;

export default function ImportMovesModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  if (!open) return null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setMessage(null);
  }

  async function handleSubmit() {
    if (!csv.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/import/moves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Import failed" });
      } else {
        setMessage({
          type: "ok",
          text: `Imported ${data.inserted} candidate transitions (${data.skipped} skipped).`,
        });
        onImported();
      }
    } catch {
      setMessage({ type: "err", text: "Network error while importing CSV." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-[#e5e2d9] rounded-xl shadow-xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#e5e2d9] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#14171a]">Import Candidate Inflow–Outflow CSV</h2>
            <p className="text-xs text-[#646d78] mt-0.5">
              Upload LinkedIn Talent Insights exports, headhunter trackers, or internal placement logs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#646d78] hover:bg-[#f1efe9]"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#d3cec2] bg-[#faf9f6] text-xs font-medium text-[#14171a] cursor-pointer hover:bg-[#f1efe9]">
              <Upload className="h-3.5 w-3.5" />
              <span>Choose .csv file</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
            <button
              type="button"
              onClick={() => {
                setCsv(SAMPLE_CSV);
                setMessage(null);
              }}
              className="text-xs font-medium text-[#0f766e] hover:underline"
            >
              Load Vietnam sample template
            </button>
          </div>

          <textarea
            id="csv-import-textarea"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="from_company,to_company,role_title,department,seniority,move_date,location,notes"
            className="w-full rounded-lg border border-[#d3cec2] bg-[#faf9f6] p-3 font-mono text-xs text-[#14171a] focus:outline-none focus:border-[#0f766e]"
          />

          <p className="text-[11px] text-[#646d78]">
            Required headers: <code className="font-mono">from_company</code>,{" "}
            <code className="font-mono">to_company</code>, <code className="font-mono">role_title</code>. Company
            names are automatically matched against your Vietnam Tech/CFC/Banking watchlist, and seniority/department
            are inferred automatically if omitted.
          </p>

          {message && (
            <div
              className={`rounded-lg px-3.5 py-2.5 text-xs font-medium ${
                message.type === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-[#faf9f6] border-t border-[#e5e2d9] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium text-[#4e5661] hover:bg-[#efede6]"
          >
            Close
          </button>
          <button
            type="button"
            id="submit-csv-import"
            disabled={loading || !csv.trim()}
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#14171a] text-white hover:bg-[#2a2f36] disabled:opacity-40"
          >
            {loading ? "Importing..." : "Import Transitions"}
          </button>
        </div>
      </div>
    </div>
  );
}
