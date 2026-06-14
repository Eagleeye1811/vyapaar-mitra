"use client";

import { Boxes, Plus, Trash2 } from "lucide-react";
import { useOps, type SkuRow } from "@/context/OpsContext";
import {
  ADD_BTN,
  Badge,
  FIELD,
  Findings,
  NoRunYet,
  RunBar,
  SectionCard,
} from "@/components/ops-ui";
import type { InventoryAction } from "@/types/assessment";
import { cn, formatMoney, formatNumber } from "@/lib/utils";

// Column template shared by the SKU editor header + rows.
const SKU_GRID = "grid grid-cols-[1.3fr_repeat(5,minmax(0,1fr))_auto] gap-2";

const ACTION_STYLES: Record<InventoryAction, string> = {
  REORDER_NOW: "bg-red-50 text-red-700 ring-red-200",
  MONITOR: "bg-amber-50 text-amber-700 ring-amber-200",
  OK: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  OVERSTOCKED: "bg-violet-50 text-violet-700 ring-violet-200",
};

const ABC_STYLES: Record<string, string> = {
  A: "bg-slate-900 text-white ring-slate-900",
  B: "bg-slate-200 text-slate-700 ring-slate-300",
  C: "bg-slate-100 text-slate-500 ring-slate-200",
};

function ActionBadge({ action }: { action: InventoryAction }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        ACTION_STYLES[action] ?? "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {action.replace("_", " ")}
    </span>
  );
}

/** Compact headline metric tile for the KPI strip. */
function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "danger";
}) {
  const toneCls =
    tone === "danger"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold tracking-tight", toneCls)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function InventoryPage() {
  const { draft, setSkus, result } = useOps();
  const skus = draft.skus;
  const insights = result?.inventory_insights;
  const summary = insights?.summary;

  function update(i: number, patch: Partial<SkuRow>) {
    setSkus(skus.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setSkus(skus.filter((_, idx) => idx !== i));
  }

  const healthTone =
    summary && summary.health_score < 50
      ? "danger"
      : summary && summary.health_score < 75
        ? "warn"
        : "default";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Boxes className="h-6 w-6 text-slate-400" />
          Inventory
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Per-SKU stock, demand, and unit economics. Quantifies trapped capital
          and stockout risk, recommends reorders, and stress-tests scenarios.
        </p>
      </header>

      <RunBar />

      {/* KPI strip */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label="Health score"
            value={`${summary.health_score}/100`}
            hint={`${summary.skus_total} SKU(s) analysed`}
            tone={healthTone}
          />
          <Kpi
            label="Capital trapped"
            value={formatMoney(summary.total_capital_trapped)}
            hint={`${summary.skus_dead} dead/slow SKU(s)`}
            tone={summary.total_capital_trapped > 0 ? "warn" : "default"}
          />
          <Kpi
            label="Revenue at risk"
            value={formatMoney(summary.total_revenue_at_risk)}
            hint="next 30 days"
            tone={summary.total_revenue_at_risk > 0 ? "danger" : "default"}
          />
          <Kpi
            label="Reorder now"
            value={`${summary.skus_reorder_now}`}
            hint={`of ${summary.skus_total} SKU(s)`}
            tone={summary.skus_reorder_now > 0 ? "danger" : "default"}
          />
        </div>
      )}

      {/* SKU editor */}
      <SectionCard
        title="SKUs"
        subtitle="On-hand units, monthly demand, and unit economics per SKU. Cost, price, and lead time unlock the financial and reorder analysis."
      >
        <div className="overflow-x-auto">
          <div className="min-w-[680px] space-y-2">
            <div
              className={cn(
                SKU_GRID,
                "px-1 text-xs font-medium uppercase tracking-wide text-slate-400",
              )}
            >
              <span>SKU</span>
              <span>On hand</span>
              <span>Monthly demand</span>
              <span>Unit cost</span>
              <span>Unit price</span>
              <span>Lead (days)</span>
              <span className="w-9" />
            </div>

            {skus.map((s, i) => (
              <div key={i} className={cn(SKU_GRID, "items-center")}>
                <input
                  className={FIELD}
                  value={s.sku}
                  onChange={(e) => update(i, { sku: e.target.value })}
                  placeholder="SKU-100"
                />
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.on_hand}
                  onChange={(e) => update(i, { on_hand: Number(e.target.value) })}
                />
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.monthly_demand}
                  onChange={(e) =>
                    update(i, { monthly_demand: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.unit_cost}
                  onChange={(e) => update(i, { unit_cost: Number(e.target.value) })}
                />
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.unit_price}
                  onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
                />
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.lead_time_days}
                  onChange={(e) =>
                    update(i, { lead_time_days: Number(e.target.value) })
                  }
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove SKU"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={ADD_BTN}
          onClick={() =>
            setSkus([
              ...skus,
              {
                sku: "",
                on_hand: 0,
                monthly_demand: 0,
                unit_cost: 0,
                unit_price: 0,
                lead_time_days: 14,
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add SKU
        </button>
      </SectionCard>

      {/* Insights */}
      {!insights ? (
        <NoRunYet />
      ) : (
        <div className="space-y-4">
          {/* Reorder recommendations */}
          <SectionCard
            title="Reorder recommendations"
            subtitle="What to order today, with reorder point and safety stock per SKU."
          >
            {insights.reorder_recommendations &&
            insights.reorder_recommendations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2 text-right">On hand</th>
                      <th className="pb-2 text-right">Reorder pt</th>
                      <th className="pb-2 text-right">Safety</th>
                      <th className="pb-2 text-right">Order qty</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.reorder_recommendations.map((r) => (
                      <tr key={r.sku}>
                        <td className="py-2">
                          <span className="font-medium text-slate-900">{r.sku}</span>
                          <p className="text-xs text-slate-500">{r.rationale}</p>
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {formatNumber(r.on_hand)}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {formatNumber(r.reorder_point)}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {formatNumber(r.safety_stock)}
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-900">
                          {r.recommended_order_qty > 0
                            ? formatNumber(r.recommended_order_qty)
                            : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <ActionBadge action={r.action} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No reorder guidance available.</p>
            )}
          </SectionCard>

          {/* Stockout forecast */}
          <SectionCard title="Stockout forecast" subtitle="Projected stockout dates and the revenue at stake.">
            {insights.stockout_forecast && insights.stockout_forecast.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2 text-right">Days left</th>
                      <th className="pb-2">Stockout date</th>
                      <th className="pb-2 text-right">Revenue at risk</th>
                      <th className="pb-2 text-right">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.stockout_forecast.map((s) => (
                      <tr key={s.sku}>
                        <td className="py-2 font-medium text-slate-900">{s.sku}</td>
                        <td className="py-2 text-right text-slate-600">
                          {s.days_to_stockout >= 999 ? "—" : s.days_to_stockout}
                        </td>
                        <td className="py-2 text-slate-600">{s.stockout_date}</td>
                        <td className="py-2 text-right text-slate-600">
                          {s.revenue_at_risk > 0 ? formatMoney(s.revenue_at_risk) : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <Badge level={s.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No near-term stockouts.</p>
            )}
          </SectionCard>

          {/* Dead / slow stock */}
          <SectionCard title="Dead / slow stock" subtitle="Capital frozen in over-cover SKUs.">
            {insights.dead_stock && insights.dead_stock.length > 0 ? (
              <div className="space-y-2">
                {insights.dead_stock.map((d) => (
                  <div
                    key={d.sku}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{d.sku}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{d.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-amber-600">
                        {formatMoney(d.capital_trapped)}
                      </p>
                      <p className="text-xs text-slate-500">{d.months_of_cover}m cover</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No dead stock detected.</p>
            )}
          </SectionCard>

          {/* ABC classification */}
          <SectionCard
            title="ABC classification"
            subtitle="Pareto ranking by revenue contribution — focus on the A items."
          >
            {insights.abc_classification &&
            insights.abc_classification.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">Class</th>
                      <th className="pb-2">SKU</th>
                      <th className="pb-2 text-right">Annual revenue</th>
                      <th className="pb-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.abc_classification.map((a) => (
                      <tr key={a.sku}>
                        <td className="py-2">
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ring-1 ring-inset",
                              ABC_STYLES[a.abc_class] ?? ABC_STYLES.C,
                            )}
                          >
                            {a.abc_class}
                          </span>
                        </td>
                        <td className="py-2 font-medium text-slate-900">{a.sku}</td>
                        <td className="py-2 text-right text-slate-600">
                          {formatMoney(a.annual_revenue)}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {a.revenue_share_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No revenue data for ABC ranking.</p>
            )}
          </SectionCard>

          {/* What-if scenarios */}
          <SectionCard
            title="What-if scenarios"
            subtitle="How stockouts and revenue-at-risk move under demand and supply stress."
          >
            {insights.scenarios && insights.scenarios.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">Scenario</th>
                      <th className="pb-2 text-right">Urgent stockouts</th>
                      <th className="pb-2 text-right">Need reorder</th>
                      <th className="pb-2 text-right">Revenue at risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.scenarios.map((sc) => (
                      <tr key={sc.name}>
                        <td className="py-2">
                          <span className="font-medium text-slate-900">{sc.name}</span>
                          <p className="text-xs text-slate-500">{sc.description}</p>
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {sc.urgent_stockouts}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {sc.skus_needing_reorder}
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-900">
                          {formatMoney(sc.revenue_at_risk)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No scenarios available.</p>
            )}
          </SectionCard>

          {insights.key_findings && insights.key_findings.length > 0 && (
            <SectionCard title="Key findings">
              <Findings items={insights.key_findings} />
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
