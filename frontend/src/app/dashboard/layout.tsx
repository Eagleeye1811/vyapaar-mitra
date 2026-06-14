"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Gauge,
  History,
  Loader2,
  Megaphone,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { OpsProvider } from "@/context/OpsContext";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
  { href: "/dashboard/simulations", label: "Simulations", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Protected-route guard: bounce unauthenticated visitors to /login.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <OpsProvider>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Sub-navigation — segmented pill nav */}
        <nav className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 p-1.5 shadow-card backdrop-blur">
          {TABS.map((t) => {
            const active =
              t.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </OpsProvider>
  );
}
