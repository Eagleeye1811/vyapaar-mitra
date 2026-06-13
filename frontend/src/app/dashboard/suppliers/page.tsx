"use client";

import { Plus, Trash2, Truck } from "lucide-react";
import {
  useOps,
  type VendorRow,
} from "@/context/OpsContext";
import type { Criticality } from "@/types/assessment";
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

export default function SuppliersPage() {
  const { draft, setVendors, result } = useOps();
  const vendors = draft.vendors;
  const insights = result?.supplier_insights;

  function update(i: number, patch: Partial<VendorRow>) {
    setVendors(vendors.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setVendors(vendors.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Truck className="h-6 w-6 text-slate-400" />
          Suppliers
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Vendor performance. Scores reliability and flags single-source
          bottlenecks.
        </p>
      </header>

      <RunBar />

      <SectionCard title="Vendors" subtitle="Delivery, quality, and lead-time per vendor.">
        <div className="space-y-3">
          {vendors.map((v, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex items-center gap-2">
                <input
                  className={FIELD}
                  value={v.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Vendor name"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove vendor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <label className={LABEL}>Criticality</label>
                  <select
                    className={FIELD}
                    value={v.criticality}
                    onChange={(e) =>
                      update(i, { criticality: e.target.value as Criticality })
                    }
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>On-time (0-1)</label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1}
                    className={FIELD}
                    value={v.on_time_delivery_rate}
                    onChange={(e) =>
                      update(i, { on_time_delivery_rate: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className={LABEL}>Defect (0-1)</label>
                  <input
                    type="number"
                    step={0.01}
                    min={0}
                    max={1}
                    className={FIELD}
                    value={v.defect_rate}
                    onChange={(e) => update(i, { defect_rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className={LABEL}>Lead (days)</label>
                  <input
                    type="number"
                    min={0}
                    className={FIELD}
                    value={v.lead_time_days}
                    onChange={(e) =>
                      update(i, { lead_time_days: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={v.single_source}
                  onChange={(e) => update(i, { single_source: e.target.checked })}
                />
                Single source (no qualified backup)
              </label>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={ADD_BTN}
          onClick={() =>
            setVendors([
              ...vendors,
              {
                name: "",
                criticality: "MEDIUM",
                single_source: false,
                on_time_delivery_rate: 0.95,
                defect_rate: 0.02,
                lead_time_days: 14,
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add vendor
        </button>
      </SectionCard>

      {/* Insights */}
      {!insights ? (
        <NoRunYet />
      ) : (
        <div className="space-y-4">
          <SectionCard title="Vendor reliability scorecards">
            {insights.vendor_scorecards && insights.vendor_scorecards.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">Vendor</th>
                      <th className="pb-2">Reliability</th>
                      <th className="pb-2">On-time</th>
                      <th className="pb-2">Lead</th>
                      <th className="pb-2 text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.vendor_scorecards.map((v) => (
                      <tr key={v.name}>
                        <td className="py-2 font-medium text-slate-900">{v.name}</td>
                        <td className="py-2 text-slate-600">{v.reliability_score}/100</td>
                        <td className="py-2 text-slate-600">
                          {Math.round(v.on_time_rate * 100)}%
                        </td>
                        <td className="py-2 text-slate-600">{v.lead_time_days}d</td>
                        <td className="py-2 text-right">
                          <Badge level={v.risk_band} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No vendor data.</p>
            )}
          </SectionCard>

          <SectionCard title="Single-source bottlenecks">
            {insights.single_source_bottlenecks &&
            insights.single_source_bottlenecks.length > 0 ? (
              <div className="space-y-2">
                {insights.single_source_bottlenecks.map((b) => (
                  <div
                    key={b.name}
                    className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                      <Badge level={b.criticality} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{b.mitigation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No single-source bottlenecks.</p>
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
