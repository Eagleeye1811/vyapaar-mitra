"""LLM access layer for the Vyapaar-Mitra operations engine.

Centralises *how* the domain agents talk to a model so each agent file stays
focused on its domain logic. Two responsibilities:

1. Build the configured **open-source** chat model — ``ChatGroq`` (Groq cloud
   inference) or ``ChatOllama`` (local inference) — and wire structured outputs
   via ``.with_structured_output()`` so Pydantic parsing is guaranteed.
2. Provide an *offline* deterministic fallback so the whole graph can be
   exercised end-to-end (topology, parallel fan-out, state flow, checkpointing)
   without a running model. Offline mode activates automatically when the
   selected provider is unreachable (e.g. no ``GROQ_API_KEY``), or explicitly
   via ``RESILIO_OFFLINE=1``.

Model: the target is the open-source **Llama 3.3 70B Instruct** family. Note the
provider-specific identifiers differ — Groq serves it as
``llama-3.3-70b-versatile`` and Ollama as ``llama3.3:70b`` — so the default is
provider-aware and overridable with ``RESILIO_LLM_MODEL``.

Environment variables
----------------------
RESILIO_LLM_PROVIDER : "groq" (default) | "ollama"
RESILIO_LLM_MODEL    : model id (defaults: llama-3.3-70b-versatile / llama3.3:70b)
RESILIO_OFFLINE      : "1"/"true" to force the deterministic fallback
GROQ_API_KEY         : presence enables live Groq calls
OLLAMA_BASE_URL      : Ollama server URL (defaults to http://localhost:11434)
"""

from __future__ import annotations

import os
from typing import Callable, Dict, Type, TypeVar

from pydantic import BaseModel

_TModel = TypeVar("_TModel", bound=BaseModel)

# The conceptual model is "llama3.3-70b-instruct"; these are the concrete ids
# each open-source provider actually serves it under.
_DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
_DEFAULT_OLLAMA_MODEL = "llama3.3:70b"


def _provider() -> str:
    return os.getenv("RESILIO_LLM_PROVIDER", "groq").strip().lower()


def _model_id() -> str:
    default = _DEFAULT_OLLAMA_MODEL if _provider() == "ollama" else _DEFAULT_GROQ_MODEL
    return os.getenv("RESILIO_LLM_MODEL", default)


def is_offline() -> bool:
    """Return True when agents should use the deterministic fallback.

    Forced by ``RESILIO_OFFLINE``; otherwise inferred from a missing Groq API
    key. Ollama is a local server with no key, so it is assumed reachable unless
    offline is forced — a failed live call still degrades gracefully (see
    ``run_structured``).
    """
    if os.getenv("RESILIO_OFFLINE", "").strip().lower() in {"1", "true", "yes"}:
        return True
    if _provider() == "ollama":
        return False
    return not os.getenv("GROQ_API_KEY")


def active_mode() -> str:
    """Human-readable description of the current execution mode."""
    if is_offline():
        return "OFFLINE (deterministic fallback — open-source model unreachable)"
    return f"LIVE {_provider()}:{_model_id()}"


def get_chat_model():
    """Construct the configured open-source LangChain chat model.

    Imported lazily so that offline runs do not require the provider SDKs.
    ``temperature=0`` keeps structured extraction as deterministic as the model
    allows.
    """
    if _provider() == "ollama":
        from langchain_community.chat_models import ChatOllama

        return ChatOllama(
            model=_model_id(),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            temperature=0,
        )

    # Default: Groq cloud inference of Llama 3.3 70B.
    from langchain_groq import ChatGroq

    return ChatGroq(model=_model_id(), temperature=0)


async def run_structured(
    *,
    schema: Type[_TModel],
    system: str,
    human: str,
    offline: Callable[[], Dict],
) -> Dict:
    """Run a structured-output extraction, returning a plain ``dict``.

    In live mode the model is forced to emit data matching ``schema`` via
    ``.with_structured_output()``. In offline mode (or if the live call fails)
    the ``offline`` callable supplies a deterministic result so the graph still
    completes end-to-end.
    """
    if is_offline():
        return offline()

    try:
        structured = get_chat_model().with_structured_output(schema)
        result: BaseModel = await structured.ainvoke(
            [("system", system), ("human", human)]
        )
        return result.model_dump()
    except Exception as exc:  # pragma: no cover - network/credential failures
        # Never let a transient model/credential issue break the whole engine;
        # degrade to the deterministic computation and annotate why.
        fallback = offline()
        fallback["_degraded"] = f"live call failed: {type(exc).__name__}: {exc}"
        return fallback
