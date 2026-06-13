"use client";

/**
 * Local, mock authentication context.
 *
 * Provides a small, Firebase-shaped surface (`signUp` / `signIn` / `signOut`
 * + a `user` object) backed entirely by `localStorage`. This lets the whole
 * app — protected routes, per-user run history, the API `user_id` — work today
 * without any backend auth. To go to production, swap THIS module for a real
 * Firebase Auth implementation; the rest of the app consumes only `useAuth()`
 * and never touches storage directly.
 *
 * NOTE: passwords are stored in plaintext in localStorage. This is acceptable
 * ONLY because it is a local mock — it must be replaced before any real use.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface AuthUser {
  uid: string;
  email: string;
}

interface StoredAccount extends AuthUser {
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the persisted session has been read on mount. */
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const SESSION_KEY = "vm_auth_user";
const ACCOUNTS_KEY = "vm_auth_accounts";

/**
 * A ready-made demo account, seeded on first load so anyone can sign in
 * immediately without creating an account first.
 */
export const DEMO_EMAIL = "demo@vyapaar-mitra.app";
export const DEMO_PASSWORD = "demo1234";

const AuthContext = createContext<AuthContextValue | null>(null);

// --- localStorage helpers (guarded for SSR) --------------------------------
function readAccounts(): Record<string, StoredAccount> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeAccounts(accounts: Record<string, StoredAccount>) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function newUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `uid_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore any persisted session once, on mount (client only), and make sure
  // the demo account always exists so sign-in works out of the box.
  useEffect(() => {
    try {
      const accounts = readAccounts();
      if (!accounts[DEMO_EMAIL]) {
        accounts[DEMO_EMAIL] = {
          uid: "demo-user",
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        };
        writeAccounts(accounts);
      }
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      // ignore corrupt session
    } finally {
      setLoading(false);
    }
  }, []);

  const persistSession = useCallback((next: AuthUser | null) => {
    setUser(next);
    if (next) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const signUp = useCallback(
    async (rawEmail: string, password: string) => {
      const email = normalizeEmail(rawEmail);
      if (!email || !email.includes("@")) {
        throw new Error("Please enter a valid email address.");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      const accounts = readAccounts();
      if (accounts[email]) {
        throw new Error("An account with this email already exists.");
      }
      const account: StoredAccount = { uid: newUid(), email, password };
      accounts[email] = account;
      writeAccounts(accounts);
      persistSession({ uid: account.uid, email: account.email });
    },
    [persistSession],
  );

  const signIn = useCallback(
    async (rawEmail: string, password: string) => {
      const email = normalizeEmail(rawEmail);
      const account = readAccounts()[email];
      if (!account) {
        throw new Error(
          "No account found for this email. Create an account first.",
        );
      }
      if (account.password !== password) {
        throw new Error("Incorrect password. Please try again.");
      }
      persistSession({ uid: account.uid, email: account.email });
    },
    [persistSession],
  );

  const signOut = useCallback(() => {
    persistSession(null);
  }, [persistSession]);

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return ctx;
}
