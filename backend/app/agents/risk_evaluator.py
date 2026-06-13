"""Risk-evaluator agent — the orchestrator core. Runs LAST.

Ingests the four completed domain insights (inventory / supplier / customer /
marketing) and synthesises:
  * ``risk_score``                   (0-100, higher = more risk)
  * ``cash_flow_impact_prediction``  (narrative outlook on cash flow)
  * ``mitigation_playbooks``         (exactly 3 actionable playbooks)
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

from .llm import run_structured
from .state import BusinessState

# Map qualitative risk bands to a 0-100 contribution.
_BAND = {"LOW": 15, "MEDIUM": 50, "HIGH": 85}


class MitigationPlaybook(BaseModel):
    """A single distinct, actionable mitigation playbook."""

    title: str = Field(description="Short name for the playbook.")
    priority: Literal["IMMEDIATE", "SHORT_TERM", "LONG_TERM"] = Field(
        description="When this playbook should be executed."
    )
    action_items: List[str] = Field(
        description="2-4 concrete, actionable steps for this playbook."
    )
    expected_impact: str = Field(
        description="One sentence on the expected operational/financial improvement."
    )


class RiskSynthesis(BaseModel):
    """Structured output schema for the risk-evaluator agent."""

    risk_score: int = Field(description="Composite operational risk score, 0-100.")
    cash_flow_impact_prediction: str = Field(
        description="2-3 sentence narrative on the predicted cash-flow impact."
    )
    mitigation_playbooks: List[MitigationPlaybook] = Field(
        description="Exactly 3 distinct mitigation playbooks.",
        min_length=3,
        max_length=3,
    )


_SYSTEM = (
    "You are the chief operations risk evaluator for an SME platform. You are "
    "given four completed analyses (inventory, supplier, customer, marketing). "
    "Synthesise a single composite risk_score (0-100), a concrete "
    "cash_flow_impact_prediction, and EXACTLY 3 distinct, actionable mitigation "
    "playbooks. Be decisive, practical, and tie each playbook to the evidence."
)


def _offline(
    inv: Dict[str, Any],
    sup: Dict[str, Any],
    cust: Dict[str, Any],
    mkt: Dict[str, Any],
) -> Dict[str, Any]:
    """Deterministic synthesis used when no model is reachable.

    Weighted blend of the four domains into a single risk score, a cash-flow
    narrative, and three mitigation playbooks whose contents adapt to the
    dominant risks surfaced upstream.
    """
    # --- Component scores -------------------------------------------------
    stockouts = inv.get("stockout_forecast", []) or []
    urgent_stockouts = [s for s in stockouts if s.get("severity") == "HIGH"]
    dead_stock = inv.get("dead_stock", []) or []
    inventory_component = min(len(urgent_stockouts) * 25 + len(dead_stock) * 10, 100)

    bottlenecks = sup.get("single_source_bottlenecks", []) or []
    weak_vendors = [
        v for v in sup.get("vendor_scorecards", []) or [] if v.get("risk_band") == "HIGH"
    ]
    supplier_component = min(len(bottlenecks) * 30 + len(weak_vendors) * 20, 100)

    concentration = _BAND.get(
        (cust.get("concentration") or {}).get("risk_band", "MEDIUM"), 50
    )
    ltv_drop = float((cust.get("ltv_outlook") or {}).get("ltv_drop_pct", 0) or 0)
    customer_component = min(concentration + ltv_drop, 100)

    cac_flag = (mkt.get("cac_inflation") or {}).get("flag", "STABLE")
    roas_anomalies = mkt.get("roas_anomalies", []) or []
    marketing_component = min(
        (40 if cac_flag == "INFLATING" else 0) + len(roas_anomalies) * 20, 100
    )

    risk_score = int(
        max(
            0,
            min(
                100,
                round(
                    0.25 * inventory_component
                    + 0.25 * supplier_component
                    + 0.25 * customer_component
                    + 0.25 * marketing_component
                ),
            ),
        )
    )

    # --- Cash-flow narrative ---------------------------------------------
    pressures: List[str] = []
    if urgent_stockouts:
        pressures.append(
            f"{len(urgent_stockouts)} imminent stockout(s) threaten near-term revenue"
        )
    if dead_stock:
        pressures.append(f"{len(dead_stock)} dead-stock SKU(s) tie up working capital")
    if bottlenecks:
        pressures.append(
            f"{len(bottlenecks)} single-source supplier(s) risk fulfillment disruption"
        )
    if ltv_drop > 0:
        pressures.append(f"a projected {ltv_drop:g}% LTV decline erodes recurring revenue")
    if cac_flag == "INFLATING":
        pressures.append("rising CAC compresses acquisition margins")

    if pressures:
        outlook = "NEGATIVE" if risk_score >= 60 else "STRAINED"
        cash_flow = (
            f"Cash-flow outlook is {outlook} (composite risk {risk_score}/100). "
            f"Key pressures: {'; '.join(pressures[:4])}. "
            "Expect tighter liquidity over the next 1-2 quarters absent mitigation."
        )
    else:
        cash_flow = (
            f"Cash-flow outlook is STABLE (composite risk {risk_score}/100). "
            "No dominant operational drain detected across inventory, suppliers, "
            "customers, or marketing."
        )

    # --- Mitigation playbooks (exactly 3) --------------------------------
    inv_actions: List[str] = []
    if urgent_stockouts:
        inv_actions.append(
            "Expedite replenishment POs for: "
            + ", ".join(s["sku"] for s in urgent_stockouts[:3])
            + "."
        )
    if dead_stock:
        inv_actions.append(
            "Run a markdown/liquidation cycle on dead-stock SKUs to free working capital."
        )
    if not inv_actions:
        inv_actions.append("Maintain current reorder points; review cover monthly.")

    supply_actions: List[str] = []
    if bottlenecks:
        supply_actions.append(
            "Qualify a second source for: "
            + ", ".join(b["name"] for b in bottlenecks[:3])
            + "."
        )
        supply_actions.append("Hold buffer stock to cover the longest critical lead time.")
    if weak_vendors:
        supply_actions.append(
            "Put low-reliability vendors on a performance plan or replace them."
        )
    if not supply_actions:
        supply_actions.append("Continue quarterly vendor scorecard reviews.")

    demand_actions: List[str] = []
    if concentration >= 50:
        demand_actions.append("Reduce dependence on the largest account below 25% of revenue.")
    if ltv_drop > 0:
        demand_actions.append("Launch a win-back/retention program for at-risk segments.")
    if roas_anomalies or cac_flag == "INFLATING":
        demand_actions.append("Reallocate budget away from low-ROAS campaigns to curb CAC.")
    if not demand_actions:
        demand_actions.append("Sustain diversified acquisition and retention motions.")

    playbooks = [
        {
            "title": "Protect Revenue & Free Working Capital",
            "priority": "IMMEDIATE",
            "action_items": inv_actions,
            "expected_impact": "Prevents lost sales from stockouts and releases cash from dead stock.",
        },
        {
            "title": "De-risk the Supply Base",
            "priority": "SHORT_TERM",
            "action_items": supply_actions,
            "expected_impact": "Removes single-point-of-failure exposure and stabilises fulfillment.",
        },
        {
            "title": "Defend Demand & Acquisition Efficiency",
            "priority": "LONG_TERM",
            "action_items": demand_actions,
            "expected_impact": "Protects recurring revenue and restores profitable growth economics.",
        },
    ]

    return {
        "risk_score": risk_score,
        "cash_flow_impact_prediction": cash_flow,
        "mitigation_playbooks": playbooks,
    }


async def risk_evaluator_node(state: BusinessState) -> Dict[str, Any]:
    """Graph node: synthesise the four insights into the final assessment."""
    inv = state.get("inventory_insights", {}) or {}
    sup = state.get("supplier_insights", {}) or {}
    cust = state.get("customer_insights", {}) or {}
    mkt = state.get("marketing_insights", {}) or {}

    synthesis = await run_structured(
        schema=RiskSynthesis,
        system=_SYSTEM,
        human=(
            "Synthesise these four completed analyses into a final operations "
            "risk assessment.\n\n"
            f"INVENTORY:\n{inv}\n\nSUPPLIER:\n{sup}\n\n"
            f"CUSTOMER:\n{cust}\n\nMARKETING:\n{mkt}"
        ),
        offline=lambda: _offline(inv, sup, cust, mkt),
    )

    return {
        "risk_score": int(synthesis.get("risk_score", 0)),
        "cash_flow_impact_prediction": synthesis.get("cash_flow_impact_prediction", ""),
        "mitigation_playbooks": synthesis.get("mitigation_playbooks", []),
    }
