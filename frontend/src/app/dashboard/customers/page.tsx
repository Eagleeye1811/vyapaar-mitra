"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { useOps, type CustomerRow } from "@/context/OpsContext";
import {
  ADD_BTN,
  Badge,
  FIELD,
  Findings,
  LABEL,
  NoRunYet,
  RunBar,
  SectionCard,
} from "@/components/ops-ui";

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function CustomersPage() {
  const { draft, setCustomers, result } = useOps();
  const c = draft.customers;
  const insights = result?.customer_insights;

  const setField = (patch: Partial<typeof c>) => setCustomers({ ...c, ...patch });

  function updateRow(i: number, patch: Partial<CustomerRow>) {
    setField({
      revenue_by_customer: c.revenue_by_customer.map((r, idx) =>
        idx === i ? { ...r, ...patch } : r,
      ),
    });
  }
  function removeRow(i: number) {
    setField({
      revenue_by_customer: c.revenue_by_customer.filter((_, idx) => idx !== i),
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Users className="h-6 w-6 text-slate-400" />
          Customers
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buyer mix and churn. Measures concentration risk and projects LTV.
        </p>
      </header>

      <RunBar />

      <SectionCard title="Customer metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className={LABEL}>Total customers</label>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={c.total_customers}
              onChange={(e) => setField({ total_customers: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={LABEL}>Churned (30d)</label>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={c.churned_last_30d}
              onChange={(e) => setField({ churned_last_30d: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={LABEL}>Churn trend ×</label>
            <input
              type="number"
              step={0.1}
              min={0}
              className={FIELD}
              value={c.churn_trend_multiplier}
              onChange={(e) =>
                setField({ churn_trend_multiplier: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={LABEL}>Avg order (₹)</label>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={c.avg_order_value}
              onChange={(e) => setField({ avg_order_value: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={LABEL}>Orders / year</label>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={c.orders_per_year}
              onChange={(e) => setField({ orders_per_year: Number(e.target.value) })}
            />
          </div>
        </div>

        <p className="mb-1 mt-4 text-xs font-medium text-slate-600">
          Revenue by customer (drives concentration risk)
        </p>
        <div className="space-y-2">
          {c.revenue_by_customer.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={FIELD}
                value={row.name}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder="Customer name"
              />
              <input
                type="number"
                min={0}
                className={`${FIELD} w-40`}
                value={row.revenue}
                onChange={(e) => updateRow(i, { revenue: Number(e.target.value) })}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove customer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={ADD_BTN}
          onClick={() =>
            setField({
              revenue_by_customer: [...c.revenue_by_customer, { name: "", revenue: 0 }],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add customer
        </button>

        <div className="mt-4">
          <label className={LABEL}>At-risk segments (comma-separated)</label>
          <input
            className={FIELD}
            value={c.at_risk_segments}
            onChange={(e) => setField({ at_risk_segments: e.target.value })}
          />
        </div>
      </SectionCard>

      {/* Insights */}
      {!insights ? (
        <NoRunYet />
      ) : (
        <div className="space-y-4">
          <SectionCard title="Buyer concentration">
            {insights.concentration ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-400">Top customer</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {insights.concentration.top_customer_share_pct}%
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Top 3 combined</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {insights.concentration.top3_share_pct}%
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">Risk band</p>
                  <Badge level={insights.concentration.risk_band} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No concentration data.</p>
            )}
          </SectionCard>

          <SectionCard title="Lifetime value outlook">
            {insights.ltv_outlook ? (
              <>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400">Current LTV</p>
                    <p className="text-xl font-bold text-slate-900">
                      ₹{money(insights.ltv_outlook.current_avg_ltv)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400">Projected LTV</p>
                    <p className="text-xl font-bold text-slate-900">
                      ₹{money(insights.ltv_outlook.projected_ltv)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400">Projected drop</p>
                    <p className="text-xl font-bold text-red-600">
                      {insights.ltv_outlook.ltv_drop_pct}%
                    </p>
                  </div>
                </div>
                {insights.ltv_outlook.drivers &&
                  insights.ltv_outlook.drivers.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <Findings items={insights.ltv_outlook.drivers} />
                    </div>
                  )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No LTV data.</p>
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
