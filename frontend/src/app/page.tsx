import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  LineChart,
  Megaphone,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";

const DOMAINS = [
  {
    icon: Boxes,
    title: "Inventory",
    body: "Surfaces low-turnover dead stock and predicts per-SKU stockout dates before they cost you sales.",
  },
  {
    icon: Truck,
    title: "Suppliers",
    body: "Scores vendor fulfillment reliability and flags single-source bottlenecks in your supply chain.",
  },
  {
    icon: Users,
    title: "Customers",
    body: "Quantifies buyer concentration risk and projects lifetime-value decline from churn trends.",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    body: "Audits campaign ROAS anomalies and flags customer-acquisition-cost inflation.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Enter your metrics",
    body: "Inventory, suppliers, customers, and marketing — in one form.",
  },
  {
    n: "2",
    title: "Agents analyze in parallel",
    body: "Four domain agents run concurrently, then a risk evaluator synthesizes the result.",
  },
  {
    n: "3",
    title: "Get an action plan",
    body: "A composite risk score, cash-flow prediction, and three mitigation playbooks.",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Multi-agent operations engine
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            See the operational risks before they hit your cash flow
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Vyapaar-Mitra runs your inventory, supplier, customer, and marketing
            data through specialized AI agents to produce a single risk score, a
            cash-flow impact prediction, and a concrete plan to act on.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login?mode=signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Domains */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Four domains, one risk picture
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-500">
          Each agent is an expert in its domain. They run in parallel and feed a
          single orchestrator.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DOMAINS.map((d) => (
            <div
              key={d.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                <d.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
          <h2 className="flex items-center justify-center gap-2 text-center text-2xl font-bold tracking-tight text-slate-900">
            <LineChart className="h-6 w-6 text-slate-400" />
            How it works
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
