"use client";

import { Megaphone, Plus, Trash2 } from "lucide-react";
import { useOps, type CampaignRow } from "@/context/OpsContext";
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

export default function MarketingPage() {
  const { draft, setMarketing, result } = useOps();
  const m = draft.marketing;
  const insights = result?.marketing_insights;

  const setField = (patch: Partial<typeof m>) => setMarketing({ ...m, ...patch });

  function updateRow(i: number, patch: Partial<CampaignRow>) {
    setField({
      campaigns: m.campaigns.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });
  }
  function removeRow(i: number) {
    setField({ campaigns: m.campaigns.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Megaphone className="h-6 w-6 text-slate-400" />
          Marketing
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Campaign spend and acquisition cost. Audits ROAS and flags CAC inflation.
        </p>
      </header>

      <RunBar />

      <SectionCard title="Marketing metrics">
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <div>
            <label className={LABEL}>Current CAC (₹)</label>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={m.current_cac}
              onChange={(e) => setField({ current_cac: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={LABEL}>Prior CAC (₹)</label>
            <input
              type="number"
              min={0}
              className={FIELD}
              value={m.prior_cac}
              onChange={(e) => setField({ prior_cac: Number(e.target.value) })}
            />
          </div>
        </div>

        <p className="mb-1 mt-4 text-xs font-medium text-slate-600">Campaigns</p>
        <div className="space-y-2">
          {m.campaigns.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                {i === 0 && <label className={LABEL}>Name</label>}
                <input
                  className={FIELD}
                  value={c.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  placeholder="Campaign"
                />
              </div>
              <div className="w-28">
                {i === 0 && <label className={LABEL}>Spend</label>}
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={c.spend}
                  onChange={(e) => updateRow(i, { spend: Number(e.target.value) })}
                />
              </div>
              <div className="w-28">
                {i === 0 && <label className={LABEL}>Revenue</label>}
                <input
                  type="number"
                  min={0}
                  className={FIELD}
                  value={c.revenue}
                  onChange={(e) => updateRow(i, { revenue: Number(e.target.value) })}
                />
              </div>
              <div className="w-28">
                {i === 0 && <label className={LABEL}>Target ROAS</label>}
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  className={FIELD}
                  value={c.expected_roas}
                  onChange={(e) =>
                    updateRow(i, { expected_roas: Number(e.target.value) })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="mb-1.5 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove campaign"
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
              campaigns: [
                ...m.campaigns,
                { name: "", spend: 0, revenue: 0, expected_roas: 2.0 },
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add campaign
        </button>
      </SectionCard>

      {/* Insights */}
      {!insights ? (
        <NoRunYet />
      ) : (
        <div className="space-y-4">
          <SectionCard title="CAC inflation">
            {insights.cac_inflation ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-400">Prior → Current</p>
                  <p className="text-xl font-bold text-slate-900">
                    ₹{insights.cac_inflation.prior_cac} → ₹
                    {insights.cac_inflation.current_cac}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400">Change</p>
                  <p className="text-xl font-bold text-slate-900">
                    {insights.cac_inflation.inflation_pct}%
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">Status</p>
                  <Badge level={insights.cac_inflation.flag} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No CAC data.</p>
            )}
          </SectionCard>

          <SectionCard title="ROAS anomalies">
            {insights.roas_anomalies && insights.roas_anomalies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="pb-2">Campaign</th>
                      <th className="pb-2">ROAS</th>
                      <th className="pb-2">Target</th>
                      <th className="pb-2">Deviation</th>
                      <th className="pb-2 text-right">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {insights.roas_anomalies.map((a) => (
                      <tr key={a.campaign}>
                        <td className="py-2 font-medium text-slate-900">{a.campaign}</td>
                        <td className="py-2 text-slate-600">{a.roas}×</td>
                        <td className="py-2 text-slate-600">{a.expected_roas}×</td>
                        <td className="py-2 text-slate-600">{a.deviation_pct}%</td>
                        <td className="py-2 text-right">
                          <Badge level={a.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No ROAS anomalies — campaigns on target.</p>
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
