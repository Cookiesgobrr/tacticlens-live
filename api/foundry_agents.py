"""Optional, real Microsoft Agent Framework agents backed by Foundry.

The default app/HTTP API continues using the free, deterministic DemoBackend.
No cloud calls are made until an explicit CLI invokes one of these agents.
"""
from __future__ import annotations

import json
import os
from typing import Any


INSIGHT_INSTRUCTIONS = """You draft evidence-backed insights for a fictional football match.
You will receive JSON containing independently computed match statistics.
Return ONLY one JSON object with EXACTLY these fields:
headline (string), previous (integer), recent (integer),
evidence_ids (array of strings), baseline_ids (array of strings).
Copy counts and every listed event ID exactly. Do not add or omit IDs.
Use only supplied event facts. Never invent a causal tactical explanation.
Do not include Markdown or additional prose."""

VERIFIER_INSTRUCTIONS = """You independently evaluate a proposed football insight.
The input is JSON with canonical match facts and a proposed insight.
Reject invented source IDs, incorrect counts, unsupported tactical causes,
claims not proven by supplied synthetic events, or missing evidence.
Return ONLY JSON with boolean approved and string reason fields.
Do not include Markdown or any other keys."""

PRESENTER_INSTRUCTIONS = """You receive a previously evidence-checked football insight.
Write three audience-specific versions grounded ONLY in the supplied facts.
Return ONLY JSON with three string keys: fan, analyst, broadcast.
fan: one accessible sentence; analyst: one precise comparison with context;
broadcast: a concise uppercase graphic headline.
Do not invent numbers, events, timings, causal explanations, or players.
All metrics must match the supplied fact table. No Markdown or other keys."""


def decode_json_object(value: str) -> dict[str, Any]:
    """Parse a JSON object from an agent response. Never eval untrusted text."""
    if not isinstance(value, str):
        raise ValueError("Agent output is not text.")
    stripped = value.strip()
    fence = chr(96) * 3
    if stripped.startswith(fence):
        lines = stripped.splitlines()
        if len(lines) < 3 or not lines[-1].strip().startswith(fence):
            raise ValueError("Unclosed Markdown code fence.")
        stripped = "\n".join(lines[1:-1]).strip()
    parsed = json.loads(stripped)
    if not isinstance(parsed, dict):
        raise ValueError("Agent must return one JSON object.")
    return parsed


class FoundryAgentBackend:
    """Three distinct Agent Framework agents; injection permits free CI tests.

    Construct with agent_overrides for fake SDK agents. Otherwise the class
    requires explicit FOUNDRY_PROJECT_ENDPOINT / FOUNDRY_MODEL and a locally
    authenticated Azure CLI session, but makes no requests at construction.
    """

    def __init__(self, agent_overrides: dict[str, Any] | None = None) -> None:
        if agent_overrides is not None:
            if set(agent_overrides) != {"insight", "verification", "presentation"}:
                raise ValueError("Provide insight, verification, and presentation agents.")
            self.agents = agent_overrides
            return

        endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT", "").strip()
        model = os.environ.get("FOUNDRY_MODEL", "").strip()
        if not endpoint or not model:
            raise RuntimeError(
                "Foundry is not configured. Set FOUNDRY_PROJECT_ENDPOINT and "
                "FOUNDRY_MODEL after confirming Azure credits and quota."
            )
        from agent_framework import Agent
        from agent_framework.foundry import FoundryChatClient
        from azure.identity import AzureCliCredential

        client = FoundryChatClient(
            project_endpoint=endpoint,
            model=model,
            credential=AzureCliCredential(),
        )
        self.agents = {
            "insight": Agent(
                client=client, name="TacticLensInsight",
                instructions=INSIGHT_INSTRUCTIONS,
            ),
            "verification": Agent(
                client=client, name="TacticLensVerifier",
                instructions=VERIFIER_INSTRUCTIONS,
            ),
            "presentation": Agent(
                client=client, name="TacticLensPresenter",
                instructions=PRESENTER_INSTRUCTIONS,
            ),
        }

    async def _ask(self, stage: str, message: dict[str, Any]) -> dict[str, Any]:
        response = await self.agents[stage].run(json.dumps(message, ensure_ascii=False))
        return decode_json_object(response.text)

    async def propose(self, facts: dict) -> dict:
        return await self._ask("insight", {"facts": facts})

    async def verify(self, facts: dict, proposal: dict) -> dict:
        return await self._ask(
            "verification", {"facts": facts, "proposed_insight": proposal}
        )

    async def present(self, facts: dict, proposal: dict) -> dict:
        return await self._ask(
            "presentation", {"facts": facts, "verified_insight": proposal}
        )
