/**
 * Types mirroring the backend contract in
 * `backend/app/schemas/business.py`
 * (OperationalMetricsPayload / OperationalAnalysisResponse).
 */

// --- Request: the four domain metric blocks --------------------------------

export interface SkuMetrics {
  on_hand: number;
  monthly_demand: number;
  unit_cost: number;
  unit_price: number;
  lead_time_days: number;
}

export type Criticality = "LOW" | "MEDIUM" | "HIGH";

export interface VendorMetrics {
  name: string;
  criticality: Criticality;
  single_source: boolean;
  on_time_delivery_rate: number; // 0-1
  defect_rate: number; // 0-1
  lead_time_days: number;
}

export interface CampaignMetrics {
  name: string;
  spend: number;
  revenue: number;
  expected_roas: number;
}

export interface OperationalMetricsPayload {
  user_id: string;
  session_id: string;
  inventory: {
    skus: Record<string, SkuMetrics>;
  };
  suppliers: {
    vendors: VendorMetrics[];
  };
  customers: {
    total_customers: number;
    churned_last_30d: number;
    churn_trend_multiplier: number;
    avg_order_value: number;
    orders_per_year: number;
    revenue_by_customer: Record<string, number>;
    at_risk_segments: string[];
  };
  marketing: {
    current_cac: number;
    prior_cac: number;
    campaigns: CampaignMetrics[];
  };
}

// --- Response --------------------------------------------------------------

export type Priority = "IMMEDIATE" | "SHORT_TERM" | "LONG_TERM";

export interface MitigationPlaybook {
  title: string;
  priority: Priority | string;
  action_items: string[];
  expected_impact: string;
}

// --- Per-domain insight blocks (mirror the agent output schemas) -----------

export type Severity = "LOW" | "MEDIUM" | "HIGH";

export type InventoryAction = "REORDER_NOW" | "MONITOR" | "OK" | "OVERSTOCKED";
export type AbcClass = "A" | "B" | "C";

export interface InventorySummary {
  health_score: number;
  total_inventory_value: number;
  total_capital_trapped: number;
  total_revenue_at_risk: number;
  skus_total: number;
  skus_reorder_now: number;
  skus_dead: number;
}

export interface InventoryScenario {
  name: string;
  description: string;
  urgent_stockouts: number;
  skus_needing_reorder: number;
  revenue_at_risk: number;
  delta_vs_baseline: string;
}

export interface InventoryInsights {
  summary: InventorySummary;
  dead_stock: {
    sku: string;
    on_hand: number;
    monthly_demand: number;
    months_of_cover: number;
    capital_trapped: number;
    reason: string;
  }[];
  stockout_forecast: {
    sku: string;
    days_to_stockout: number;
    stockout_date: string;
    revenue_at_risk: number;
    severity: Severity;
  }[];
  reorder_recommendations: {
    sku: string;
    on_hand: number;
    reorder_point: number;
    safety_stock: number;
    recommended_order_qty: number;
    action: InventoryAction;
    rationale: string;
  }[];
  abc_classification: {
    sku: string;
    annual_revenue: number;
    revenue_share_pct: number;
    abc_class: AbcClass;
  }[];
  scenarios: InventoryScenario[];
  key_findings: string[];
}

export interface SupplierInsights {
  vendor_scorecards: {
    name: string;
    reliability_score: number;
    on_time_rate: number;
    lead_time_days: number;
    risk_band: Severity;
  }[];
  single_source_bottlenecks: {
    name: string;
    criticality: Severity;
    mitigation: string;
  }[];
  key_findings: string[];
}

export interface CustomerInsights {
  concentration: {
    top_customer_share_pct: number;
    top3_share_pct: number;
    risk_band: Severity;
  };
  ltv_outlook: {
    current_avg_ltv: number;
    projected_ltv: number;
    ltv_drop_pct: number;
    drivers: string[];
  };
  key_findings: string[];
}

export interface MarketingInsights {
  roas_anomalies: {
    campaign: string;
    roas: number;
    expected_roas: number;
    deviation_pct: number;
    severity: Severity;
  }[];
  cac_inflation: {
    current_cac: number;
    prior_cac: number;
    inflation_pct: number;
    flag: "STABLE" | "INFLATING" | "IMPROVING";
  };
  key_findings: string[];
}

export interface OperationalAnalysisResponse {
  status: string;
  risk_score: number;
  cash_flow_impact_prediction: string;
  mitigation_playbooks: MitigationPlaybook[];
  inventory_insights: Partial<InventoryInsights>;
  supplier_insights: Partial<SupplierInsights>;
  customer_insights: Partial<CustomerInsights>;
  marketing_insights: Partial<MarketingInsights>;
}
