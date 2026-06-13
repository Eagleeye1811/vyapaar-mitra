"use client";

import Link from "next/link";
import { ArrowRight, Boxes, Megaphone, Truck, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOps } from "@/context/OpsContext";
import ResultsPanel from "@/components/ResultsPanel";
import { RunBar } from "@/components/ops-ui";

const DOMAIN_LINKS = [
  {
    href: "/dashboard/inventory",
    icon: Boxes,
    title: "Inventory",
    body: "Dead stock & stockout dates",
  },
  {
    href: "/dashboard/suppliers",
    icon: Truck,
    title: "Suppliers",
    body: "Reliability & bottlenecks",
  },
  {
    href: "/dashboard/customers",
    icon: Users,
    title: "Customers",
    body: "Concentration & LTV",
  },
  {
    href: "/dashboard/marketing",
    icon: Megaphone,
    title: "Marketing",
    body: "ROAS anomalies & CAC",
  },
];

export default function DashboardOverview() {
  const { user } = useAuth();
  const { result } = useOps();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed in as {user?.email}. Edit each domain&apos;s metrics on its
          page, then run a single analysis across all four.
        </p>
      </header>

      <RunBar />

      {result ? (
        <ResultsPanel result={result} />
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center text-sm text-slate-400">
          Run an analysis to see your operational risk score, cash-flow impact
          prediction, and mitigation playbooks.
        </p>
      )}

      {/* Domain navigation */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Domains
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOMAIN_LINKS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <d.icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-slate-500" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{d.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
