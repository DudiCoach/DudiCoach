"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { Progression } from "@/lib/api/progressions";

interface ProgressionChartProps {
  data: Progression[];
}

export default function ProgressionChart({ data }: ProgressionChartProps) {
  const chartData = data.map((p) => ({
    date: new Date(p.created_at).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }),
    weight: p.weight_kg,
    reps: p.reps,
    sets: p.sets,
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            stroke="#1E293B"
          />
          <YAxis
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            stroke="#1E293B"
            domain={["dataMin - 5", "dataMax + 5"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A2236",
              border: "1px solid #1E293B",
              borderRadius: "6px",
              color: "#F8FAFC",
            }}
            formatter={(value, _name, props) => {
              const numValue = typeof value === "number" ? value : parseFloat(String(value));
              const payload = props?.payload as { reps?: string | null; sets?: string | null } | undefined;
              return [
                `${numValue} kg ${payload?.sets ? `(${payload.sets}×${payload.reps})` : ""}`,
                "Ciężar",
              ];
            }}
          />
          <Bar
            dataKey="weight"
            fill="#22D3EE"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
