"""Vyapaar-Mitra API gateway.

The *delivery* layer that wraps the ``vyapaar_mitra_core`` LangGraph operations
engine. It owns HTTP concerns only — validation, CORS, logging/timing,
request→engine mapping, and response shaping — and imports the compiled engine
without touching its internals.

Run locally:
    cd backend && uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.agents.graph import vyapaar_mitra_core
from app.schemas.business import OperationalAnalysisResponse, OperationalMetricsPayload

# --- Logging ---------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("vyapaar_mitra.api")

# --- App -------------------------------------------------------------------
app = FastAPI(
    title="Vyapaar-Mitra API",
    version="1.0.0",
    description="Delivery gateway for the Vyapaar-Mitra multi-agent operations engine.",
)

# Next.js dev frontend. Add deployed origins here as they come online.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Trace every request: method, path, status, and wall-clock duration."""
    start = time.perf_counter()
    logger.info("→ %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "✗ %s %s failed after %.1f ms", request.method, request.url.path, elapsed_ms
        )
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "← %s %s -> %s in %.1f ms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# --- Request → engine mapping ---------------------------------------------
def _build_engine_inputs(payload: OperationalMetricsPayload) -> Dict[str, Any]:
    """Map the API payload into the engine's ``BusinessState`` input.

    The four metric blocks map 1:1 onto the engine's ``raw_inputs`` partitions
    (inventory / suppliers / customers / marketing), so no key translation is
    required — the delivery contract mirrors the engine's input contract.
    """
    return {
        "user_id": payload.user_id,
        "session_id": payload.session_id,
        "raw_inputs": {
            "inventory": payload.inventory,
            "suppliers": payload.suppliers,
            "customers": payload.customers,
            "marketing": payload.marketing,
        },
    }


# --- Routes ----------------------------------------------------------------
@app.get("/health", tags=["meta"])
async def health() -> Dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@app.post(
    "/api/analyze-operations",
    response_model=OperationalAnalysisResponse,
    tags=["operations"],
)
async def analyze_operations(
    payload: OperationalMetricsPayload,
) -> OperationalAnalysisResponse:
    """Run the operations engine for a set of business metrics.

    Forwards ``session_id`` as the Firestore checkpointer ``thread_id`` so each
    session's run is durably checkpointed and resumable.
    """
    logger.info(
        "Incoming analysis | user_id=%s session_id=%s blocks=%s",
        payload.user_id,
        payload.session_id,
        {
            "inventory": len(payload.inventory),
            "suppliers": len(payload.suppliers),
            "customers": len(payload.customers),
            "marketing": len(payload.marketing),
        },
    )
    # Full payload only at DEBUG (may contain sensitive commercial figures).
    logger.debug("Full payload: %s", payload.model_dump())

    inputs = _build_engine_inputs(payload)
    config = {"configurable": {"thread_id": payload.session_id}}

    engine_start = time.perf_counter()
    final_result = await vyapaar_mitra_core.ainvoke(inputs, config=config)
    engine_ms = (time.perf_counter() - engine_start) * 1000

    risk_score = final_result.get("risk_score")
    cash_flow = final_result.get("cash_flow_impact_prediction", "")
    playbooks = final_result.get("mitigation_playbooks", []) or []

    logger.info(
        "Engine complete | session_id=%s risk_score=%s playbooks=%d in %.1f ms",
        payload.session_id,
        risk_score,
        len(playbooks),
        engine_ms,
    )

    return OperationalAnalysisResponse(
        status="success",
        risk_score=risk_score,
        cash_flow_impact_prediction=cash_flow,
        mitigation_playbooks=playbooks,
        inventory_insights=final_result.get("inventory_insights", {}) or {},
        supplier_insights=final_result.get("supplier_insights", {}) or {},
        customer_insights=final_result.get("customer_insights", {}) or {},
        marketing_insights=final_result.get("marketing_insights", {}) or {},
    )
