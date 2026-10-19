"""Traceable football insight orchestration.

Offline mode uses deterministic stages, not generative AI.
A Foundry adapter can run distinct Microsoft Agent Framework agents later.
"""
from __future__ import annotations

import re
from typing import Any, Protocol
from api.analytics import detect_insights


class Backend(Protocol):
    async def propose(self, facts: dict) -> dict: ...
    async def verify(self, facts: dict, proposal: dict) -> dict: ...
    async def present(self, facts: dict, proposal: dict) -> dict: ...


class DemoBackend:
    """Free rule-based demonstration with the same handoff contract."""

    async def propose(self, facts: dict) -> dict:
        signal = facts["signal"]
        return {
            "headline": signal["headline"],
            "previous": signal["metric"]["previous"],
            "recent": signal["metric"]["recent"],
            "evidence_ids": list(signal["evidence_ids"]),
            "baseline_ids": list(signal["baseline_ids"]),
        }

    async def verify(self, facts: dict, proposal: dict) -> dict:
        return {"approved": True, "reason": "Rule-based demo review."}

    async def present(self, facts: dict, proposal: dict) -> dict:
        signal = facts["signal"]
        return {"fan": signal["casual"], "analyst": signal["analyst"],
                "broadcast": signal["broadcast"]}


def evidence_gate(facts: dict, proposal: Any) -> tuple[bool, str]:
    """Reject wrong counts, fabricated or omitted evidence, and duplicate IDs."""
    canonical = facts["signal"]
    if not isinstance(proposal, dict):
        return False, "Unstructured proposed insight."
    for field in ("previous", "recent"):
        value = proposal.get(field)
        if type(value) is not int or value != canonical["metric"][field]:
            return False, "Count mismatch in " + field
    for field in ("evidence_ids", "baseline_ids"):
        values = proposal.get(field)
        expected = canonical[field]
        if (not isinstance(values, list) or len(values) != len(expected)
                or not all(isinstance(v, str) for v in values)
                or set(values) != set(expected)):
            return False, "Invalid source event IDs in " + field
    if not isinstance(proposal.get("headline"), str) or not proposal["headline"].strip():
        return False, "Missing headline."
    return True, "Both counts and complete source event sets match."


def verified_presentation(facts: dict, copy: Any) -> dict:
    """Use only source-of-truth numbers and IDs; guard added numeric claims."""
    signal = facts["signal"]
    if not isinstance(copy, dict):
        raise ValueError("Expected structured audience copy.")
    allowed = {str(n) for n in (
        signal["metric"]["previous"], signal["metric"]["recent"],
        signal["metric"]["delta"], 10, 55, 65, 75, 67, 100
    )}
    modes = {}
    for mode in ("fan", "analyst", "broadcast"):
        text = copy.get(mode)
        if not isinstance(text, str) or not text.strip() or len(text) > 900:
            raise ValueError("Missing or excessive text in " + mode)
        if set(re.findall(r"\d+", text)) - allowed:
            raise ValueError("Unverified number in " + mode)
        modes[mode] = text.strip()
    return {
        "id": signal["id"], "headline": signal["headline"],
        "at_second": signal["at_second"], "metric": signal["metric"],
        "method": signal["method"], "evidence_ids": signal["evidence_ids"],
        "baseline_ids": signal["baseline_ids"], "modes": modes,
    }


async def run_pipeline(
    match: dict, at_second: int = 4500,
    backend: Backend | None = None, provider: str = "offline-demo",
) -> dict:
    """Insight -> code evidence gate -> independent review -> audience copy."""
    at_second = max(0, min(int(at_second), match["duration_seconds"]))
    visible = [e for e in match["events"] if e["second"] <= at_second]
    insights = [i for i in detect_insights(visible) if i["at_second"] <= at_second]
    trace: list[dict[str, str]] = []

    def log(stage: str, status: str, detail: str) -> None:
        trace.append({"stage": stage, "status": status, "detail": detail})

    if not insights:
        log("Insight", "waiting", "No complete tactical signal at this replay time.")
        return {"status": "waiting", "provider": provider,
                "at_second": at_second, "insight": None, "trace": trace}

    facts = {"match_id": match["match_id"], "at_second": at_second, "signal": insights[0]}
    agent = backend or DemoBackend()
    log("Analytics", "complete", "Signal calculated from available synthetic events.")
    try:
        proposal = await agent.propose(facts)
        log("Insight", "complete", "Candidate produced with cited evidence.")
        valid, explanation = evidence_gate(facts, proposal)
        if not valid:
            log("Evidence gate", "rejected", explanation)
            return {"status": "rejected", "provider": provider,
                    "at_second": at_second, "insight": None, "trace": trace}
        log("Evidence gate", "approved", explanation)

        review = await agent.verify(facts, proposal)
        if not isinstance(review, dict) or review.get("approved") is not True:
            log("Verification", "rejected", "Reviewer vetoed the claim.")
            return {"status": "rejected", "provider": provider,
                    "at_second": at_second, "insight": None, "trace": trace}
        log("Verification", "approved", "Review stage approved the evidenced claim.")

        try:
            result = verified_presentation(facts, await agent.present(facts, proposal))
            log("Presentation", "complete", "Audience copy passed numeric checks.")
            status = "verified"
        except (ValueError, TypeError) as error:
            log("Presentation", "rejected", str(error))
            result = verified_presentation(facts, await DemoBackend().present(facts, proposal))
            log("Fallback", "complete", "Returned labelled deterministic copy.")
            status = "fallback"
        return {"status": status, "provider": provider,
                "at_second": at_second, "insight": result, "trace": trace}
    except Exception as error:
        log("Runtime", "failed", type(error).__name__ + "; output suppressed.")
        return {"status": "error", "provider": provider,
                "at_second": at_second, "insight": None, "trace": trace}
