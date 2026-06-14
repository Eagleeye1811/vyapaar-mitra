"use client";

/**
 * Authentication context with two interchangeable backends behind ONE surface.
 *
 * - **Firebase mode** (when `firebaseEnabled`): real Firebase Auth — sessions,
 *   sign-up/in/out via the Firebase SDK.
 * - **Mock mode** (default, no Firebase config): a `localStorage`-backed stand-in
 *   so the whole app — protected routes, per-user run history, the API `user_id`
 *   — works with zero backend auth.
 *
 * Every consumer uses only `useAuth()` and never knows which backend is active,
 * so flipping to Firebase is purely an `.env.local` change (see `lib/firebase`).
 *
 * NOTE (mock mode only): passwords are stored in plaintext in localStorage. That
 * is acceptable ONLY because it is a local mock; real credentials must use the
 * Firebase backend.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/lib/firebase";

export interface AuthUser {
  uid: string;
  email: string;
}

interface StoredAccount extends AuthUser {
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the persisted/Firebase session has been resolved on mount. */
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const SESSION_KEY = "vm_auth_user";
const ACCOUNTS_KEY = "vm_auth_accounts";

/**
 * A ready-made demo account so anyone can sign in immediately. In mock mode it
 * is seeded into localStorage; in Firebase mode it is auto-provisioned the
 * first time someone signs in with these credentials.
 */
export const DEMO_EMAIL = "demo@vyapaar-mitra.app";
export const DEMO_PASSWORD = "demo1234";

const AuthContext = createContext<AuthContextValue | null>(null);

// --- localStorage helpers (mock mode, guarded for SSR) ---------------------
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

/** Translate Firebase Auth error codes into friendly, user-facing messages. */
function firebaseAuthMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a moment.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return err instanceof Error ? err.message : "Something went wrong.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Firebase mode: subscribe to the auth session -----------------------
  useEffect(() => {
    if (!firebaseEnabled || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? { uid: fbUser.uid, email: fbUser.email ?? "" } : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- Mock mode: restore the persisted session + seed the demo account ----
  useEffect(() => {
    if (firebaseEnabled) return;
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

  const persistMockSession = useCallback((next: AuthUser | null) => {
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

      if (firebaseEnabled && auth) {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
          throw new Error(firebaseAuthMessage(err));
        }
        return; // onAuthStateChanged updates `user`
      }

      // Mock mode.
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
      persistMockSession({ uid: account.uid, email: account.email });
    },
    [persistMockSession],
  );

  const signIn = useCallback(
    async (rawEmail: string, password: string) => {
      const email = normalizeEmail(rawEmail);

      if (firebaseEnabled && auth) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
          // Auto-provision the demo account the first time it's used.
          const isDemo = email === DEMO_EMAIL && password === DEMO_PASSWORD;
          if (isDemo) {
            try {
              await createUserWithEmailAndPassword(auth, email, password);
              return;
            } catch {
              /* fall through to the original error */
            }
          }
          throw new Error(firebaseAuthMessage(err));
        }
        return;
      }

      // Mock mode.
      const account = readAccounts()[email];
      if (!account) {
        throw new Error(
          "No account found for this email. Create an account first.",
        );
      }
      if (account.password !== password) {
        throw new Error("Incorrect password. Please try again.");
      }
      persistMockSession({ uid: account.uid, email: account.email });
    },
    [persistMockSession],
  );

  const signOut = useCallback(() => {
    if (firebaseEnabled && auth) {
      void firebaseSignOut(auth);
      return;
    }
    persistMockSession(null);
  }, [persistMockSession]);

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
