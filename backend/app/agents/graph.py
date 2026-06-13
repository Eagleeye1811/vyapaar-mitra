"""Assembles the Vyapaar-Mitra operations engine as a LangGraph ``StateGraph``.

Topology::

                          ┌──────────────────┐
                          │       START        │
                          └────────┬──────────┘
            ┌─────────────┬────────┼─────────┬──────────────┐
            ▼             ▼        ▼         ▼
     inventory_node supplier_node customer_node marketing_node   (run in PARALLEL)
            └─────────────┴────────┬─────────┴──────────────┘
                                   ▼
                          risk_evaluator_node    (fan-in: waits for all four)
                                   ▼
                                  END

The four domain agents launch concurrently from ``START`` and converge on
``risk_evaluator_node`` (the orchestrator core), which routes to ``END``. The
compiled graph is exposed as ``vyapaar_mitra_core``.

Checkpointer: ``FirestoreSaver`` from ``langgraph_checkpoint_firestore`` when a
Firestore project/credentials are configured; otherwise an in-memory
``MemorySaver`` so the engine remains runnable locally (e.g.
``test_ops_engine.py``) without GCP credentials.
"""

from __future__ import annotations

import logging
import os

from langgraph.graph import END, START, StateGraph

from .customer import customer_node
from .inventory import inventory_node
from .marketing import marketing_node
from .risk_evaluator import risk_evaluator_node
from .state import BusinessState
from .supplier import supplier_node

logger = logging.getLogger(__name__)


def _build_checkpointer():
    """Return a FirestoreSaver when configured, else an in-memory fallback.

    Firestore is used when ``RESILIO_USE_FIRESTORE`` is truthy, or (in the
    default ``auto`` mode) when a Firestore project id or GCP credentials are
    present. Any construction failure degrades to ``MemorySaver`` with a warning
    rather than breaking graph compilation.
    """
    mode = os.getenv("RESILIO_USE_FIRESTORE", "auto").strip().lower()
    project = os.getenv("FIRESTORE_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
    has_creds = bool(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

    want_firestore = mode in {"1", "true", "yes"} or (
        mode == "auto" and (project or has_creds)
    )

    if want_firestore:
        try:
            from langgraph_checkpoint_firestore import FirestoreSaver

            saver = FirestoreSaver(
                project_id=project,
                checkpoints_collection=os.getenv(
                    "FIRESTORE_CHECKPOINTS_COLLECTION", "vyapaar_mitra_checkpoints"
                ),
                writes_collection=os.getenv(
                    "FIRESTORE_WRITES_COLLECTION", "vyapaar_mitra_checkpoint_writes"
                ),
            )
            logger.info("Vyapaar-Mitra checkpointer: FirestoreSaver (project=%s)", project)
            return saver
        except Exception as exc:  # pragma: no cover - depends on GCP env
            logger.warning(
                "FirestoreSaver unavailable (%s: %s); falling back to MemorySaver.",
                type(exc).__name__,
                exc,
            )

    from langgraph.checkpoint.memory import MemorySaver

    logger.info("Vyapaar-Mitra checkpointer: MemorySaver (in-memory)")
    return MemorySaver()


def build_engine():
    """Construct and compile the operations graph."""
    builder = StateGraph(BusinessState)

    # Register the five agent nodes.
    builder.add_node("inventory_node", inventory_node)
    builder.add_node("supplier_node", supplier_node)
    builder.add_node("customer_node", customer_node)
    builder.add_node("marketing_node", marketing_node)
    builder.add_node("risk_evaluator_node", risk_evaluator_node)

    # Fan-out: all four domain agents launch in parallel from START.
    builder.add_edge(START, "inventory_node")
    builder.add_edge(START, "supplier_node")
    builder.add_edge(START, "customer_node")
    builder.add_edge(START, "marketing_node")

    # Fan-in: risk_evaluator_node runs only after all four have completed.
    builder.add_edge("inventory_node", "risk_evaluator_node")
    builder.add_edge("supplier_node", "risk_evaluator_node")
    builder.add_edge("customer_node", "risk_evaluator_node")
    builder.add_edge("marketing_node", "risk_evaluator_node")

    # Terminate.
    builder.add_edge("risk_evaluator_node", END)

    return builder.compile(checkpointer=_build_checkpointer())


# The compiled engine — import this from API routes, tests, or scripts.
vyapaar_mitra_core = build_engine()
