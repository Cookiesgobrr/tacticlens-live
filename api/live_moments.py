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

from api.eleven_pipeline import run_eleven_pipeline, validate_source, check_proposal, check_presentation
from api.live_approval import APPROVED_MOMENT, APPROVAL_PATH, AUTHORIZATION_ID, verify_approval

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


def validate_cached_pack(pack: dict, source: dict, seed: int, at_second: float) -> None:
    validate_source(source)
    if (pack.get("schemaVersion") != "tacticlens.foundry11.v1" or pack.get("status") != "verified"
            or pack.get("provider") != "microsoft-foundry" or pack.get("model") != "gpt-4.1-mini"
            or pack.get("matchId") != f"SIM-{seed}" or pack.get("seed") != seed):
        raise ValueError("Invalid live cache identity")
    moments = [m for m in source["moments"] if m["atSecond"] == at_second]
    cards, trace = pack.get("cards", []), pack.get("trace", [])
    if len(moments) != 1 or len(cards) != 1 or cards[0].get("moment") != moments[0]:
        raise ValueError("Invalid live cache evidence")
    scoped = {**source, "moments": moments}
    proposal = check_proposal(scoped, {"cards": [dict(id=moments[0]["id"], angle=cards[0]["angle"], claimIds=cards[0]["selectedClaimIds"])]})
    check_presentation(scoped, proposal, {"cards": [dict(id=moments[0]["id"], modes=cards[0]["modes"])]})
    if len(trace) != 3 or [t.get("stage") for t in trace] != ["Insight", "Verification", "Presentation"]:
        raise ValueError("Invalid agent trace")
    for t in trace:
        if (t.get("status") != "complete" or not isinstance(t.get("responseId"), str) or len(t["responseId"]) < 6
                or any(type(t.get(k)) is not int or t[k] < 0 for k in ("inputTokens", "outputTokens"))
                or t["outputTokens"] > 1000):
            raise ValueError("Invalid agent usage")


def get_cached(store: Any, seed: int, at_second: float) -> dict:
    ident = _identity(seed, at_second)
    if ident != APPROVED_MOMENT:
        return {"status": "unavailable"}
    value = store.get(f"{RESULT_PREFIX}/{ident}.json")
    if value is not None:
        try:
            from api.live_approval import source_sha256
            source = store.get(f"{SOURCE_PREFIX}/{seed}.json")
            if (value["schemaVersion"] != "tacticlens.live-publication.v1" or value["authorizationId"] != AUTHORIZATION_ID
                    or value["sourceSha256"] != source_sha256(source)):
                raise ValueError("Invalid publication provenance")
            validate_cached_pack(value["pack"], source, seed, at_second)
            return {"status": "ready", "result": value}
        except (ValueError, KeyError, TypeError):
            return {"status": "unavailable"}
    if store.get(f"live/failures/{ident}.json"):
        return {"status": "failed_locked"}
    if store.get(f"{CLAIM_PREFIX}/{ident}.json"):
        return {"status": "reserved"}
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
    # Explicit, finite operator allowlist: a leaked Function key cannot
    # generate arbitrary moments even in a privately approved source.
    allowed = set(filter(None, (v.strip() for v in
        os.environ.get("TACTICLENS_LIVE_APPROVED_MOMENTS", "").split(","))))
    if ident not in allowed or len(allowed) > 3:
        return {"status": "not_approved_for_generation"}
    if allowed != {APPROVED_MOMENT}:
        return {"status": "not_approved_for_generation"}
    existing = get_cached(store, seed, at_second)
    if existing["status"] == "ready":
        return {"status": "already_cached"}
    if existing["status"] in ("reserved", "failed_locked"):
        return {"status": "already_reserved"}
    if existing["status"] == "unavailable":
        return {"status": "invalid_cache"}
    source = store.get(f"{SOURCE_PREFIX}/{seed}.json")
    if source is None:
        return {"status": "unapproved_seed"}
    approval = verify_approval(store.get(APPROVAL_PATH), source)
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
    started = datetime.now(timezone.utc)
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
        # Reuse independent Python evidence and composition gates on the result.
        validate_cached_pack(pack, source, seed, at_second)
        publication = dict(schemaVersion="tacticlens.live-publication.v1", authorizationId=AUTHORIZATION_ID,
            sourceSha256=approval["sourceSha256"], engineSha256=approval["engineSha256"],
            generationStartedAt=started.isoformat(), generationFinishedAt=pack["generatedAt"],
            authorizationExhausted=True, limits=approval["limits"], pack=pack)
        store.put(f"{RESULT_PREFIX}/{ident}.json", publication)
        return {"status": "published", "seed": seed, "moment": at_second}
    except Exception as error:
        # Terminal diagnostic is private and immutable. Never include credentials.
        try:
            store.put(f"live/failures/{ident}.json", dict(status="failed_locked", errorType=type(error).__name__,
                attempts=getattr(backend, "attempts", []), trace=getattr(backend, "trace", [])))
        except Exception:
            pass
        # Do not auto-release; a timeout could still have billed Azure tokens.
        return {"status": "failed_locked"}
    finally:
        if backend is not None:
            await backend.close()
