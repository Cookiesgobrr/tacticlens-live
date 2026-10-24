"""Protected event coordinator with one CAS ledger for ALL quotas and workers.

Public reads never advance the clock, reserve work or initialise a model.
Submitted calls and worst-case tokens remain charged even after failure/crash.
The legacy one-moment authorization and blobs are never used by this service.
"""
from __future__ import annotations

import asyncio
import copy
from datetime import datetime, timezone
import math
import os
import re
import time

from api.live_event_facts import validate_source, digest, detect, facts_for, check_proposal, check_plan

PREFIX = "live-v2"
LEDGER = f"{PREFIX}/ledger.json"
STAGES = ("Insight", "Verification", "Presentation")
ACTIVE = ("processing", "verification", "presentation")
CREDIT_RESERVE_MICRO_USD = 190_000_000


def enabled():
    return os.environ.get("TACTICLENS_SESSION_AI_ENABLED", "").lower() == "true"


def ident(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{8,80}", value):
        raise ValueError("Invalid session/approval identifier")
    return value


def transaction(store, change):
    for _ in range(12):
        state, etag = store.snapshot(LEDGER)
        state = copy.deepcopy(state or dict(sessions={}, days={}, reservations={}))
        result = change(state)
        if store.compare_and_swap(LEDGER, etag, state):
            return result
    raise RuntimeError("Ledger contention; no inference submitted")


def global_limits():
    import json
    value = json.loads(os.environ.get("TACTICLENS_SESSION_GLOBAL_LIMITS", "{}"))
    ceilings = dict(calls=90, inputTokens=1440000, outputTokens=90000,
                    microUsd=1000000, activeSessions=2, concurrency=2)
    if set(value) != set(ceilings) or any(type(value[k]) is not int or not 1 <= value[k] <= ceilings[k] for k in ceilings):
        raise ValueError("Explicit bounded global limits required")
    return value


def approval_for(store, approval_id, now):
    ident(approval_id)
    allowed = os.environ.get("TACTICLENS_SESSION_APPROVAL_IDS", "").split(",")
    if approval_id not in allowed:
        raise ValueError("No new owner authorization")
    approval = store.get(f"{PREFIX}/approvals/{approval_id}.json")
    if (not approval or approval.get("schemaVersion") != "tacticlens.session-approval.v1"
            or approval.get("id") != approval_id or approval.get("ownerApproved") is not True
            or approval.get("subscriptionId") != os.environ.get("TACTICLENS_AZURE_SUBSCRIPTION_ID")
            or approval.get("subscriptionType") != "FreeTrial" or approval.get("spendingLimit") != "On"
            or not 0 <= now-approval.get("creditsCheckedAt", 0) <= 600
            or not now < approval.get("expiresAt", 0) <= now+7200):
        raise ValueError("Missing, expired or unsafe private approval")
    limits = approval["limits"]
    ceilings = dict(moments=15, calls=45, inputTokensPerCall=16000, outputTokensPerCall=1000,
                    inputBytesPerCall=12000, microUsd=1000000, speed=60)
    if set(limits) != set(ceilings) or any(type(limits[k]) is not int or not 1 <= limits[k] <= ceilings[k] for k in ceilings):
        raise ValueError("Invalid bounded session limits")
    if limits["calls"] < 3 or limits["moments"]*3 > limits["calls"]:
        raise ValueError("Insufficient three-agent call budget")
    for k in ("inputRateMicroUsdPerMillion", "outputRateMicroUsdPerMillion"):
        if type(approval.get(k)) is not int or not 1 <= approval[k] <= 100000000:
            raise ValueError("Operator-verified price ceiling required")
    if (type(approval.get("remainingCreditMicroUsd")) is not int
            or approval["remainingCreditMicroUsd"]-limits["microUsd"] < CREDIT_RESERVE_MICRO_USD):
        raise ValueError("Trial allocation would breach the protected credit reserve")
    source = store.get(f"{PREFIX}/sources/{ident(approval['sourceId'])}.json")
    validate_source(source)
    if (approval.get("sourceSha256") != digest(source) or approval.get("engineSha256") != source["engineSha256"]
            or approval.get("seed") != source["seed"]):
        raise ValueError("Unapproved source or engine")
    return approval, source


def _cost(approval):
    limits = approval["limits"]
    return math.ceil(3*(limits["inputTokensPerCall"]*approval["inputRateMicroUsdPerMillion"]
                        + limits["outputTokensPerCall"]*approval["outputRateMicroUsdPerMillion"])/1000000)


def start_session(store, approval_id, *, now=None):
    if not enabled():
        return {"status": "disabled"}
    now = time.time() if now is None else now
    approval, source = approval_for(store, approval_id, now)
    caps = global_limits()
    # Exactly one session per approval, not a browser-supplied random ID. A
    # restart/refresh cannot multiply the approval's budget.
    sid = approval_id

    def start(state):
        if sid in state["sessions"]:
            return dict(status="existing", sessionId=sid)
        if len(state["sessions"]) >= 128:
            raise ValueError("Ledger retention bound; operator archive required")
        active = [s for s in state["sessions"].values() if s["status"] == "running" and now < s["expiresAt"]]
        if len(active) >= caps["activeSessions"]:
            raise ValueError("Active session limit")
        state["sessions"][sid] = dict(id=sid, approvalId=approval_id, matchId=source["matchId"], seed=source["seed"],
            sourceId=approval["sourceId"], sourceSha256=digest(source), engineVersion=source["engineVersion"],
            engineSha256=source["engineSha256"], startedAt=now, expiresAt=approval["expiresAt"],
            speed=approval["limits"]["speed"], status="running", clock=0, queue=[], seen=[], records=[],
            reservedCalls=0, reservedMicroUsd=0, reservedMoments=0, lastDispatch=-10000)
        return dict(status="started", sessionId=sid)
    return transaction(store, start)


def _get_session(store, sid):
    ident(sid)
    ledger, _ = store.snapshot(LEDGER)
    return (ledger or {}).get("sessions", {}).get(sid)


def _unavailable(store, sid):
    def mark(state):
        state["sessions"][sid]["serviceAvailable"] = False
    transaction(store, mark)


def stop_session(store, sid):
    ident(sid)
    def stop(state):
        session = state["sessions"][sid]
        session["status"] = "stopped"
        session["queue"] = []
        # Existing paid requests remain reserved. In-flight work must check the
        # stop flag before every further stage and before publication.
        return {"status": "stopped"}
    return transaction(store, stop)


def resume_session(store, sid, *, now=None):
    """Explicit operator continuation; never resets seen events or reservations."""
    if not enabled():
        return {"status": "disabled"}
    now = time.time() if now is None else now
    approval, source = approval_for(store, sid, now)
    caps = global_limits()
    def resume(state):
        s = state["sessions"][sid]
        if s["status"] not in ("stopped", "paused"):
            raise ValueError("Only a stopped/paused session can continue")
        if (s["sourceSha256"] != digest(source) or s["engineSha256"] != source["engineSha256"]
                or s["speed"] != approval["limits"]["speed"]
                or s["reservedCalls"] >= approval["limits"]["calls"]
                or s["reservedMoments"] >= approval["limits"]["moments"]):
            raise ValueError("Source changed or original allocation exhausted")
        if any(r["sessionId"] == sid and r["state"] in ACTIVE for r in state["reservations"].values()):
            raise ValueError("Unreconciled in-flight workflow")
        if sum(x["status"] == "running" and now < x["expiresAt"] for x in state["sessions"].values()) >= caps["activeSessions"]:
            raise ValueError("Active session limit")
        s.update(status="running", startedAt=now-s["clock"]/s["speed"], expiresAt=approval["expiresAt"], serviceAvailable=True)
        return dict(status="resumed", sessionId=sid)
    return transaction(store, resume)


def _reserve(store, sid, approval, source, now):
    caps, limits = global_limits(), approval["limits"]
    day = datetime.fromtimestamp(now, timezone.utc).date().isoformat()
    amount = _cost(approval)

    def reserve(state):
        s = state["sessions"][sid]
        s["serviceAvailable"] = True
        if s["status"] != "running":
            return None
        if now >= s["expiresAt"]:
            s["status"], s["queue"] = "expired", []
            return None
        clock = min(5400, max(s["clock"], (now-s["startedAt"])*s["speed"]))
        s["clock"] = clock
        seen = set(s["seen"])
        for candidate in detect(source, clock):
            if candidate["id"] not in seen:
                seen.add(candidate["id"])
                s["queue"].append(candidate)
        s["seen"] = sorted(seen)
        s["queue"] = [c for c in s["queue"] if c["kind"] in ("goal", "halftime", "fulltime") or clock-c["atSecond"] <= 180]
        s["queue"].sort(key=lambda c: (-c["priority"], c["atSecond"], c["id"]))
        s["queue"] = s["queue"][:12]
        if not s["queue"]:
            if clock == 5400:
                s["status"] = "completed"
            return None
        busy = sum(r["state"] in ACTIVE for r in state["reservations"].values())
        if busy >= caps["concurrency"] or any(r["sessionId"] == sid and r["state"] in ACTIVE for r in state["reservations"].values()):
            return None
        c = s["queue"][0]
        lifecycle = c["kind"] in ("halftime", "fulltime")
        if c["priority"] < 90 and clock-s["lastDispatch"] < 120:
            return None
        minor = [state["reservations"][k] for k in s["records"]
                 if state["reservations"][k]["candidate"]["priority"] < 90]
        minor_cap = max(0, limits["moments"]-8)
        # Pacing is a budget rule, not a scheduled trigger: only logged events
        # qualify. Preserve capacity for goals and spread lower priorities.
        if c["priority"] < 90 and len(minor) >= min(minor_cap, 1+int(clock/5400*minor_cap)):
            return None
        daily = state["days"].setdefault(day, dict(calls=0, inputTokens=0, outputTokens=0, microUsd=0))
        usage = dict(calls=3, inputTokens=3*limits["inputTokensPerCall"], outputTokens=3*limits["outputTokensPerCall"], microUsd=amount)
        if (s["reservedMoments"] >= limits["moments"] or s["reservedCalls"]+3 > limits["calls"]
                or s["reservedMicroUsd"]+amount > limits["microUsd"]
                or any(daily[k]+usage[k] > caps[k] for k in usage)):
            s["status"], s["queue"] = "budget_exhausted", []
            return None
        # Leave room for actual half/full analyses instead of filling the entire
        # budget with early ordinary sequences. Never invent events to fill it.
        lifecycle_reserve = min(2, limits["moments"]//3)
        if not lifecycle and s["reservedMoments"] >= limits["moments"]-lifecycle_reserve:
            s["queue"].pop(0)
            return None
        key = f"{sid}/{c['id']}"
        if key in state["reservations"]:
            s["queue"].pop(0)
            return None
        for k in usage:
            daily[k] += usage[k]
        s["reservedMoments"] += 1
        s["reservedCalls"] += 3
        s["reservedMicroUsd"] += amount
        s["lastDispatch"] = clock
        s["queue"].pop(0)
        record = dict(sessionId=sid, day=day, candidate=c, state="processing", attempts=[], trace=[],
                      occurredAt=s["startedAt"]+c["atSecond"]/s["speed"],
                      reserved=usage, startedAt=now, finishedAt=None, facts=facts_for(source, c))
        state["reservations"][key] = record
        s["records"].append(key)
        return key, copy.deepcopy(record)
    return transaction(store, reserve)


def _stage(store, key, stage, now):
    if not enabled():
        raise RuntimeError("Kill switch active")
    def mark(state):
        r = state["reservations"][key]
        s = state["sessions"][r["sessionId"]]
        if s["status"] != "running" or now >= s["expiresAt"]:
            raise RuntimeError("Session stopped/expired")
        if datetime.fromtimestamp(now, timezone.utc).date().isoformat() != r["day"]:
            raise RuntimeError("Workflow crossed daily budget boundary; no further calls")
        if len(r["attempts"]) >= 3 or stage != STAGES[len(r["attempts"])]:
            raise RuntimeError("Duplicate/out-of-order paid call")
        r["attempts"].append(dict(stage=stage, submittedAt=now))
        r["state"] = {"Insight": "processing", "Verification": "verification", "Presentation": "presentation"}[stage]
    transaction(store, mark)


async def pulse(store, sid, *, backend_factory, preflight, now=None):
    """Called ONLY by protected operator/timer, never by a read route."""
    if not enabled():
        return {"status": "disabled"}
    now = time.time() if now is None else now
    session = _get_session(store, sid)
    if not session:
        return {"status": "unknown_session"}
    if session["status"] != "running":
        return {"status": session["status"]}
    try:
        approval, source = approval_for(store, session["approvalId"], now)
    except (ValueError, KeyError, TypeError, AttributeError):
        _unavailable(store, sid)
        return {"status": "approval_unavailable"}
    if (session["sourceSha256"] != digest(source) or session["engineSha256"] != source["engineSha256"]
            or session["speed"] != approval["limits"]["speed"]):
        raise ValueError("Session approval changed")
    # Free Trial/spending-limit/model checks are fresh for every workflow. This
    # read is not inference and happens before any reservation/backend creation.
    try:
        preflight()
    except Exception:
        _unavailable(store, sid)
        return {"status": "preflight_unavailable"}
    reserved = _reserve(store, sid, approval, source, now)
    if not reserved:
        return {"status": "idle"}
    key, record = reserved
    backend = None
    started = time.monotonic()
    stage_clock = lambda: now + (time.monotonic()-started)
    try:
        backend = backend_factory(approval["limits"], lambda stage: _stage(store, key, stage, stage_clock()))
        facts = record["facts"]
        async def workflow():
            proposal = check_proposal(facts, await backend.propose(facts))
            review = await backend.verify(facts, proposal)
            if review != dict(approved=True, checkedId=facts["candidate"]["id"], issues=[]):
                raise ValueError("Verification agent veto")
            plan = check_plan(facts, proposal, await backend.present(facts, proposal))
            return proposal, plan
        proposal, plan = await asyncio.wait_for(workflow(), timeout=190)
        trace = backend.trace
        if (len(trace) != 3 or [t.get("stage") for t in trace] != list(STAGES)
                or len({t.get("responseId") for t in trace}) != 3
                or any(not isinstance(t.get("responseId"), str) or len(t["responseId"]) < 6
                       or any(type(t.get(k)) is not int or not 0 <= t[k] <= approval["limits"][limit]
                              for k, limit in (("inputTokens", "inputTokensPerCall"), ("outputTokens", "outputTokensPerCall"))) for t in trace)):
            raise ValueError("Missing/invalid actual provider usage")
        # Rebuild independently before publication; no agent may override it.
        if facts != facts_for(source, record["candidate"]):
            raise ValueError("Facts changed during generation")
        def publish(state):
            r = state["reservations"][key]
            s = state["sessions"][sid]
            if not enabled() or s["status"] != "running" or stage_clock() >= s["expiresAt"]:
                raise RuntimeError("Generation disabled before publication")
            if len(r["attempts"]) != 3:
                raise ValueError("Three durable attempts required")
            r.update(state="verified", proposal=proposal, plan=plan, trace=trace,
                     providerMode=getattr(backend, "provider", "offline-mock"),
                     finishedAt=stage_clock(), elapsedMs=round((time.monotonic()-started)*1000),
                     eventToPublicationMs=round((stage_clock()-r["occurredAt"])*1000))
            if r["candidate"]["kind"] == "fulltime":
                s["status"], s["queue"] = "completed", []
        transaction(store, publish)
        return {"status": "published", "eventId": record["candidate"]["id"]}
    except Exception as exc:
        def fail(state):
            r = state["reservations"][key]
            r.update(state="fallback", errorType=type(exc).__name__, finishedAt=stage_clock(),
                     trace=getattr(backend, "trace", []), errorMessage=str(exc)[:300],
                     agentOutputs=getattr(backend, "responses", []))
            s = state["sessions"][sid]
            if s["status"] == "running":
                s.update(status="paused", queue=[])
        transaction(store, fail)
        return {"status": "failed_locked"}
    finally:
        if backend:
            try:
                await backend.close()
            except Exception:
                pass


def public_session(store, sid, *, now=None):
    """Read-only finite allowlist. Does not enqueue, call preflight or infer."""
    ident(sid)
    if sid not in os.environ.get("TACTICLENS_SESSION_PUBLIC_IDS", "").split(","):
        return {"status": "unavailable"}
    now = time.time() if now is None else now
    state, _ = store.snapshot(LEDGER)
    session = (state or {}).get("sessions", {}).get(sid)
    if not session:
        return {"status": "unavailable"}
    clock = min(5400, max(session["clock"], (now-session["startedAt"])*session["speed"])) if session["status"] == "running" else session["clock"]
    records = []
    for key in session["records"]:
        r = state["reservations"][key]
        # Public envelope intentionally excludes approvals, credit, private
        # exception details, prompts and subscription identifiers.
        item = {k: copy.deepcopy(r[k]) for k in ("candidate", "state", "facts", "startedAt", "finishedAt")}
        if r["state"] in ACTIVE and now-r["startedAt"] > 200:
            # Uncertain provider outcome is a fallback, not endless fake
            # processing. The durable slot/reservation remains held privately.
            item["state"] = "fallback"
        if r["state"] == "verified":
            check_plan(r["facts"], r["proposal"], r["plan"])
            item.update(plan=r["plan"], proposal=r["proposal"], trace=r["trace"], elapsedMs=r["elapsedMs"],
                        providerMode=r["providerMode"], eventToPublicationMs=r["eventToPublicationMs"])
        records.append(item)
    if session["status"] == "running":
        source = store.get(f"{PREFIX}/sources/{session['sourceId']}.json")
        if digest(source) != session["sourceSha256"]:
            return {"status": "unavailable"}
        for c in session["queue"]:
            records.append(dict(candidate=c, state="identified", facts=facts_for(source, c),
                                startedAt=now, finishedAt=None))
    status = "expired" if session["status"] == "running" and now >= session["expiresAt"] else session["status"]
    return dict(schemaVersion="tacticlens.session-feed.v1", sessionId=sid,
                matchId=session["matchId"], seed=session["seed"], engineVersion=session["engineVersion"],
                engineSha256=session["engineSha256"], sourceSha256=session["sourceSha256"],
                status=status, generationEnabled=enabled() and status == "running",
                serviceAvailable=session.get("serviceAvailable", True), clock=clock, speed=session["speed"],
                queued=len(session["queue"]), records=records,
                reservedCalls=session["reservedCalls"], reservedMoments=session["reservedMoments"])
