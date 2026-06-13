"use client";

import { Boxes, Plus, Trash2 } from "lucide-react";
import { useOps, type SkuRow } from "@/context/OpsContext";
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

export default function InventoryPage() {
  const { draft, setSkus, result } = useOps();
  const skus = draft.skus;
  const insights = result?.inventory_insights;

  function update(i: number, patch: Partial<SkuRow>) {
    setSkus(skus.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setSkus(skus.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Boxes className="h-6 w-6 text-slate-400" />
          Inventory
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Per-SKU stock and demand. Flags dead stock and predicts stockout dates.
        </p>
      </header>

      <RunBar />

      <SectionCard title="SKUs" subtitle="On-hand units and monthly demand per SKU.">
        <div className="space-y-2">
          {skus.map((s, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                {i === 0 && <label className={LABEL}>SKU</label>}
                <input
                  className={FIELD}
                  value={s.sku}
                  onChange={(e) => update(i, { sku: e.target.value })}
                  placeholder="SKU-100"
                />
              </div>
              <div className="w-28">
                {i === 0 && <label className={LABEL}>On hand</label>}
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.on_hand}
                  onChange={(e) => update(i, { on_hand: Number(e.target.value) })}
                />
              </div>
              <div className="w-32">
                {i === 0 && <label className={LABEL}>Monthly demand</label>}
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={s.monthly_demand}
                  onChange={(e) =>
                    update(i, { monthly_demand: Number(e.target.value) })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="mb-1.5 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove SKU"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={ADD_BTN}
          onClick={() => setSkus([...skus, { sku: "", on_hand: 0, monthly_demand: 0 }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add SKU
        </button>
      </SectionCard>

      {/* Insights */}
      {!insights ? (
        <NoRunYet />
      ) : (
        <div className="space-y-4">
          <SectionCard title="Dead / slow stock">
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
                    <span className="shrink-0 text-xs text-slate-500">
                      {d.months_of_cover}m cover
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No dead stock detected.</p>
            )}
          </SectionCard>

          <SectionCard title="Stockout forecast">
            {insights.stockout_forecast && insights.stockout_forecast.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2">Days left</th>
                      <th className="pb-2">Stockout date</th>
                      <th className="pb-2 text-right">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.stockout_forecast.map((s) => (
                      <tr key={s.sku}>
                        <td className="py-2 font-medium text-slate-900">{s.sku}</td>
                        <td className="py-2 text-slate-600">{s.days_to_stockout}</td>
                        <td className="py-2 text-slate-600">{s.stockout_date}</td>
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
