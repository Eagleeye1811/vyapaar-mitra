"use client";

import { Clock, ListChecks, Target, TrendingUp, Wallet } from "lucide-react";
import type {
  MitigationPlaybook,
  OperationalAnalysisResponse,
} from "@/types/assessment";
import { cn } from "@/lib/utils";
import ScoreGauge from "./ScoreGauge";

function riskColor(score: number): string {
  if (score >= 67) return "#ef4444"; // red
  if (score >= 34) return "#f59e0b"; // amber
  return "#22c55e"; // green
}

function riskLabel(score: number): string {
  if (score >= 67) return "High risk";
  if (score >= 34) return "Moderate risk";
  return "Low risk";
}

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  IMMEDIATE: { label: "Immediate", className: "bg-red-50 text-red-700 ring-red-200" },
  SHORT_TERM: { label: "Short term", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  LONG_TERM: { label: "Long term", className: "bg-sky-50 text-sky-700 ring-sky-200" },
};

function PlaybookCard({
  playbook,
  index,
}: {
  playbook: MitigationPlaybook;
  index: number;
}) {
  const priority = PRIORITY_STYLES[playbook.priority] ?? {
    label: String(playbook.priority),
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {index + 1}
          </span>
          <h4 className="font-semibold text-slate-900">{playbook.title}</h4>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
            priority.className,
          )}
        >
          <Clock className="h-3 w-3" />
          {priority.label}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {playbook.action_items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-600">
            <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {playbook.expected_impact && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>{playbook.expected_impact}</span>
        </p>
      )}
    </div>
  );
}

export default function ResultsPanel({
  result,
}: {
  result: OperationalAnalysisResponse;
}) {
  const { risk_score, cash_flow_impact_prediction, mitigation_playbooks } = result;

  return (
    <section className="space-y-6">
      {/* Score + cash-flow summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]">
          <ScoreGauge
            label="Operational risk"
            value={risk_score}
            color={riskColor(risk_score)}
            caption={riskLabel(risk_score)}
          />
          <div className="rounded-xl bg-slate-50 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wallet className="h-4 w-4 text-slate-500" />
              Cash-flow impact prediction
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {cash_flow_impact_prediction || "No prediction returned."}
            </p>
          </div>
        </div>
      </div>

      {/* Mitigation playbooks */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <TrendingUp className="h-5 w-5 text-slate-500" />
          Mitigation playbooks
        </h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {mitigation_playbooks.map((p, i) => (
            <PlaybookCard key={i} playbook={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
