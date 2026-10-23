"""Cost-closed, operator-triggered live moments. No public model invocation.

The service reads a previously approved source snapshot from private Blob storage.
Callers cannot submit match events, prompts, arbitrary seeds or claim text.
Reservation occurs before initializing Microsoft Foundry agents; a failed run
is never retried automatically. Public GET reads only validated cached output.
"""
from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Callable, Any

from api.eleven_pipeline import run_eleven_pipeline, validate_source

SOURCE_PREFIX = "live/sources"
RESULT_PREFIX = "live/results"
CLAIM_PREFIX = "live/claims"


def enabled() -> bool:
    return os.environ.get("TACTICLENS_LIVE_AI_ENABLED", "").lower() == "true"


def _identity(seed: int, at_second: float) -> str:
    if type(seed) is not int or not 1 <= seed <= 4294967295:
        raise ValueError("Invalid seed")
    if type(at_second) not in (float, int) or not 0 <= at_second <= 5400:
        raise ValueError("Invalid match time")
    return f"{seed}/{at_second:g}"


def get_cached(store: Any, seed: int, at_second: float) -> dict:
    ident = _identity(seed, at_second)
    value = store.get(f"{RESULT_PREFIX}/{ident}.json")
    if isinstance(value, dict) and value.get("status") == "verified":
        # This read never invokes a model. Recheck match and moment identity.
        cards = value.get("cards", [])
        if (value.get("matchId") == f"SIM-{seed}" and value.get("seed") == seed
                and len(cards) == 1 and cards[0].get("moment", {}).get("atSecond") == at_second
                and len(value.get("trace", [])) == 3):
            return {"status": "ready", "result": value}
    return {"status": "pending"}


async def generate_once(
    store: Any, *, seed: int, at_second: float,
    backend_factory: Callable[[], Any], preflight: Callable[[], Any],
) -> dict:
    """Private, one-shot generation with durable lock and verified source.

    A new seed must be placed in private storage by an operator and approved
    independently before ANY model invocation. No retries, no arbitrary POST
    bodies, no browser-exposed function keys.
    """
    if not enabled():
        return {"status": "disabled"}
    ident = _identity(seed, at_second)
    existing = get_cached(store, seed, at_second)
    if existing["status"] == "ready":
        return {"status": "already_cached"}
    source = store.get(f"{SOURCE_PREFIX}/{seed}.json")
    if source is None:
        return {"status": "unapproved_seed"}
    validate_source(source)
    if source["seed"] != seed:
        raise ValueError("Source seed mismatch")
    moments = [m for m in source["moments"] if m["atSecond"] == at_second]
    if len(moments) != 1:
        return {"status": "ineligible_moment"}
    # Subscription and deployment must still be FreeTrial + spendingLimit On.
    preflight()
    # Each moment uses no more than three model requests with no SDK retries.
    # Azure blob claim is durable, atomic and left in place on failure.
    if not store.claim(f"{CLAIM_PREFIX}/{ident}.json"):
        return {"status": "already_reserved"}
    backend = None
    try:
        backend = backend_factory()
        outcome = await run_eleven_pipeline(source, backend, moment_at=at_second)
        if len(backend.trace) != 3:
            raise ValueError("Three approved agent calls are required")
        pack = {
            "schemaVersion": "tacticlens.foundry11.v1",
            "status": "verified", "provider": "microsoft-foundry",
            "model": "gpt-4.1-mini", "matchId": f"SIM-{seed}",
            "seed": seed, "generatedAt": datetime.now(timezone.utc).isoformat(),
            "cards": outcome["cards"], "trace": backend.trace,
        }
        store.put(f"{RESULT_PREFIX}/{ident}.json", pack)
        return {"status": "published", "seed": seed, "moment": at_second}
    except Exception:
        # Do not auto-release; a timeout could still have billed Azure tokens.
        return {"status": "failed_locked"}
    finally:
        if backend is not None:
            await backend.close()
