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
and player whenever available. Always include at least one of chance, sequence,
activity or totals. Claim IDs are the KEYS of facts.claims (for example "event",
"score", "chance"), never SIM source-event IDs. Copy facts.candidate.id exactly.
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
from ONLY the verified selected claim IDs. Return the exact schema's JSON object.
Each edition has named lead, context and support slots (broadcast has two slots).
Claim IDs are KEYS such as event, player, chance, totals, never SIM source IDs.
Choose the most relevant measured context and human/team support for each audience.
Fan: event first, measured context, then the player story. Analyst: measured detail
first, then complementary evidence. Club editions lead with their own team's facts.
Player leads with the actual actor. Broadcast is concise: event then score/context.
Slots are compiled in that order, with duplicates removed. Code independently checks
every selected claim and required attribution. Do not write unrestricted prose."""


def output_schema(stage, payload):
    """Provider-enforced closed shape; independent semantic gates still apply."""
    facts = payload["facts"]
    identity = {"type": "string", "enum": [facts["candidate"]["id"]]}
    claims = {"type": "string", "enum": list(facts["claims"])}
    def obj(properties):
        return dict(type="object", properties=properties, required=list(properties), additionalProperties=False)
    if stage == "Insight":
        return obj(dict(id=identity, angle=claims, claimIds=dict(type="array", items=claims)))
    if stage == "Verification":
        return obj(dict(approved=dict(type="boolean"), checkedId=identity,
                        issues=dict(type="array", items=dict(type="string"))))
    ids = payload["verifiedProposal"]["claimIds"]
    selected = {"type": "string", "enum": ids}
    measured = {"type": "string", "enum": [x for x in ids if x in ("chance", "sequence", "activity", "totals")]}
    if not measured["enum"]:
        raise ValueError("Selected analysis has no measured context")
    fixed = lambda name: {"type": "string", "enum": [name]}
    modes = {}
    for mode in ("fan", "analyst", "club_home", "club_away", "player", "broadcast"):
        lead = {"fan": fixed("event"), "analyst": measured, "club_home": fixed("team0"),
                "club_away": fixed("team1"), "player": fixed("player" if "player" in ids else "score"),
                "broadcast": fixed("event")}[mode]
        fields = dict(lead=lead, context=measured if mode == "fan" else selected)
        if mode != "broadcast":
            fields["support"] = fixed("player") if mode == "fan" and facts["candidate"].get("kind") == "goal" else selected
        modes[mode] = obj(fields)
    return obj(dict(id=identity, modes=obj(modes)))


def compile_editions(raw, proposal):
    """Only reorder model-chosen permitted IDs; add no claims or factual text."""
    modes = ("fan", "analyst", "club_home", "club_away", "player", "broadcast")
    if not isinstance(raw, dict) or set(raw) != {"id", "modes"} or raw["id"] != proposal["id"] or set(raw["modes"]) != set(modes):
        raise ValueError("Wrong structured edition identity")
    result = {}
    for mode in modes:
        slots = raw["modes"][mode]
        keys = ("lead", "context") if mode == "broadcast" else ("lead", "context", "support")
        if not isinstance(slots, dict) or set(slots) != set(keys) or any(slots[k] not in proposal["claimIds"] for k in keys):
            raise ValueError("Unverified structured edition")
        result[mode] = list(dict.fromkeys(slots[k] for k in keys))
    return dict(id=raw["id"], modes=result)


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
        schema = output_schema(stage, payload)
        # UTF-8 bytes conservatively bound token count; account for instructions
        # and generous message/protocol overhead, not just the user payload.
        input_bound = len(message.encode()) + len(self.instructions[stage].encode()) + len(json.dumps(schema).encode()) + 1024
        if len(message.encode()) > self.limits["inputBytesPerCall"] or input_bound > self.limits["inputTokensPerCall"]:
            raise ValueError("Input/token budget exceeded before inference")
        self.before_call(stage)  # atomic durable attempt BEFORE submitting transport
        self.attempts.append(stage)
        start = time.monotonic()
        response = await self.agents[stage].run(message, options={
            "max_tokens": self.limits["outputTokensPerCall"], "temperature": 0,
            "response_format": {"type": "json_schema", "json_schema": {
                "name": f"TacticLensSession{stage}", "strict": True,
                "schema": schema}}, "store": False})
        usage = response.usage_details or {}
        # Missing usage is rejected, never silently reported as zero.
        self.trace.append(dict(stage=stage, agent=f"TacticLensSession{stage}", responseId=response.response_id,
            inputTokens=usage.get("input_token_count"), outputTokens=usage.get("output_token_count"),
            elapsedMs=round((time.monotonic()-start)*1000)))
        answer = decode_json_object(response.text)
        self.responses.append(dict(stage=stage, responseId=response.response_id, output=answer))
        return answer

    async def present(self, facts, proposal):
        raw = await self._ask("Presentation", {"facts": facts, "verifiedProposal": proposal})
        return compile_editions(raw, proposal)
