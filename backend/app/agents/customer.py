"""Customer domain agent.

Reads ``state["raw_inputs"]["customers"]`` and produces a structured customer
read: **buyer concentration risk** (over-reliance on a few accounts) and a
predicted **customer lifetime value (LTV) drop**.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

from .llm import run_structured
from .state import BusinessState


class ConcentrationRisk(BaseModel):
    top_customer_share_pct: float = Field(
        description="Largest single customer's share of revenue, 0-100."
    )
    top3_share_pct: float = Field(
        description="Combined share of the top 3 customers, 0-100."
    )
    risk_band: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="HIGH if top customer > 35% or top3 > 65%; MEDIUM if elevated."
    )


class LTVOutlook(BaseModel):
    current_avg_ltv: float = Field(description="Current average customer LTV.")
    projected_ltv: float = Field(description="Projected LTV after churn pressure.")
    ltv_drop_pct: float = Field(description="Projected LTV decline, 0-100.")
    drivers: List[str] = Field(
        default_factory=list, description="Key drivers of the projected LTV change."
    )


class CustomerInsights(BaseModel):
    """Structured output schema for the customer agent."""

    concentration: ConcentrationRisk = Field(description="Buyer concentration analysis.")
    ltv_outlook: LTVOutlook = Field(description="Lifetime-value projection.")
    key_findings: List[str] = Field(
        default_factory=list,
        description="2-4 short, concrete findings about the customer base.",
    )


_SYSTEM = (
    "You are a revenue and retention analyst for an SME. Given the customer "
    "base, compute buyer concentration risk (over-reliance on a few accounts) "
    "and predict the direction and magnitude of customer lifetime-value (LTV) "
    "change given churn trends. Be concrete about which accounts drive risk."
)


def _offline(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic customer computation used when no model is reachable."""
    revenue_by: Dict[str, float] = {
        k: float(v or 0) for k, v in (raw.get("revenue_by_customer") or {}).items()
    }
    total = sum(revenue_by.values()) or 1.0
    ranked = sorted(revenue_by.values(), reverse=True)

    top_share = round((ranked[0] / total) * 100, 1) if ranked else 0.0
    top3_share = round((sum(ranked[:3]) / total) * 100, 1) if ranked else 0.0

    if top_share > 35 or top3_share > 65:
        band = "HIGH"
    elif top_share > 20 or top3_share > 50:
        band = "MEDIUM"
    else:
        band = "LOW"

    # --- LTV outlook ------------------------------------------------------
    total_customers = float(raw.get("total_customers", 0) or 0)
    churned = float(raw.get("churned_last_30d", 0) or 0)
    trend = float(raw.get("churn_trend_multiplier", 1.0) or 1.0)
    base_churn = (churned / total_customers) if total_customers else 0.0
    projected_churn = min(base_churn * trend, 0.95)

    avg_order = float(raw.get("avg_order_value", 0) or 0)
    orders_year = float(raw.get("orders_per_year", 0) or 0)
    # LTV ≈ annual value / churn (expected customer lifetime in years = 1/churn).
    annual_value = avg_order * orders_year
    current_ltv = round(annual_value / base_churn, 2) if base_churn else annual_value
    projected_ltv = (
        round(annual_value / projected_churn, 2) if projected_churn else annual_value
    )
    drop_pct = (
        round((1 - projected_ltv / current_ltv) * 100, 1) if current_ltv else 0.0
    )

    drivers: List[str] = []
    if trend > 1.0:
        drivers.append(f"Churn trending up {round((trend - 1) * 100)}% month-over-month.")
    for seg in (raw.get("at_risk_segments") or [])[:3]:
        drivers.append(f"At-risk segment: {seg}.")
    if not drivers:
        drivers.append("Churn stable; LTV broadly flat.")

    findings: List[str] = []
    if band != "LOW":
        findings.append(
            f"Buyer concentration {band}: top account {top_share}% of revenue, "
            f"top 3 {top3_share}%."
        )
    if drop_pct > 0:
        findings.append(f"Projected LTV decline of {drop_pct}% under current churn trend.")
    if not findings:
        findings.append("Diversified base with stable lifetime value.")

    return {
        "concentration": {
            "top_customer_share_pct": top_share,
            "top3_share_pct": top3_share,
            "risk_band": band,
        },
        "ltv_outlook": {
            "current_avg_ltv": current_ltv,
            "projected_ltv": projected_ltv,
            "ltv_drop_pct": max(0.0, drop_pct),
            "drivers": drivers,
        },
        "key_findings": findings,
    }


async def customer_node(state: BusinessState) -> Dict[str, Any]:
    """Graph node: analyse the customers partition of ``raw_inputs``."""
    raw = (state.get("raw_inputs") or {}).get("customers", {}) or {}

    insights = await run_structured(
        schema=CustomerInsights,
        system=_SYSTEM,
        human=f"Analyse this customer data and return the structured result:\n{raw}",
        offline=lambda: _offline(raw),
    )
    return {"customer_insights": insights}
