"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, SlidersHorizontal, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { clearRuns, listRuns, type RunRecord } from "@/lib/runs";

function riskColor(score: number): string {
  if (score >= 67) return "bg-red-50 text-red-700 ring-red-200";
  if (score >= 34) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SimulationsPage() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<RunRecord[]>([]);

  useEffect(() => {
    if (user) setRuns(listRuns(user.uid));
  }, [user]);

  function handleClear() {
    if (!user) return;
    clearRuns(user.uid);
    setRuns([]);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <History className="h-6 w-6 text-slate-400" />
            Simulations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your past operations analyses, newest first.
          </p>
        </div>
        {runs.length > 0 && (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Clear history
          </button>
        )}
      </header>

      {runs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
          <p className="text-sm text-slate-500">No simulations yet.</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Run your first analysis
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    {formatDate(r.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{r.inputSummary.skuCount} SKUs</span>
                    <span>{r.inputSummary.vendorCount} vendors</span>
                    <span>{r.inputSummary.totalCustomers} customers</span>
                    <span>{r.inputSummary.campaignCount} campaigns</span>
                    <span>{r.playbookCount} playbooks</span>
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${riskColor(
                    r.riskScore,
                  )}`}
                >
                  Risk {r.riskScore}/100
                </span>
              </div>
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {r.cashFlow}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
