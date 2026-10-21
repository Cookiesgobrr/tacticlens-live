"""One-shot AI publishing: immutable public output, restricted model invocation.

The first operator invocation reserves a durable Azure blob marker BEFORE
making any model calls. Retries and concurrent attempts never invoke a model.
If a run fails, an operator must deliberately clear the marker manually.
"""
from __future__ import annotations

import os
from typing import Any, Callable

from api.agent_pipeline import run_pipeline
from api.simulator import build_match


MATCH_SECOND = 4500
RESULT_BLOB = "published/verified-high-recoveries-4500.json"
LOCK_BLOB = "locks/high-recoveries-4500-claimed.json"


def enabled() -> bool:
    return os.environ.get("TACTICLENS_AI_GENERATION_ENABLED", "").strip().lower() == "true"


async def publish_once(store: Any, backend_factory: Callable[[], Any]) -> dict:
    """At most one cloud generation attempt per durable blob claim."""
    if not enabled():
        return {"status": "disabled", "reason": "Operator has not enabled model generation."}

    existing = store.get(RESULT_BLOB)
    if existing is not None:
        return {"status": "already_published", "result": existing}

    if not store.claim(LOCK_BLOB):
        return {"status": "locked", "reason": "A generation attempt has already been reserved."}

    # A failed attempt intentionally leaves the lock in place. This prevents
    # automatic retries charging the model again after timeouts/errors.
    try:
        backend = backend_factory()
        answer = await run_pipeline(
            build_match(), at_second=MATCH_SECOND,
            backend=backend, provider="microsoft-foundry"
        )
    except Exception:
        return {"status": "error", "reason": "Cloud setup or agent initialization failed."}

    if answer.get("status") != "verified":
        return {"status": "not_published", "pipeline_status": answer.get("status", "error")}

    store.put(RESULT_BLOB, answer)
    return {"status": "published", "result": answer}


def public_feed(store: Any) -> dict:
    """Cheap read-only endpoint; must never call model APIs."""
    result = store.get(RESULT_BLOB)
    if (not isinstance(result, dict)
            or result.get("status") != "verified"
            or result.get("provider") != "microsoft-foundry"
            or not isinstance(result.get("insight"), dict)):
        return {"status": "pending", "source": "azure-published-cache"}
    return {"status": "ready", "source": "azure-published-cache", "result": result}
