"""Pydantic v2 request/response contracts for the operations API.

These schemas form the *delivery* contract only — they are intentionally
decoupled from the LangGraph engine's internal ``BusinessState``. The endpoint
in ``main.py`` maps between this external HTTP shape and the engine's input
shape (``raw_inputs`` partitioned into inventory / suppliers / customers /
marketing).
"""

from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, ConfigDict, Field


class OperationalMetricsPayload(BaseModel):
    """Validated payload for ``POST /api/analyze-operations``.

    Strict at the top level (unknown fields are rejected). ``user_id`` and
    ``session_id`` are required non-empty strings; the four metric blocks are
    fully structured dictionary maps — one per domain agent — that are forwarded
    verbatim into the engine's ``raw_inputs`` partitions.
    """

    model_config = ConfigDict(
        extra="forbid",  # reject unexpected top-level fields
        str_strip_whitespace=True,
        json_schema_extra={
            "example": {
                "user_id": "user_demo_001",
                "session_id": "sess_demo_001",
                "inventory": {
                    "skus": {
                        "SKU-100": {
                            "on_hand": 90,
                            "monthly_demand": 300,
                            "unit_cost": 120,
                            "unit_price": 320,
                            "lead_time_days": 21,
                        },
                        "SKU-400": {
                            "on_hand": 5000,
                            "monthly_demand": 50,
                            "unit_cost": 35,
                            "unit_price": 90,
                            "lead_time_days": 10,
                        },
                    }
                },
                "suppliers": {
                    "vendors": [
                        {
                            "name": "PrimePack Materials",
                            "criticality": "HIGH",
                            "single_source": True,
                            "on_time_delivery_rate": 0.82,
                            "defect_rate": 0.06,
                            "lead_time_days": 45,
                        }
                    ]
                },
                "customers": {
                    "total_customers": 240,
                    "churned_last_30d": 18,
                    "churn_trend_multiplier": 1.4,
                    "avg_order_value": 3200,
                    "orders_per_year": 6,
                    "revenue_by_customer": {
                        "Acme Retail": 1_900_000,
                        "Globex Stores": 620_000,
                    },
                    "at_risk_segments": ["SMB monthly plans"],
                },
                "marketing": {
                    "current_cac": 1450,
                    "prior_cac": 1100,
                    "campaigns": [
                        {
                            "name": "Meta-Prospecting",
                            "spend": 200_000,
                            "revenue": 160_000,
                            "expected_roas": 2.5,
                        }
                    ],
                },
            }
        },
    )

    user_id: str = Field(..., min_length=1, description="Authenticated user identifier.")
    session_id: str = Field(
        ...,
        min_length=1,
        description="Session identifier; forwarded as the Firestore checkpointer thread_id.",
    )
    inventory: Dict[str, Any] = Field(
        ...,
        description="Inventory metrics map (e.g. per-SKU on_hand / monthly_demand).",
    )
    suppliers: Dict[str, Any] = Field(
        ...,
        description="Supplier metrics map (e.g. vendors with reliability/lead-time data).",
    )
    customers: Dict[str, Any] = Field(
        ...,
        description="Customer metrics map (e.g. revenue_by_customer, churn, LTV inputs).",
    )
    marketing: Dict[str, Any] = Field(
        ...,
        description="Marketing metrics map (e.g. campaigns with spend/revenue, CAC).",
    )


class OperationalAnalysisResponse(BaseModel):
    """Clean, production-facing response returned to the frontend.

    Carries both the cross-domain synthesis (risk score / cash-flow / playbooks)
    and each agent's own insight block, so the UI can render per-domain detail
    pages from a single combined run.
    """

    status: str = Field(default="success")
    risk_score: int = Field(..., ge=0, le=100, description="Composite operational risk, 0-100.")
    cash_flow_impact_prediction: str = Field(
        ..., description="Narrative cash-flow outlook synthesised by the risk evaluator."
    )
    mitigation_playbooks: List[Dict[str, Any]] = Field(
        default_factory=list, description="Actionable mitigation playbooks (typically 3)."
    )

    # Per-domain insight blocks (written by the four parallel agents).
    inventory_insights: Dict[str, Any] = Field(default_factory=dict)
    supplier_insights: Dict[str, Any] = Field(default_factory=dict)
    customer_insights: Dict[str, Any] = Field(default_factory=dict)
    marketing_insights: Dict[str, Any] = Field(default_factory=dict)
