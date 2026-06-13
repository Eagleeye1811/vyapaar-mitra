"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";

interface ScoreGaugeProps {
  label: string;
  value: number; // 0-100
  color: string;
  caption?: string;
}

/** A circular 0-100 gauge built on recharts' RadialBarChart. */
export default function ScoreGauge({
  label,
  value,
  color,
  caption,
}: ScoreGaugeProps) {
  const data = [{ name: label, value }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: "#e2e8f0" }}
              dataKey="value"
              cornerRadius={999}
              angleAxisId={0}
              fill={color}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>
            {Math.round(value)}
          </span>
          <span className="text-xs font-medium text-slate-400">/ 100</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
      {caption && <p className="text-xs text-slate-400">{caption}</p>}
    </div>
  );
}
