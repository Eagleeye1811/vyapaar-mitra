"""Inventory domain agent.

Reads ``state["raw_inputs"]["inventory"]`` and produces a structured,
decision-grade inventory read. Beyond simply *describing* stock, it quantifies
the money at stake and tells the owner what to do next:

* **Dead / slow stock** — capital trapped in over-cover SKUs (in currency).
* **Stockout forecast** — per-SKU stockout date, severity, and revenue at risk.
* **Reorder recommendations** — reorder point, safety stock, and order quantity
  per SKU (the "what should I do today" layer).
* **ABC classification** — Pareto ranking so the owner focuses on the vital few.
* **Health score** — a single 0-100 read on inventory resilience.
* **What-if scenarios** — how stockouts and revenue-at-risk move under a demand
  surge, a supplier delay, or both (a scoped slice of scenario simulation).

Per-SKU inputs: ``on_hand``, ``monthly_demand``, and (optionally, unlocking the
financial + reorder layers) ``unit_cost``, ``unit_price``, ``lead_time_days``.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

from .llm import run_structured
from .state import BusinessState

# --- Tunable thresholds -----------------------------------------------------
# A SKU with more than this many months of cover (and live demand) is "slow";
# zero-demand stock on hand is dead outright.
_SLOW_COVER_MONTHS = 6.0
# A "healthy" cover level; stock above this on a slow mover counts as trapped.
_HEALTHY_COVER_MONTHS = 2.0
# Cap forecast horizon so "never stocks out" stays sortable/serialisable.
_HORIZON_CAP_DAYS = 999
# Window over which we count lost sales as near-term "revenue at risk".
_RISK_HORIZON_DAYS = 30
# Safety stock = this fraction of lead-time demand (buffer for spikes/delays).
_SAFETY_FACTOR = 0.5
# Default lead time when a SKU omits it (days).
_DEFAULT_LEAD_TIME_DAYS = 14.0


# --- Output schema ----------------------------------------------------------
class DeadStockItem(BaseModel):
    sku: str = Field(description="SKU identifier.")
    on_hand: float = Field(description="Units currently on hand.")
    monthly_demand: float = Field(description="Observed monthly unit demand.")
    months_of_cover: float = Field(
        description="on_hand / monthly_demand; high values indicate dead stock."
    )
    capital_trapped: float = Field(
        description="Currency value of excess units above a healthy cover level."
    )
    reason: str = Field(description="Why this SKU is flagged as dead/slow stock.")


class StockoutForecast(BaseModel):
    sku: str = Field(description="SKU identifier.")
    days_to_stockout: int = Field(
        description="Projected days until on-hand hits zero at current demand."
    )
    stockout_date: str = Field(description="Projected stockout date (ISO YYYY-MM-DD).")
    revenue_at_risk: float = Field(
        description="Lost-sales value over the next 30 days if not replenished."
    )
    severity: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="HIGH if < 14 days, MEDIUM if 14-30, LOW otherwise."
    )


class ReorderRecommendation(BaseModel):
    sku: str = Field(description="SKU identifier.")
    on_hand: float = Field(description="Units currently on hand.")
    reorder_point: float = Field(
        description="Stock level at which a new order must be placed."
    )
    safety_stock: float = Field(description="Buffer units for demand/lead-time variance.")
    recommended_order_qty: float = Field(
        description="Units to order now (0 if no order needed)."
    )
    action: Literal["REORDER_NOW", "MONITOR", "OK", "OVERSTOCKED"] = Field(
        description="Recommended inventory action for this SKU."
    )
    rationale: str = Field(description="One-line justification for the action.")


class AbcClass(BaseModel):
    sku: str = Field(description="SKU identifier.")
    annual_revenue: float = Field(description="Annualised revenue contribution.")
    revenue_share_pct: float = Field(description="Share of total revenue, 0-100.")
    abc_class: Literal["A", "B", "C"] = Field(
        description="A = vital few (~top 80% of revenue), B next, C the long tail."
    )


class InventoryScenario(BaseModel):
    name: str = Field(description="Scenario label.")
    description: str = Field(description="What this scenario stresses.")
    urgent_stockouts: int = Field(description="SKUs stocking out within 14 days.")
    skus_needing_reorder: int = Field(description="SKUs at/below their reorder point.")
    revenue_at_risk: float = Field(description="Total near-term lost-sales value.")
    delta_vs_baseline: str = Field(description="How this differs from the baseline.")


class InventorySummary(BaseModel):
    health_score: int = Field(description="Inventory resilience, 0-100 (higher = better).")
    total_inventory_value: float = Field(description="On-hand units valued at cost.")
    total_capital_trapped: float = Field(description="Capital frozen in dead/slow stock.")
    total_revenue_at_risk: float = Field(description="Near-term lost-sales value at risk.")
    skus_total: int = Field(description="Number of SKUs analysed.")
    skus_reorder_now: int = Field(description="SKUs that need an order placed today.")
    skus_dead: int = Field(description="SKUs flagged as dead/slow stock.")


class InventoryInsights(BaseModel):
    """Structured output schema for the inventory agent."""

    summary: InventorySummary = Field(description="Headline inventory KPIs.")
    dead_stock: List[DeadStockItem] = Field(
        default_factory=list, description="Low-turnover / dead-stock SKUs."
    )
    stockout_forecast: List[StockoutForecast] = Field(
        default_factory=list, description="Per-SKU stockout-date predictions."
    )
    reorder_recommendations: List[ReorderRecommendation] = Field(
        default_factory=list, description="Per-SKU reorder guidance."
    )
    abc_classification: List[AbcClass] = Field(
        default_factory=list, description="Pareto ABC ranking of SKUs by revenue."
    )
    scenarios: List[InventoryScenario] = Field(
        default_factory=list, description="What-if stress scenarios vs the baseline."
    )
    key_findings: List[str] = Field(
        default_factory=list,
        description="2-4 short, concrete findings about inventory health.",
    )


_SYSTEM = (
    "You are a supply-and-inventory analyst for an SME. Given per-SKU on-hand, "
    "demand, unit cost/price, and lead-time data, quantify the money at stake "
    "and recommend action: flag dead stock with the capital it traps, predict "
    "stockout dates with the revenue at risk, compute reorder points / safety "
    "stock / order quantities, rank SKUs by ABC revenue contribution, score "
    "overall inventory health (0-100), and stress-test demand-surge and "
    "supplier-delay scenarios. Be precise, decisive, and money-aware."
)


# --- Offline deterministic engine ------------------------------------------
def _sku_fields(data: Dict[str, Any]) -> Dict[str, float]:
    """Coerce one SKU's raw record into numeric fields with sane defaults."""
    data = data or {}
    return {
        "on_hand": float(data.get("on_hand", 0) or 0),
        "monthly_demand": float(data.get("monthly_demand", 0) or 0),
        "unit_cost": float(data.get("unit_cost", 0) or 0),
        "unit_price": float(data.get("unit_price", 0) or 0),
        "lead_time_days": float(
            data.get("lead_time_days", _DEFAULT_LEAD_TIME_DAYS) or _DEFAULT_LEAD_TIME_DAYS
        ),
    }


def _scenario_aggregate(
    skus: Dict[str, Any], demand_mult: float, lead_add: float
) -> Dict[str, float]:
    """Aggregate stockout/reorder/risk metrics under a demand & lead-time stress.

    Pure and side-effect free so it can be reused for the baseline and every
    what-if scenario without duplicating the per-SKU math.
    """
    urgent = 0
    reorder = 0
    revenue_at_risk = 0.0

    for _sku, raw in skus.items():
        f = _sku_fields(raw)
        demand = f["monthly_demand"] * demand_mult
        on_hand = f["on_hand"]
        lead = f["lead_time_days"] + lead_add
        if demand <= 0:
            continue

        daily = demand / 30.0
        days = min(int(round(on_hand / daily)), _HORIZON_CAP_DAYS)
        if days < 14:
            urgent += 1
        if days < _RISK_HORIZON_DAYS:
            unmet = daily * (_RISK_HORIZON_DAYS - days)
            revenue_at_risk += unmet * f["unit_price"]

        safety = daily * lead * _SAFETY_FACTOR
        reorder_point = daily * lead + safety
        if on_hand <= reorder_point:
            reorder += 1

    return {
        "urgent_stockouts": urgent,
        "skus_needing_reorder": reorder,
        "revenue_at_risk": round(revenue_at_risk, 2),
    }


def _offline(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic inventory computation used when no model is reachable."""
    skus: Dict[str, Any] = raw.get("skus") or raw.get("inventory") or {}
    as_of = date.today()

    dead_stock: List[Dict[str, Any]] = []
    stockout: List[Dict[str, Any]] = []
    reorders: List[Dict[str, Any]] = []
    abc_rows: List[Dict[str, Any]] = []

    total_inventory_value = 0.0
    total_capital_trapped = 0.0
    total_revenue_at_risk = 0.0

    for sku, data in skus.items():
        f = _sku_fields(data)
        on_hand = f["on_hand"]
        demand = f["monthly_demand"]
        unit_cost = f["unit_cost"]
        unit_price = f["unit_price"]
        lead = f["lead_time_days"]

        total_inventory_value += on_hand * unit_cost
        daily = demand / 30.0 if demand > 0 else 0.0
        months_cover = round(on_hand / demand, 1) if demand > 0 else _HORIZON_CAP_DAYS / 30.0

        # --- Reorder math (needs live demand) ----------------------------
        safety_stock = round(daily * lead * _SAFETY_FACTOR) if demand > 0 else 0
        reorder_point = round(daily * lead + safety_stock) if demand > 0 else 0
        order_up_to = reorder_point + demand  # +1 review cycle of cover
        recommended_qty = 0

        # --- Dead / slow stock + trapped capital -------------------------
        if demand <= 0 and on_hand > 0:
            trapped = round(on_hand * unit_cost, 2)
            total_capital_trapped += trapped
            dead_stock.append(
                {
                    "sku": sku,
                    "on_hand": on_hand,
                    "monthly_demand": demand,
                    "months_of_cover": round(months_cover, 1),
                    "capital_trapped": trapped,
                    "reason": "No observed demand — capital fully tied up.",
                }
            )
            action, rationale = "OVERSTOCKED", "No demand; liquidate rather than reorder."
        elif months_cover > _SLOW_COVER_MONTHS:
            excess_units = max(0.0, on_hand - demand * _HEALTHY_COVER_MONTHS)
            trapped = round(excess_units * unit_cost, 2)
            total_capital_trapped += trapped
            dead_stock.append(
                {
                    "sku": sku,
                    "on_hand": on_hand,
                    "monthly_demand": demand,
                    "months_of_cover": months_cover,
                    "capital_trapped": trapped,
                    "reason": f"{months_cover:g} months of cover exceeds the "
                    f"{_SLOW_COVER_MONTHS:g}-month slow-mover threshold.",
                }
            )
            action, rationale = (
                "OVERSTOCKED",
                f"{months_cover:g}m cover; hold off ordering and run down stock.",
            )
        elif demand > 0 and on_hand <= reorder_point:
            recommended_qty = max(0, round(order_up_to - on_hand))
            action = "REORDER_NOW"
            rationale = (
                f"On-hand {on_hand:g} at/below reorder point {reorder_point:g} "
                f"(lead {lead:g}d)."
            )
        elif demand > 0 and on_hand <= reorder_point * 1.25:
            action, rationale = "MONITOR", "Approaching reorder point; watch closely."
        else:
            action, rationale = "OK", "Cover and reorder position are healthy."

        # --- Stockout forecast + revenue at risk -------------------------
        if demand > 0:
            days = min(int(round(on_hand / daily)), _HORIZON_CAP_DAYS)
            severity = "HIGH" if days < 14 else "MEDIUM" if days <= 30 else "LOW"
            rev_risk = 0.0
            if days < _RISK_HORIZON_DAYS:
                unmet = daily * (_RISK_HORIZON_DAYS - days)
                rev_risk = round(unmet * unit_price, 2)
                total_revenue_at_risk += rev_risk
            stockout.append(
                {
                    "sku": sku,
                    "days_to_stockout": days,
                    "stockout_date": (as_of + timedelta(days=days)).isoformat(),
                    "revenue_at_risk": rev_risk,
                    "severity": severity,
                }
            )

        reorders.append(
            {
                "sku": sku,
                "on_hand": on_hand,
                "reorder_point": float(reorder_point),
                "safety_stock": float(safety_stock),
                "recommended_order_qty": float(recommended_qty),
                "action": action,
                "rationale": rationale,
            }
        )

        # --- ABC contribution (monthly revenue velocity) -----------------
        abc_rows.append(
            {
                "sku": sku,
                "_contribution": demand * unit_price,
                "annual_revenue": round(demand * unit_price * 12, 2),
            }
        )

    # --- ABC classification (Pareto over contribution) -------------------
    total_contribution = sum(r["_contribution"] for r in abc_rows) or 1.0
    abc_rows.sort(key=lambda r: r["_contribution"], reverse=True)
    cumulative = 0.0
    abc_classification: List[Dict[str, Any]] = []
    for r in abc_rows:
        share = r["_contribution"] / total_contribution
        cumulative += share
        cls = "A" if cumulative <= 0.80 else "B" if cumulative <= 0.95 else "C"
        abc_classification.append(
            {
                "sku": r["sku"],
                "annual_revenue": r["annual_revenue"],
                "revenue_share_pct": round(share * 100, 1),
                "abc_class": cls,
            }
        )

    stockout.sort(key=lambda s: s["days_to_stockout"])
    reorders.sort(key=lambda r: (r["action"] != "REORDER_NOW", r["sku"]))
    dead_stock.sort(key=lambda d: d["capital_trapped"], reverse=True)

    # --- Health score (0-100, higher = healthier) ------------------------
    high_count = sum(1 for s in stockout if s["severity"] == "HIGH")
    medium_count = sum(1 for s in stockout if s["severity"] == "MEDIUM")
    trapped_ratio = total_capital_trapped / max(total_inventory_value, 1.0)
    trapped_penalty = min(35, round(trapped_ratio * 70))
    high_penalty = min(40, high_count * 12)
    medium_penalty = min(15, medium_count * 5)
    health_score = int(max(0, 100 - trapped_penalty - high_penalty - medium_penalty))

    skus_reorder_now = sum(1 for r in reorders if r["action"] == "REORDER_NOW")

    summary = {
        "health_score": health_score,
        "total_inventory_value": round(total_inventory_value, 2),
        "total_capital_trapped": round(total_capital_trapped, 2),
        "total_revenue_at_risk": round(total_revenue_at_risk, 2),
        "skus_total": len(skus),
        "skus_reorder_now": skus_reorder_now,
        "skus_dead": len(dead_stock),
    }

    # --- What-if scenarios ----------------------------------------------
    baseline = _scenario_aggregate(skus, 1.0, 0.0)

    def _delta(agg: Dict[str, float]) -> str:
        d_rev = agg["revenue_at_risk"] - baseline["revenue_at_risk"]
        d_urgent = agg["urgent_stockouts"] - baseline["urgent_stockouts"]
        rev_dir = "+" if d_rev >= 0 else "-"
        return (
            f"{d_urgent:+d} urgent stockout(s), "
            f"{rev_dir}{abs(round(d_rev)):,} revenue at risk vs baseline."
        )

    surge = _scenario_aggregate(skus, 1.2, 0.0)
    delay = _scenario_aggregate(skus, 1.0, 14.0)
    combined = _scenario_aggregate(skus, 1.2, 14.0)

    scenarios = [
        {
            "name": "Baseline",
            "description": "Current demand and lead times.",
            **baseline,
            "delta_vs_baseline": "Reference scenario.",
        },
        {
            "name": "Demand surge +20%",
            "description": "Peak-season demand 20% above current.",
            **surge,
            "delta_vs_baseline": _delta(surge),
        },
        {
            "name": "Supplier delay +14 days",
            "description": "Lead times slip by two weeks across the board.",
            **delay,
            "delta_vs_baseline": _delta(delay),
        },
        {
            "name": "Combined stress",
            "description": "Demand +20% and lead times +14 days together.",
            **combined,
            "delta_vs_baseline": _delta(combined),
        },
    ]

    # --- Key findings ----------------------------------------------------
    findings: List[str] = []
    findings.append(
        f"Inventory health {health_score}/100 across {len(skus)} SKU(s)."
    )
    urgent = [s for s in stockout if s["severity"] == "HIGH"]
    if urgent:
        findings.append(
            f"{len(urgent)} SKU(s) stock out within 14 days "
            f"(~{round(total_revenue_at_risk):,} revenue at risk): "
            + ", ".join(s["sku"] for s in urgent[:3])
            + "."
        )
    if total_capital_trapped > 0:
        findings.append(
            f"~{round(total_capital_trapped):,} of capital trapped in "
            f"{len(dead_stock)} dead/slow SKU(s) — review for markdown."
        )
    if skus_reorder_now:
        findings.append(
            f"{skus_reorder_now} SKU(s) at/below reorder point — place orders today."
        )
    if len(findings) == 1:
        findings.append("Inventory turnover, cover, and reorder positions are healthy.")

    return {
        "summary": summary,
        "dead_stock": dead_stock,
        "stockout_forecast": stockout,
        "reorder_recommendations": reorders,
        "abc_classification": abc_classification,
        "scenarios": scenarios,
        "key_findings": findings,
    }


async def inventory_node(state: BusinessState) -> Dict[str, Any]:
    """Graph node: analyse the inventory partition of ``raw_inputs``."""
    raw = (state.get("raw_inputs") or {}).get("inventory", {}) or {}

    insights = await run_structured(
        schema=InventoryInsights,
        system=_SYSTEM,
        human=f"Analyse this inventory data and return the structured result:\n{raw}",
        offline=lambda: _offline(raw),
    )
    return {"inventory_insights": insights}
