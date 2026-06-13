"""Supplier domain agent.

Reads ``state["raw_inputs"]["suppliers"]`` and produces a structured vendor
read: per-vendor **fulfillment reliability scores** and **single-source supply
bottleneck** vulnerabilities.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

from .llm import run_structured
from .state import BusinessState


class VendorScorecard(BaseModel):
    name: str = Field(description="Vendor name.")
    reliability_score: int = Field(
        description="Fulfillment reliability, 0-100 (higher = more reliable)."
    )
    on_time_rate: float = Field(description="On-time delivery rate, 0-1.")
    lead_time_days: float = Field(description="Average lead time in days.")
    risk_band: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="HIGH if reliability < 60, MEDIUM if 60-79, LOW otherwise."
    )


class SingleSourceBottleneck(BaseModel):
    name: str = Field(description="Single-source vendor name.")
    criticality: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="Business criticality of the goods/services supplied."
    )
    mitigation: str = Field(description="Recommended action to de-risk this dependency.")


class SupplierInsights(BaseModel):
    """Structured output schema for the supplier agent."""

    vendor_scorecards: List[VendorScorecard] = Field(
        default_factory=list, description="Reliability scorecard per vendor."
    )
    single_source_bottlenecks: List[SingleSourceBottleneck] = Field(
        default_factory=list,
        description="Critical vendors with no qualified second source.",
    )
    key_findings: List[str] = Field(
        default_factory=list,
        description="2-4 short, concrete findings about supplier resilience.",
    )


_SYSTEM = (
    "You are a procurement and supply-chain risk analyst for an SME. Given "
    "vendor performance data, score each vendor's fulfillment reliability "
    "(0-100) and flag single-source bottlenecks where a critical input has no "
    "qualified backup. Be conservative about concentration risk."
)


def _reliability(on_time: float, defect_rate: float, lead_time: float) -> int:
    """Blend on-time rate, defect rate, and lead time into a 0-100 score."""
    score = 100.0
    score -= (1.0 - on_time) * 60.0          # punctuality is the dominant factor
    score -= defect_rate * 30.0              # quality
    score -= max(0.0, lead_time - 14) * 0.5  # long lead times erode reliability
    return int(max(0, min(100, round(score))))


def _offline(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic supplier computation used when no model is reachable."""
    vendors: List[Dict[str, Any]] = raw.get("vendors") or []

    scorecards: List[Dict[str, Any]] = []
    bottlenecks: List[Dict[str, Any]] = []

    for v in vendors:
        on_time = float(v.get("on_time_delivery_rate", v.get("on_time_rate", 1.0)) or 0)
        defect = float(v.get("defect_rate", 0) or 0)
        lead = float(v.get("lead_time_days", 0) or 0)
        score = _reliability(on_time, defect, lead)
        band = "HIGH" if score < 60 else "MEDIUM" if score < 80 else "LOW"
        scorecards.append(
            {
                "name": v.get("name", "Unknown"),
                "reliability_score": score,
                "on_time_rate": round(on_time, 2),
                "lead_time_days": lead,
                "risk_band": band,
            }
        )

        crit = str(v.get("criticality", "MEDIUM")).upper()
        if v.get("single_source") and crit in {"MEDIUM", "HIGH"}:
            bottlenecks.append(
                {
                    "name": v.get("name", "Unknown"),
                    "criticality": crit,
                    "mitigation": (
                        f"Qualify a second source and hold buffer stock; current "
                        f"lead time is {lead:g} days."
                    ),
                }
            )

    scorecards.sort(key=lambda s: s["reliability_score"])

    findings: List[str] = []
    weak = [s for s in scorecards if s["risk_band"] == "HIGH"]
    if weak:
        findings.append(
            f"{len(weak)} vendor(s) below reliability threshold: "
            + ", ".join(s["name"] for s in weak[:3])
            + "."
        )
    if bottlenecks:
        findings.append(
            f"{len(bottlenecks)} critical single-source dependency(ies): "
            + ", ".join(b["name"] for b in bottlenecks[:3])
            + "."
        )
    if not findings:
        findings.append("Vendor base is reliable and adequately diversified.")

    return {
        "vendor_scorecards": scorecards,
        "single_source_bottlenecks": bottlenecks,
        "key_findings": findings,
    }


async def supplier_node(state: BusinessState) -> Dict[str, Any]:
    """Graph node: analyse the suppliers partition of ``raw_inputs``."""
    raw = (state.get("raw_inputs") or {}).get("suppliers", {}) or {}

    insights = await run_structured(
        schema=SupplierInsights,
        system=_SYSTEM,
        human=f"Analyse this supplier data and return the structured result:\n{raw}",
        offline=lambda: _offline(raw),
    )
    return {"supplier_insights": insights}
