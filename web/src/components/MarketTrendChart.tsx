"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/format";
import type { WeeklySectorTrend } from "@/lib/types";

export default function MarketTrendChart({ data }: { data: WeeklySectorTrend[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatShortDate(d.week),
  }));

  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ece9e0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e2d9" }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e5e2d9",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(20, 23, 26, 0.08)",
              fontSize: "12px",
            }}
            labelStyle={{ fontWeight: 600, color: "#14171a", marginBottom: "4px" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            iconType="circle"
            iconSize={8}
          />
          <Line
            type="monotone"
            dataKey="TECH"
            name="Tech & FinTech"
            stroke="#0f766e"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="BANKING"
            name="Commercial Banking"
            stroke="#1e3a5f"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="CFC"
            name="Consumer Finance (CFC)"
            stroke="#b45309"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
