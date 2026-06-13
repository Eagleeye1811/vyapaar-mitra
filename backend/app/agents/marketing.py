"""Marketing domain agent.

Reads ``state["raw_inputs"]["marketing"]`` and produces a structured marketing
read: campaign **ROAS anomalies** (return-on-ad-spend that has drifted from
expectation) and **customer-acquisition-cost (CAC) inflation** flags.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

from .llm import run_structured
from .state import BusinessState

# A campaign whose ROAS falls this far below its target is an anomaly.
_ROAS_ANOMALY_DROP = 0.25  # 25% below expected
# CAC growth above this fraction versus the prior period is "inflated".
_CAC_INFLATION_THRESHOLD = 0.20  # 20%


class RoasAnomaly(BaseModel):
    campaign: str = Field(description="Campaign name.")
    roas: float = Field(description="Observed return on ad spend (revenue / spend).")
    expected_roas: float = Field(description="Target/expected ROAS for this campaign.")
    deviation_pct: float = Field(
        description="Signed % deviation of observed from expected ROAS."
    )
    severity: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="HIGH if ROAS < 1 (loss-making) or far below target."
    )


class CacInflation(BaseModel):
    current_cac: float = Field(description="Current customer acquisition cost.")
    prior_cac: float = Field(description="Prior-period customer acquisition cost.")
    inflation_pct: float = Field(description="CAC change vs prior period, signed %.")
    flag: Literal["STABLE", "INFLATING", "IMPROVING"] = Field(
        description="INFLATING if CAC up materially; IMPROVING if down; else STABLE."
    )


class MarketingInsights(BaseModel):
    """Structured output schema for the marketing agent."""

    roas_anomalies: List[RoasAnomaly] = Field(
        default_factory=list, description="Campaigns whose ROAS deviates from target."
    )
    cac_inflation: CacInflation = Field(description="Acquisition-cost trend audit.")
    key_findings: List[str] = Field(
        default_factory=list,
        description="2-4 short, concrete findings about marketing efficiency.",
    )


_SYSTEM = (
    "You are a growth-marketing efficiency analyst for an SME. Given campaign "
    "spend/revenue data and acquisition costs, audit ROAS for anomalies "
    "(under-performing or loss-making campaigns) and flag CAC inflation versus "
    "the prior period. Be precise about which campaigns are bleeding budget."
)


def _offline(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic marketing computation used when no model is reachable."""
    campaigns: List[Dict[str, Any]] = raw.get("campaigns") or []

    anomalies: List[Dict[str, Any]] = []
    for c in campaigns:
        spend = float(c.get("spend", 0) or 0)
        revenue = float(c.get("revenue", 0) or 0)
        expected = float(c.get("expected_roas", c.get("target_roas", 0)) or 0)
        if spend <= 0:
            continue
        roas = round(revenue / spend, 2)
        deviation = round((roas / expected - 1) * 100, 1) if expected else 0.0

        is_anomaly = roas < 1.0 or (expected and roas < expected * (1 - _ROAS_ANOMALY_DROP))
        if not is_anomaly:
            continue
        severity = "HIGH" if roas < 1.0 else "MEDIUM" if deviation < -40 else "LOW"
        anomalies.append(
            {
                "campaign": c.get("name", "Unknown"),
                "roas": roas,
                "expected_roas": expected,
                "deviation_pct": deviation,
                "severity": severity,
            }
        )

    anomalies.sort(key=lambda a: a["roas"])

    # --- CAC inflation ----------------------------------------------------
    current_cac = float(raw.get("current_cac", 0) or 0)
    prior_cac = float(raw.get("prior_cac", 0) or 0)
    inflation_pct = (
        round((current_cac / prior_cac - 1) * 100, 1) if prior_cac else 0.0
    )
    if prior_cac and inflation_pct >= _CAC_INFLATION_THRESHOLD * 100:
        flag = "INFLATING"
    elif prior_cac and inflation_pct <= -_CAC_INFLATION_THRESHOLD * 100:
        flag = "IMPROVING"
    else:
        flag = "STABLE"

    findings: List[str] = []
    if anomalies:
        findings.append(
            f"{len(anomalies)} campaign(s) with ROAS anomalies: "
            + ", ".join(a["campaign"] for a in anomalies[:3])
            + "."
        )
    if flag == "INFLATING":
        findings.append(
            f"CAC inflating {inflation_pct}% vs prior period "
            f"({prior_cac:g} → {current_cac:g})."
        )
    if not findings:
        findings.append("Campaign ROAS on target and acquisition costs stable.")

    return {
        "roas_anomalies": anomalies,
        "cac_inflation": {
            "current_cac": current_cac,
            "prior_cac": prior_cac,
            "inflation_pct": inflation_pct,
            "flag": flag,
        },
        "key_findings": findings,
    }


async def marketing_node(state: BusinessState) -> Dict[str, Any]:
    """Graph node: analyse the marketing partition of ``raw_inputs``."""
    raw = (state.get("raw_inputs") or {}).get("marketing", {}) or {}

    insights = await run_structured(
        schema=MarketingInsights,
        system=_SYSTEM,
        human=f"Analyse this marketing data and return the structured result:\n{raw}",
        offline=lambda: _offline(raw),
    )
    return {"marketing_insights": insights}
