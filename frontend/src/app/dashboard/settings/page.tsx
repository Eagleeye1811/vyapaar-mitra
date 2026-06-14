"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings as SettingsIcon, Trash2, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { clearRuns, listRuns } from "@/lib/runs";

const BUSINESS_KEY = "vm_business_name";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const [runCount, setRunCount] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBusinessName(window.localStorage.getItem(BUSINESS_KEY) ?? "");
    }
    let active = true;
    if (user) {
      listRuns(user.uid).then((r) => {
        if (active) setRunCount(r.length);
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    window.localStorage.setItem(BUSINESS_KEY, businessName.trim());
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2000);
  }

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  async function handleClearHistory() {
    if (!user) return;
    await clearRuns(user.uid);
    setRunCount(0);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <SettingsIcon className="h-6 w-6 text-slate-400" />
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile and account.
        </p>
      </header>

      {/* Account */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <User className="h-4 w-4 text-slate-400" />
          Account
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-400">Email</dt>
            <dd className="mt-0.5 text-sm text-slate-900">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-400">User ID</dt>
            <dd className="mt-0.5 break-all font-mono text-xs text-slate-600">
              {user?.uid}
            </dd>
          </div>
        </dl>
        <button
          onClick={handleSignOut}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>

      {/* Business profile */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Business profile</h2>
        <form onSubmit={handleSaveProfile} className="mt-4">
          <label
            htmlFor="business"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            Business name
          </label>
          <div className="flex gap-2">
            <input
              id="business"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Trading Co."
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Save
            </button>
          </div>
          {savedNote && (
            <p className="mt-2 text-xs font-medium text-emerald-600">Saved.</p>
          )}
        </form>
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-600">
          You have {runCount} saved simulation{runCount === 1 ? "" : "s"}.
          Clearing removes them permanently from this device.
        </p>
        <button
          onClick={handleClearHistory}
          disabled={runCount === 0}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Clear simulation history
        </button>
      </section>
    </div>
  );
}
