import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const FOOTER_LINKS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/dashboard", label: "Run analysis" },
      { href: "/dashboard/simulations", label: "Simulations" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/login?mode=signup", label: "Create account" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="col-span-2 md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              Vyapaar-Mitra
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            Multi-agent operational risk analysis for small and medium
            businesses — inventory, suppliers, customers, and marketing in one
            view.
          </p>
        </div>

        {FOOTER_LINKS.map((col) => (
          <div key={col.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {col.heading}
            </h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-600 transition hover:text-slate-900"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
          © {year} Vyapaar-Mitra. Built for SME resilience.
        </div>
      </div>
    </footer>
  );
}
