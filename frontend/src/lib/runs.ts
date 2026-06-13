/**
 * Per-user analysis run history, persisted in `localStorage`.
 *
 * Each successful `/api/analyze-operations` call is recorded here so the
 * dashboard "Simulations" page can show past runs. Storage is keyed by user
 * uid so accounts don't see each other's history. Like AuthContext, this is a
 * client-side stand-in that can later be swapped for Firestore.
 */

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

export function listRuns(uid: string): RunRecord[] {
  if (typeof window === "undefined" || !uid) return [];
  try {
    const raw = window.localStorage.getItem(keyFor(uid));
    const runs = raw ? (JSON.parse(raw) as RunRecord[]) : [];
    // Newest first.
    return runs.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveRun(
  uid: string,
  result: OperationalAnalysisResponse,
  inputSummary: RunRecord["inputSummary"],
): RunRecord {
  const record: RunRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `run_${Date.now()}`,
    createdAt: Date.now(),
    riskScore: result.risk_score,
    cashFlow: result.cash_flow_impact_prediction,
    playbookCount: result.mitigation_playbooks.length,
    inputSummary,
  };
  if (typeof window !== "undefined" && uid) {
    const existing = listRuns(uid);
    window.localStorage.setItem(
      keyFor(uid),
      JSON.stringify([record, ...existing]),
    );
  }
  return record;
}

export function clearRuns(uid: string): void {
  if (typeof window === "undefined" || !uid) return;
  window.localStorage.removeItem(keyFor(uid));
}
