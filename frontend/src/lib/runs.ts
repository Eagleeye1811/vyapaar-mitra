/**
 * Per-user analysis run history, with two interchangeable backends.
 *
 * - **Firestore mode** (when `firebaseEnabled`): stored under
 *   `users/{uid}/runs/{id}`, so history follows the account across devices.
 * - **localStorage mode** (default): a client-side stand-in keyed by uid.
 *
 * All functions are async so callers are backend-agnostic. Each successful
 * `/api/analyze-operations` call is recorded so the "Simulations" page can
 * show past runs.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import type { OperationalAnalysisResponse } from "@/types/assessment";

export interface RunRecord {
  id: string;
  createdAt: number; // epoch ms
  riskScore: number;
  cashFlow: string;
  playbookCount: number;
  /** A few headline input figures, for context in the history list. */
  inputSummary: {
    skuCount: number;
    vendorCount: number;
    campaignCount: number;
    totalCustomers: number;
  };
}

const KEY_PREFIX = "vm_runs_";

function keyFor(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `run_${Date.now()}`;
}

// --- localStorage backend --------------------------------------------------
function listRunsLocal(uid: string): RunRecord[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(uid));
    const runs = raw ? (JSON.parse(raw) as RunRecord[]) : [];
    return runs.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// --- Public API (async, backend-agnostic) ----------------------------------
export async function listRuns(uid: string): Promise<RunRecord[]> {
  if (!uid) return [];

  if (firebaseEnabled && db) {
    try {
      const snap = await getDocs(
        query(collection(db, "users", uid, "runs"), orderBy("createdAt", "desc")),
      );
      return snap.docs.map((d) => d.data() as RunRecord);
    } catch {
      return [];
    }
  }

  return listRunsLocal(uid);
}

export async function saveRun(
  uid: string,
  result: OperationalAnalysisResponse,
  inputSummary: RunRecord["inputSummary"],
): Promise<RunRecord> {
  const record: RunRecord = {
    id: newId(),
    createdAt: Date.now(),
    riskScore: result.risk_score,
    cashFlow: result.cash_flow_impact_prediction,
    playbookCount: result.mitigation_playbooks.length,
    inputSummary,
  };

  if (!uid) return record;

  if (firebaseEnabled && db) {
    await setDoc(doc(db, "users", uid, "runs", record.id), record);
    return record;
  }

  if (typeof window !== "undefined") {
    const existing = listRunsLocal(uid);
    window.localStorage.setItem(
      keyFor(uid),
      JSON.stringify([record, ...existing]),
    );
  }
  return record;
}

export async function clearRuns(uid: string): Promise<void> {
  if (!uid) return;

  if (firebaseEnabled && db) {
    const snap = await getDocs(collection(db, "users", uid, "runs"));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(keyFor(uid));
  }
}
