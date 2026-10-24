"""Three real Microsoft Agent Framework agents; no retries or public invocation.

Presentation chooses evidence and ordering, NOT arbitrary factual paragraphs.
The audited renderer supplies original prose. This narrower contract is deliberate:
numeric regexes and an LLM review cannot establish arbitrary text as factual.
"""
import json
import time

from api.eleven_agents import ElevenFoundryBackend
from api.foundry_agents import decode_json_object

INSIGHT = """You are TacticLens Session Insight. Use only this fictional match event prefix.
Select the most meaningful factual editorial angle and evidence. Return JSON only:
{\"id\":\"exact candidate.id\",\"angle\":\"existing claim ID\",\"claimIds\":[\"existing IDs\"]}.
Choose 4 to 9 unique claim IDs. Include event, score, team0, team1, your angle,
and player whenever available. Consider chance, sequence, activity and totals.
Do not invent causation, tracking, territory, atmosphere or future information.
claims maps allowed IDs to exact source event IDs. stats contains prefix counts;
shot contains the pre-outcome synthetic probability and geometry. An angle is
an editorial focus, not proof of a tactical cause."""

VERIFICATION = """You are the independent TacticLens Session Verification agent.
Audit the proposed analysis against the supplied canonical prefix. Check the exact
candidate ID, seed, match, clock, actors, score, shot geometry, source IDs and xG.
Reject future knowledge, unavailable claims and unmeasured tactical explanations.
Return JSON only {\"approved\":true or false,\"checkedId\":\"exact candidate.id\",\"issues\":[]}.
Provide short issues when rejecting. Code independently rebuilds every fact;
your approval does not override that gate. Do not write commentary."""

PRESENTATION = """You are TacticLens Session Presentation. Compose six distinct editions
from ONLY the verified selected claim IDs. Return JSON only:
{\"id\":\"exact candidate.id\",\"modes\":{\"fan\":[\"IDs\"],\"analyst\":[\"IDs\"],
\"club_home\":[\"IDs\"],\"club_away\":[\"IDs\"],\"player\":[\"IDs\"],\"broadcast\":[\"IDs\"]}}.
Each list contains 1 to 5 unique chosen IDs. Fan: event first, score and player
story, substantial coverage for goals. Analyst: chance geometry, measured sequence,
activity and totals; fan and analyst lists MUST differ. Home supporters must
include team0, away supporters team1. Player MUST include player when available,
otherwise score for a lifecycle summary. Fan and broadcast MUST include event.
Broadcast: concise event then score. Original audited prose is compiled by code;
do not add free text, claims, predictions or fabricated context."""


class SessionFoundryBackend(ElevenFoundryBackend):
    provider = "microsoft-foundry"
    def __init__(self, limits, before_call, *, credential=None, async_client=None):
        from azure.identity import ManagedIdentityCredential
        from agent_framework import Agent
        from agent_framework.openai import OpenAIChatClient
        super().__init__(credential=credential or ManagedIdentityCredential(), async_client=async_client)
        self.limits, self.before_call = limits, before_call
        self.instructions = dict(Insight=INSIGHT, Verification=VERIFICATION, Presentation=PRESENTATION)
        client = OpenAIChatClient(model="gpt-4.1-mini", async_client=self.http)
        self.agents = {stage: Agent(client=client, name=f"TacticLensSession{stage}", instructions=instructions)
                       for stage, instructions in self.instructions.items()}

    async def _ask(self, stage, payload):
        if len(self.attempts) >= 3 or stage != ("Insight", "Verification", "Presentation")[len(self.attempts)]:
            raise RuntimeError("Three-call ceiling")
        message = "Return JSON only.\n" + json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        # UTF-8 bytes conservatively bound token count; account for instructions
        # and generous message/protocol overhead, not just the user payload.
        input_bound = len(message.encode()) + len(self.instructions[stage].encode()) + 1024
        if len(message.encode()) > self.limits["inputBytesPerCall"] or input_bound > self.limits["inputTokensPerCall"]:
            raise ValueError("Input/token budget exceeded before inference")
        self.before_call(stage)  # atomic durable attempt BEFORE submitting transport
        self.attempts.append(stage)
        start = time.monotonic()
        response = await self.agents[stage].run(message, options={
            "max_tokens": self.limits["outputTokensPerCall"], "temperature": 0,
            "response_format": {"type": "json_object"}, "store": False})
        usage = response.usage_details or {}
        # Missing usage is rejected, never silently reported as zero.
        self.trace.append(dict(stage=stage, agent=f"TacticLensSession{stage}", responseId=response.response_id,
            inputTokens=usage.get("input_token_count"), outputTokens=usage.get("output_token_count"),
            elapsedMs=round((time.monotonic()-start)*1000)))
        answer = decode_json_object(response.text)
        self.responses.append(dict(stage=stage, responseId=response.response_id, output=answer))
        return answer
