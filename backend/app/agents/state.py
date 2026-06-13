"""Shared graph state for the Vyapaar-Mitra operations engine.

The four domain agents (inventory / supplier / customer / marketing) each write
to their own dedicated partition of this state, so they can run concurrently
without conflicting writes (no custom reducers required). The risk-evaluator
agent then reads all four completed analyses and writes the final synthesis
fields (``risk_score``, ``cash_flow_impact_prediction``, ``mitigation_playbooks``).
"""

from __future__ import annotations

from typing import Any, Dict, List

from typing_extensions import TypedDict


class BusinessState(TypedDict, total=False):
    """The complete state object threaded through the operations graph.

    ``total=False`` so a caller may invoke the graph with only the inputs
    (``user_id``, ``session_id``, ``raw_inputs``); the agents populate the rest.
    """

    # --- Inputs -------------------------------------------------------------
    user_id: str
    session_id: str
    # Nested partitions: {"inventory": {...}, "suppliers": {...},
    #                     "customers": {...}, "marketing": {...}}
    raw_inputs: Dict[str, Any]

    # --- Per-domain insights (written by the four parallel agents) ----------
    inventory_insights: Dict[str, Any]
    supplier_insights: Dict[str, Any]
    customer_insights: Dict[str, Any]
    marketing_insights: Dict[str, Any]

    # --- Synthesis (written by the risk-evaluator agent, runs LAST) ---------
    risk_score: int                                # 0-100 (higher = more risk)
    cash_flow_impact_prediction: str               # narrative cash-flow outlook
    mitigation_playbooks: List[Dict[str, Any]]     # exactly 3 actionable playbooks
