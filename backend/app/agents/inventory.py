"""Inventory domain agent.

Reads ``state["raw_inputs"]["inventory"]`` and produces a structured inventory
read: low-turnover **dead stock** and per-SKU **stockout-date** forecasts.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field

from .llm import run_structured
from .state import BusinessState

# A SKU with more than this many months of cover (and live demand) is "slow";
# zero-demand stock on hand is dead outright.
_SLOW_COVER_MONTHS = 6.0
# Cap forecast horizon so "never stocks out" stays sortable/serialisable.
_HORIZON_CAP_DAYS = 999


class DeadStockItem(BaseModel):
    sku: str = Field(description="SKU identifier.")
    on_hand: float = Field(description="Units currently on hand.")
    monthly_demand: float = Field(description="Observed monthly unit demand.")
    months_of_cover: float = Field(
        description="on_hand / monthly_demand; high values indicate dead stock."
    )
    reason: str = Field(description="Why this SKU is flagged as dead/slow stock.")


class StockoutForecast(BaseModel):
    sku: str = Field(description="SKU identifier.")
    days_to_stockout: int = Field(
        description="Projected days until on-hand hits zero at current demand."
    )
    stockout_date: str = Field(description="Projected stockout date (ISO YYYY-MM-DD).")
    severity: Literal["LOW", "MEDIUM", "HIGH"] = Field(
        description="HIGH if < 14 days, MEDIUM if 14-30, LOW otherwise."
    )


class InventoryInsights(BaseModel):
    """Structured output schema for the inventory agent."""

    dead_stock: List[DeadStockItem] = Field(
        default_factory=list, description="Low-turnover / dead-stock SKUs."
    )
    stockout_forecast: List[StockoutForecast] = Field(
        default_factory=list, description="Per-SKU stockout-date predictions."
    )
    key_findings: List[str] = Field(
        default_factory=list,
        description="2-4 short, concrete findings about inventory health.",
    )


_SYSTEM = (
    "You are a supply-and-inventory analyst for an SME. Given per-SKU on-hand "
    "and demand data, identify low-turnover dead stock (capital tied up in "
    "slow movers) and predict each SKU's stockout date at current demand. Be "
    "precise and flag the most urgent stockouts."
)


def _offline(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic inventory computation used when no model is reachable."""
    skus: Dict[str, Any] = raw.get("skus") or raw.get("inventory") or {}
    as_of = date.today()

    dead_stock: List[Dict[str, Any]] = []
    stockout: List[Dict[str, Any]] = []

    for sku, data in skus.items():
        on_hand = float((data or {}).get("on_hand", 0) or 0)
        demand = float((data or {}).get("monthly_demand", 0) or 0)

        # --- Dead / slow stock -------------------------------------------
        if demand <= 0 and on_hand > 0:
            dead_stock.append(
                {
                    "sku": sku,
                    "on_hand": on_hand,
                    "monthly_demand": demand,
                    "months_of_cover": _HORIZON_CAP_DAYS / 30.0,
                    "reason": "No observed demand — capital fully tied up.",
                }
            )
            continue

        months_cover = round(on_hand / demand, 1) if demand else 0.0
        if months_cover > _SLOW_COVER_MONTHS:
            dead_stock.append(
                {
                    "sku": sku,
                    "on_hand": on_hand,
                    "monthly_demand": demand,
                    "months_of_cover": months_cover,
                    "reason": f"{months_cover} months of cover exceeds the "
                    f"{_SLOW_COVER_MONTHS:g}-month slow-mover threshold.",
                }
            )

        # --- Stockout forecast -------------------------------------------
        if demand > 0:
            days = int(round((on_hand / demand) * 30))
            days = min(days, _HORIZON_CAP_DAYS)
            severity = "HIGH" if days < 14 else "MEDIUM" if days <= 30 else "LOW"
            stockout.append(
                {
                    "sku": sku,
                    "days_to_stockout": days,
                    "stockout_date": (as_of + timedelta(days=days)).isoformat(),
                    "severity": severity,
                }
            )

    stockout.sort(key=lambda s: s["days_to_stockout"])

    findings: List[str] = []
    if dead_stock:
        findings.append(
            f"{len(dead_stock)} SKU(s) flagged as dead/slow stock — review for markdown."
        )
    urgent = [s for s in stockout if s["severity"] == "HIGH"]
    if urgent:
        findings.append(
            f"{len(urgent)} SKU(s) stock out within 14 days: "
            + ", ".join(s["sku"] for s in urgent[:3])
            + "."
        )
    if not findings:
        findings.append("Inventory turnover and cover levels are within healthy bands.")

    return {
        "dead_stock": dead_stock,
        "stockout_forecast": stockout,
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
