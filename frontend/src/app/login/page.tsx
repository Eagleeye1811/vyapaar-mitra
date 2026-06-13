"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, LogIn, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from "@/context/AuthContext";

const FIELD =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
const LABEL = "mb-1 block text-xs font-medium text-slate-600";

function LoginForm() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [authLoading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo() {
    setError(null);
    setMode("signin");
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  }

  const isSignup = mode === "signup";

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSignup
            ? "Start analyzing your operational risk in minutes."
            : "Sign in to run an operations analysis."}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={FIELD}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={FIELD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "At least 6 characters" : "••••••••"}
              required
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait…
            </>
          ) : isSignup ? (
            <>
              <UserPlus className="h-4 w-4" />
              Create account
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Sign in
            </>
          )}
        </button>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Just exploring? Use the demo account.
            </p>
            <button
              type="button"
              onClick={fillDemo}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Use demo
            </button>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-slate-400">
            {DEMO_EMAIL} · {DEMO_PASSWORD}
          </p>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        {isSignup ? "Already have an account?" : "New to Vyapaar-Mitra?"}{" "}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(isSignup ? "signin" : "signup");
          }}
          className="font-semibold text-slate-900 underline-offset-2 hover:underline"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md justify-center px-4 py-24">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
