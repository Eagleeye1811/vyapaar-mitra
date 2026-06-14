"use client";

/**
 * Shared operations state for the dashboard.
 *
 * Holds the editable per-domain metrics "draft" (so the inventory / suppliers /
 * customers / marketing pages all edit one shared dataset), plus the result of
 * the last combined analysis. A single `runAnalysis()` builds the payload from
 * the draft, calls the backend once, stores the full result (synthesis + every
 * domain's insights), and records it in run history. Each domain page then
 * renders its own slice of `result`.
 *
 * Draft + last result are persisted in localStorage, keyed by user uid, so they
 * survive navigation between domain pages and page reloads.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, analyzeOperations } from "@/lib/api";
import { saveRun } from "@/lib/runs";
import { useAuth } from "@/context/AuthContext";
import type {
  Criticality,
  OperationalAnalysisResponse,
  OperationalMetricsPayload,
} from "@/types/assessment";

// --- Editable draft shapes -------------------------------------------------
export interface SkuRow {
  sku: string;
  on_hand: number;
  monthly_demand: number;
  unit_cost: number;
  unit_price: number;
  lead_time_days: number;
}
export interface VendorRow {
  name: string;
  criticality: Criticality;
  single_source: boolean;
  on_time_delivery_rate: number;
  defect_rate: number;
  lead_time_days: number;
}
export interface CustomerRow {
  name: string;
  revenue: number;
}
export interface CampaignRow {
  name: string;
  spend: number;
  revenue: number;
  expected_roas: number;
}
export interface CustomersDraft {
  total_customers: number;
  churned_last_30d: number;
  churn_trend_multiplier: number;
  avg_order_value: number;
  orders_per_year: number;
  revenue_by_customer: CustomerRow[];
  at_risk_segments: string; // comma-separated in the form
}
export interface MarketingDraft {
  current_cac: number;
  prior_cac: number;
  campaigns: CampaignRow[];
}
export interface MetricsDraft {
  skus: SkuRow[];
  vendors: VendorRow[];
  customers: CustomersDraft;
  marketing: MarketingDraft;
}

// --- Defaults (mirror the backend example) ---------------------------------
const DEFAULT_DRAFT: MetricsDraft = {
  skus: [
    { sku: "SKU-300", on_hand: 40, monthly_demand: 220, unit_cost: 200, unit_price: 480, lead_time_days: 30 },
    { sku: "SKU-100", on_hand: 90, monthly_demand: 300, unit_cost: 120, unit_price: 320, lead_time_days: 21 },
    { sku: "SKU-400", on_hand: 5000, monthly_demand: 50, unit_cost: 35, unit_price: 90, lead_time_days: 10 },
  ],
  vendors: [
    {
      name: "PrimePack Materials",
      criticality: "HIGH",
      single_source: true,
      on_time_delivery_rate: 0.82,
      defect_rate: 0.06,
      lead_time_days: 45,
    },
    {
      name: "SwiftLogistics",
      criticality: "HIGH",
      single_source: false,
      on_time_delivery_rate: 0.97,
      defect_rate: 0.01,
      lead_time_days: 7,
    },
  ],
  customers: {
    total_customers: 240,
    churned_last_30d: 18,
    churn_trend_multiplier: 1.4,
    avg_order_value: 3200,
    orders_per_year: 6,
    revenue_by_customer: [
      { name: "Acme Retail", revenue: 1_900_000 },
      { name: "Globex Stores", revenue: 620_000 },
      { name: "Long tail (others)", revenue: 1_050_000 },
    ],
    at_risk_segments: "SMB monthly plans, Trial conversions",
  },
  marketing: {
    current_cac: 1450,
    prior_cac: 1100,
    campaigns: [
      { name: "Meta-Prospecting", spend: 200_000, revenue: 160_000, expected_roas: 2.5 },
      { name: "Retargeting", spend: 60_000, revenue: 300_000, expected_roas: 5.0 },
    ],
  },
};

interface OpsContextValue {
  draft: MetricsDraft;
  setSkus: (skus: SkuRow[]) => void;
  setVendors: (vendors: VendorRow[]) => void;
  setCustomers: (customers: CustomersDraft) => void;
  setMarketing: (marketing: MarketingDraft) => void;
  resetDraft: () => void;
  result: OperationalAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  lastRunAt: number | null;
  runAnalysis: () => Promise<void>;
}

const OpsContext = createContext<OpsContextValue | null>(null);

/**
 * Backfill SKU fields added after a draft may have been persisted (unit_cost,
 * unit_price, lead_time_days), so older stored drafts stay valid controlled
 * inputs instead of becoming `undefined`/NaN.
 */
function normalizeDraft(draft: MetricsDraft): MetricsDraft {
  return {
    ...draft,
    skus: (draft.skus ?? []).map((s) => ({
      sku: s.sku ?? "",
      on_hand: s.on_hand ?? 0,
      monthly_demand: s.monthly_demand ?? 0,
      unit_cost: s.unit_cost ?? 0,
      unit_price: s.unit_price ?? 0,
      lead_time_days: s.lead_time_days ?? 0,
    })),
  };
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}`;
}

export function OpsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<MetricsDraft>(DEFAULT_DRAFT);
  const [result, setResult] = useState<OperationalAnalysisResponse | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftKey = user ? `vm_draft_${user.uid}` : null;
  const resultKey = user ? `vm_lastresult_${user.uid}` : null;

  // Hydrate draft + last result from storage for the signed-in user.
  useEffect(() => {
    if (!draftKey || !resultKey) return;
    try {
      const d = window.localStorage.getItem(draftKey);
      setDraft(d ? normalizeDraft(JSON.parse(d) as MetricsDraft) : DEFAULT_DRAFT);
      const r = window.localStorage.getItem(resultKey);
      if (r) {
        const parsed = JSON.parse(r) as {
          result: OperationalAnalysisResponse;
          at: number;
        };
        setResult(parsed.result);
        setLastRunAt(parsed.at);
      } else {
        setResult(null);
        setLastRunAt(null);
      }
    } catch {
      setDraft(DEFAULT_DRAFT);
    }
  }, [draftKey, resultKey]);

  // Persist draft on change.
  useEffect(() => {
    if (draftKey) window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey]);

  const setSkus = useCallback(
    (skus: SkuRow[]) => setDraft((d) => ({ ...d, skus })),
    [],
  );
  const setVendors = useCallback(
    (vendors: VendorRow[]) => setDraft((d) => ({ ...d, vendors })),
    [],
  );
  const setCustomers = useCallback(
    (customers: CustomersDraft) => setDraft((d) => ({ ...d, customers })),
    [],
  );
  const setMarketing = useCallback(
    (marketing: MarketingDraft) => setDraft((d) => ({ ...d, marketing })),
    [],
  );
  const resetDraft = useCallback(() => setDraft(DEFAULT_DRAFT), []);

  const runAnalysis = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const c = draft.customers;
    const payload: OperationalMetricsPayload = {
      user_id: user.uid,
      session_id: newSessionId(),
      inventory: {
        skus: Object.fromEntries(
          draft.skus
            .filter((s) => s.sku.trim())
            .map((s) => [
              s.sku.trim(),
              {
                on_hand: s.on_hand,
                monthly_demand: s.monthly_demand,
                unit_cost: s.unit_cost,
                unit_price: s.unit_price,
                lead_time_days: s.lead_time_days,
              },
            ]),
        ),
      },
      suppliers: { vendors: draft.vendors },
      customers: {
        total_customers: c.total_customers,
        churned_last_30d: c.churned_last_30d,
        churn_trend_multiplier: c.churn_trend_multiplier,
        avg_order_value: c.avg_order_value,
        orders_per_year: c.orders_per_year,
        revenue_by_customer: Object.fromEntries(
          c.revenue_by_customer
            .filter((r) => r.name.trim())
            .map((r) => [r.name.trim(), r.revenue]),
        ),
        at_risk_segments: c.at_risk_segments
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      },
      marketing: {
        current_cac: draft.marketing.current_cac,
        prior_cac: draft.marketing.prior_cac,
        campaigns: draft.marketing.campaigns,
      },
    };

    try {
      const data = await analyzeOperations(payload);
      const at = Date.now();
      setResult(data);
      setLastRunAt(at);
      if (resultKey) {
        window.localStorage.setItem(
          resultKey,
          JSON.stringify({ result: data, at }),
        );
      }
      await saveRun(user.uid, data, {
        skuCount: Object.keys(payload.inventory.skus).length,
        vendorCount: payload.suppliers.vendors.length,
        campaignCount: payload.marketing.campaigns.length,
        totalCustomers: payload.customers.total_customers,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [draft, user, resultKey]);

  const value = useMemo(
    () => ({
      draft,
      setSkus,
      setVendors,
      setCustomers,
      setMarketing,
      resetDraft,
      result,
      loading,
      error,
      lastRunAt,
      runAnalysis,
    }),
    [
      draft,
      setSkus,
      setVendors,
      setCustomers,
      setMarketing,
      resetDraft,
      result,
      loading,
      error,
      lastRunAt,
      runAnalysis,
    ],
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps(): OpsContextValue {
  const ctx = useContext(OpsContext);
  if (!ctx) throw new Error("useOps must be used within an <OpsProvider>.");
  return ctx;
}
