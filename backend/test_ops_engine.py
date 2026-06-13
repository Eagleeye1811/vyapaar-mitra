"""Standalone CLI harness for the Vyapaar-Mitra operations engine.

Runs the compiled ``vyapaar_mitra_core`` end-to-end against a comprehensive mock
enterprise operational dataset and prints the fully populated final state. No
FastAPI, no network required — by default it runs in OFFLINE mode (deterministic
fallback) when the open-source model is unreachable.

Run from the ``backend/`` directory:

    python test_ops_engine.py

To exercise the LIVE path against an open-source model:

    # Groq cloud inference of Llama 3.3 70B:
    export RESILIO_LLM_PROVIDER=groq
    export GROQ_API_KEY=gsk_...
    export RESILIO_LLM_MODEL=llama-3.3-70b-versatile
    python test_ops_engine.py

    # ...or a local Ollama server:
    export RESILIO_LLM_PROVIDER=ollama
    export RESILIO_LLM_MODEL=llama3.3:70b      # `ollama pull llama3.3:70b`
    python test_ops_engine.py
"""

from __future__ import annotations

import asyncio
import json

from app.agents.graph import vyapaar_mitra_core
from app.agents.llm import active_mode


def build_mock_inputs() -> dict:
    """A comprehensive mock enterprise dataset spanning all four domains."""
    return {
        "user_id": "user_demo_001",
        "session_id": "sess_demo_001",
        "raw_inputs": {
            "inventory": {
                "skus": {
                    "SKU-100": {"on_hand": 90, "monthly_demand": 300},   # imminent stockout
                    "SKU-200": {"on_hand": 450, "monthly_demand": 400},  # healthy
                    "SKU-300": {"on_hand": 40, "monthly_demand": 220},   # HIGH stockout
                    "SKU-400": {"on_hand": 5000, "monthly_demand": 50},  # dead stock
                    "SKU-500": {"on_hand": 800, "monthly_demand": 0},    # no demand
                },
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
                    },
                    {
                        "name": "SwiftLogistics",
                        "criticality": "HIGH",
                        "single_source": False,
                        "on_time_delivery_rate": 0.97,
                        "defect_rate": 0.01,
                        "lead_time_days": 7,
                    },
                    {
                        "name": "ColorChem Dyes",
                        "criticality": "MEDIUM",
                        "single_source": True,
                        "on_time_delivery_rate": 0.71,
                        "defect_rate": 0.09,
                        "lead_time_days": 30,
                    },
                    {
                        "name": "GenericBox Co",
                        "criticality": "LOW",
                        "single_source": False,
                        "on_time_delivery_rate": 0.99,
                        "defect_rate": 0.00,
                        "lead_time_days": 10,
                    },
                ],
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
                    "Initech Pvt": 410_000,
                    "Long tail (236 others)": 1_050_000,
                },
                "at_risk_segments": ["SMB monthly plans", "Trial conversions"],
            },
            "marketing": {
                "current_cac": 1450,
                "prior_cac": 1100,
                "campaigns": [
                    {"name": "Search-Brand", "spend": 120_000, "revenue": 540_000, "expected_roas": 4.0},
                    {"name": "Meta-Prospecting", "spend": 200_000, "revenue": 160_000, "expected_roas": 2.5},
                    {"name": "Influencer-Q2", "spend": 90_000, "revenue": 72_000, "expected_roas": 2.0},
                    {"name": "Retargeting", "spend": 60_000, "revenue": 300_000, "expected_roas": 5.0},
                ],
            },
        },
    }


async def main() -> None:
    mock_inputs = build_mock_inputs()
    config = {"configurable": {"thread_id": "cli_ops_test_session"}}

    print("=" * 78)
    print("  VYAPAAR-MITRA :: operations engine — CLI end-to-end test")
    print(f"  Execution mode : {active_mode()}")
    print(f"  Thread id      : {config['configurable']['thread_id']}")
    print("=" * 78)

    final_state = await vyapaar_mitra_core.ainvoke(mock_inputs, config=config)

    print("\n----- FINAL POPULATED STATE -----\n")
    print(json.dumps(final_state, indent=2, default=str, ensure_ascii=False))

    # Concise headline so the result is readable at a glance.
    print("\n----- HEADLINE -----")
    print(f"  Risk score                  : {final_state.get('risk_score')}/100")
    print(f"  Cash-flow impact prediction : {final_state.get('cash_flow_impact_prediction')}")
    playbooks = final_state.get("mitigation_playbooks", []) or []
    print(f"  Mitigation playbooks        : {len(playbooks)}")
    for i, pb in enumerate(playbooks, 1):
        print(f"    {i}. [{pb.get('priority')}] {pb.get('title')}")
    print()


if __name__ == "__main__":
    asyncio.run(main())
