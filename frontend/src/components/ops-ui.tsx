"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Play } from "lucide-react";
import { useOps } from "@/context/OpsContext";
import { cn } from "@/lib/utils";

// Shared input styles, reused across all domain forms.
export const FIELD =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
export const LABEL = "mb-1 block text-xs font-medium text-slate-600";
export const ADD_BTN =
  "mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50";

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  HIGH: "bg-red-50 text-red-700 ring-red-200",
  INFLATING: "bg-red-50 text-red-700 ring-red-200",
  IMPROVING: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  STABLE: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function Badge({ level }: { level: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        SEVERITY_STYLES[level] ?? "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {level}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export function Findings({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((f, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shown on a domain page when no analysis has been run yet. */
export function NoRunYet() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
      <p className="text-sm text-slate-500">
        No results yet. Run an analysis to populate this domain&apos;s insights.
      </p>
      <Link
        href="/dashboard"
        className="mt-3 inline-block text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
      >
        Go to overview →
      </Link>
    </div>
  );
}

/**
 * Reusable run control. Triggers the single combined analysis (from any page),
 * and surfaces loading / error / last-run status.
 */
export function RunBar() {
  const { runAnalysis, loading, error, lastRunAt, result } = useOps();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-500">
          {result ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Last run{" "}
              {lastRunAt
                ? new Date(lastRunAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : ""}{" "}
              · risk {result.risk_score}/100
            </span>
          ) : (
            "Analysis runs across all four domains at once."
          )}
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {result ? "Re-run analysis" : "Run analysis"}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
