"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/format";

interface HistoryPoint {
  snapshot_week: string;
  active_jobs: number;
  senior_jobs: number;
  tech_jobs: number;
}

export default function CompanyHistoryChart({ data }: { data: HistoryPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatShortDate(d.snapshot_week),
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
          <defs>
            <linearGradient id="activeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="seniorFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece9e0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e2d9" }} />
          <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e2d9",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" iconSize={8} />
          <Area
            type="monotone"
            dataKey="active_jobs"
            name="Total Active Roles"
            stroke="#1e3a5f"
            strokeWidth={2}
            fill="url(#activeFill)"
          />
          <Area
            type="monotone"
            dataKey="senior_jobs"
            name="Senior & Leadership Roles"
            stroke="#0f766e"
            strokeWidth={2}
            fill="url(#seniorFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
