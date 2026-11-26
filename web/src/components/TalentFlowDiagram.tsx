"use client";

import { useState } from "react";
import type { SectorFlowEdge } from "@/lib/types";

const SECTORS = [
  { key: "TECH", label: "Tech & FinTech", color: "#0f766e" },
  { key: "CFC", label: "Consumer Finance (CFC)", color: "#b45309" },
  { key: "BANKING", label: "Commercial Banking", color: "#1e3a5f" },
] as const;

export default function TalentFlowDiagram({ edges }: { edges: SectorFlowEdge[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const filtered = edges.filter(
    (e) => ["TECH", "CFC", "BANKING"].includes(e.from_sector) && ["TECH", "CFC", "BANKING"].includes(e.to_sector)
  );

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d3cec2] bg-[#faf9f6] p-8 text-center">
        <p className="text-sm font-semibold text-[#14171a]">No candidate transitions imported yet</p>
        <p className="mt-1 text-xs text-[#646d78] max-w-md mx-auto">
          Public Vietnam job boards do not publish individual job-change histories. Click{" "}
          <strong>Import CSV Moves</strong> to upload your LinkedIn Talent Insights exports or headhunter placement
          logs to populate the cross-sector migration matrix.
        </p>
      </div>
    );
  }

  const outTotals: Record<string, number> = { TECH: 0, CFC: 0, BANKING: 0 };
  const inTotals: Record<string, number> = { TECH: 0, CFC: 0, BANKING: 0 };
  for (const e of filtered) {
    outTotals[e.from_sector] = (outTotals[e.from_sector] || 0) + e.count;
    inTotals[e.to_sector] = (inTotals[e.to_sector] || 0) + e.count;
  }

  const grandTotal = Math.max(1, Object.values(outTotals).reduce((a, b) => a + b, 0));
  const svgW = 680;
  const svgH = 260;
  const topPad = 24;
  const gap = 18;
  const usableH = svgH - topPad * 2 - gap * 2;
  const leftX = 160;
  const rightX = 508;
  const barW = 14;

  // Compute node vertical positions on left (Outflow) and right (Inflow)
  const leftNodes: Record<string, { y: number; h: number; cursor: number; total: number; color: string; label: string }> = {};
  const rightNodes: Record<string, { y: number; h: number; cursor: number; total: number; color: string; label: string }> = {};

  let ly = topPad;
  let ry = topPad;
  for (const s of SECTORS) {
    const lh = Math.max(22, (outTotals[s.key] / grandTotal) * usableH);
    leftNodes[s.key] = { y: ly, h: lh, cursor: ly, total: outTotals[s.key], color: s.color, label: s.label };
    ly += lh + gap;

    const rh = Math.max(22, (inTotals[s.key] / grandTotal) * usableH);
    rightNodes[s.key] = { y: ry, h: rh, cursor: ry, total: inTotals[s.key], color: s.color, label: s.label };
    ry += rh + gap;
  }

  const ribbons = filtered.map((e) => {
    const src = leftNodes[e.from_sector];
    const dst = rightNodes[e.to_sector];
    const sh = (e.count / Math.max(1, src.total)) * src.h;
    const dh = (e.count / Math.max(1, dst.total)) * dst.h;
    const y0 = src.cursor;
    const y1 = src.cursor + sh;
    const ty0 = dst.cursor;
    const ty1 = dst.cursor + dh;
    src.cursor += sh;
    dst.cursor += dh;

    const x0 = leftX + barW;
    const x1 = rightX;
    const cx = (x0 + x1) / 2;
    const d = [
      `M ${x0} ${y0}`,
      `C ${cx} ${y0}, ${cx} ${ty0}, ${x1} ${ty0}`,
      `L ${x1} ${ty1}`,
      `C ${cx} ${ty1}, ${cx} ${y1}, ${x0} ${y1}`,
      "Z",
    ].join(" ");

    return {
      key: `${e.from_sector}->${e.to_sector}`,
      from: e.from_sector,
      to: e.to_sector,
      count: e.count,
      color: src.color,
      d,
    };
  });

  const activeRibbon = ribbons.find((r) => r.key === hovered);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-xs text-[#646d78]">
        <span className="font-semibold uppercase tracking-wider text-[11px]">Origin Sector (Outflow)</span>
        <span className="font-mono text-[11px] text-[#14171a] h-4">
          {activeRibbon
            ? `${activeRibbon.from} → ${activeRibbon.to}: ${activeRibbon.count} moves (${Math.round(
                (activeRibbon.count / grandTotal) * 100
              )}%)`
            : "Hover a corridor to inspect cross-sector migration"}
        </span>
        <span className="font-semibold uppercase tracking-wider text-[11px]">Destination Sector (Inflow)</span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full min-w-[540px] h-auto select-none">
          {/* Ribbons */}
          {ribbons.map((r) => {
            const isActive = hovered === r.key;
            const isDimmed = hovered !== null && !isActive;
            return (
              <path
                key={r.key}
                d={r.d}
                fill={r.color}
                fillOpacity={isActive ? 0.55 : isDimmed ? 0.08 : 0.24}
                stroke={isActive ? r.color : "none"}
                strokeWidth={isActive ? 1 : 0}
                className="transition-all duration-150 cursor-pointer"
                onMouseEnter={() => setHovered(r.key)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}

          {/* Left Bars & Labels */}
          {SECTORS.map((s) => {
            const n = leftNodes[s.key];
            return (
              <g key={`left-${s.key}`}>
                <rect x={leftX} y={n.y} width={barW} height={n.h} rx={3} fill={n.color} />
                <text
                  x={leftX - 10}
                  y={n.y + n.h / 2 - 4}
                  textAnchor="end"
                  className="fill-[#14171a] text-[12px] font-semibold"
                >
                  {s.key}
                </text>
                <text
                  x={leftX - 10}
                  y={n.y + n.h / 2 + 11}
                  textAnchor="end"
                  className="fill-[#646d78] text-[11px] font-mono"
                >
                  {n.total} out
                </text>
              </g>
            );
          })}

          {/* Right Bars & Labels */}
          {SECTORS.map((s) => {
            const n = rightNodes[s.key];
            const net = n.total - leftNodes[s.key].total;
            return (
              <g key={`right-${s.key}`}>
                <rect x={rightX} y={n.y} width={barW} height={n.h} rx={3} fill={n.color} />
                <text
                  x={rightX + barW + 10}
                  y={n.y + n.h / 2 - 4}
                  textAnchor="start"
                  className="fill-[#14171a] text-[12px] font-semibold"
                >
                  {s.key}
                </text>
                <text
                  x={rightX + barW + 10}
                  y={n.y + n.h / 2 + 11}
                  textAnchor="start"
                  className={`text-[11px] font-mono ${net >= 0 ? "fill-emerald-700" : "fill-rose-700"}`}
                >
                  {n.total} in ({net >= 0 ? `+${net}` : net})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
