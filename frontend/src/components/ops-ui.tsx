"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, Play } from "lucide-react";
import { useOps } from "@/context/OpsContext";
import { cn } from "@/lib/utils";

// --- Form field styles, reused across all domain forms ---------------------
export const FIELD =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";
export const LABEL = "mb-1.5 block text-xs font-medium text-slate-600";
export const ADD_BTN =
  "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";

// --- Badge -----------------------------------------------------------------
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

// --- Button ----------------------------------------------------------------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-xs hover:bg-brand-700 focus-visible:ring-brand-500/30",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-400/30",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/30",
  danger:
    "border border-red-200 bg-white text-red-600 hover:bg-red-50 focus-visible:ring-red-400/30",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold outline-none transition focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// --- Page header -----------------------------------------------------------
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </header>
  );
}

// --- Section card ----------------------------------------------------------
export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card sm:p-6">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// --- Stat / KPI tile -------------------------------------------------------
type StatTone = "default" | "brand" | "success" | "warn" | "danger";

const STAT_TONES: Record<StatTone, string> = {
  default: "text-slate-900",
  brand: "text-brand-700",
  success: "text-emerald-600",
  warn: "text-amber-600",
  danger: "text-red-600",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card transition hover:shadow-card-hover">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-slate-300" />}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tracking-tight tabular-nums",
          STAT_TONES[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// --- Findings list ---------------------------------------------------------
export function Findings({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((f, i) => (
        <li key={i} className="flex gap-2.5 text-sm text-slate-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
          <span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shown on a domain page when no analysis has been run yet. */
export function NoRunYet() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <p className="text-sm text-slate-500">
        No results yet. Run an analysis to populate this domain&apos;s insights.
      </p>
      <Link
        href="/dashboard"
        className="mt-3 inline-block text-sm font-semibold text-brand-600 underline-offset-2 hover:underline"
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
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
              · risk{" "}
              <span className="font-semibold text-slate-700">
                {result.risk_score}/100
              </span>
            </span>
          ) : (
            "Analysis runs across all four domains at once."
          )}
        </div>
        <Button onClick={runAnalysis} disabled={loading}>
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
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
