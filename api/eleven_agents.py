"""Bounded Microsoft Agent Framework agents for the new 11v11 contract."""
import json
import time
from api.foundry_agents import decode_json_object

INSIGHT = """You are TacticLens's Insight agent. Analyse only the supplied fictional 11v11 event facts.
Select the most useful evidence for explaining each moment. Never invent a fact, tactical cause, player or probability.
Return ONLY JSON {"cards":[{"id":"exact moment id","angle":"one allowed claim id","claimIds":["existing claim ids"]}]}.
Include every moment in input order. Allowed angle: score,chance,sequence,activity,run,player, only if that claim exists.
Choose 5 to 10 unique claimIds per moment, including score, team0, team1 and activity; include player whenever available.
Also select goal, chance, sequence and run when useful. Include the angle's claim. We will reject IDs not in that moment.
An angle is an editorial focus, not proof of causation. Claims contain actual source SIM-82 event IDs and prefix-only statistics."""

VERIFICATION = """You are the independent TacticLens Verification agent. Review the proposed editorial selections against the canonical facts.
For EVERY moment check matchId/seed, availability time, source event IDs, actor attribution, pre-outcome shot probability and statistical checks.
Reject any proposed claim or angle absent from that exact moment, future knowledge, or tactical causation beyond recorded event sequences.
The code has independently recalculated counts and xG; your approval cannot override that evidence gate.
Return ONLY JSON {"approved":true or false,"checkedMomentIds":["every exact moment id in input order"],"issues":[]}.
If you find any defect set approved false and provide issues as short strings. Do not write a narrative."""

PRESENTATION = """You are TacticLens's Presentation agent. Create differentiated narrative compositions for each verified moment.
This is constrained factual generation: select and order claim IDs; canonical factual sentences will be rendered verbatim by code.
No free-form factual prose is accepted. Return ONLY JSON {"cards":[{"id":"exact moment id","modes":{
"fan":["claim ids"],"analyst":["claim ids"],"club_home":["claim ids"],"club_away":["claim ids"],"player":["claim ids"],"broadcast":["claim ids"]}}]}.
Include every moment in input order. Each mode has 1 to 3 unique IDs selected by the Insight agent for that moment.
fan: score and human story/scoring run. analyst: shot geometry/activity/sequence and limitations. These two lists MUST differ.
club_home: Northport context (include team0 or score). club_away: Southbridge context (include team1 or score).
player: include player whenever selected, then chance or sequence. broadcast: concise scoreboard or goal composition.
Do not add facts, extra fields, IDs, predictions or causal claims. Evidence sentences are audited; your job is relevance, tone through selection, and ordering."""


class ElevenFoundryBackend:
    def __init__(self):
        from agent_framework import Agent
        from agent_framework.openai import OpenAIChatClient
        from azure.identity import AzureCliCredential
        from openai import AsyncOpenAI
        token = AzureCliCredential(process_timeout=30).get_token("https://cognitiveservices.azure.com/.default").token
        self.http = AsyncOpenAI(base_url="https://tarunjacob2927-8313-resource.services.ai.azure.com/openai/v1",
            api_key=token, max_retries=0, timeout=60)
        client = OpenAIChatClient(model="gpt-4.1-mini", async_client=self.http)
        self.agents = {stage: Agent(client=client, name=f"TacticLens11{stage}", instructions=instructions)
            for stage, instructions in [("Insight", INSIGHT), ("Verification", VERIFICATION), ("Presentation", PRESENTATION)]}
        self.trace, self.responses = [], []

    async def _ask(self, stage, payload):
        if len(self.trace) >= 3:
            raise RuntimeError("Three-call ceiling reached")
        # Azure JSON mode requires "JSON" in an input message, even when the
        # separate instructions field already requires JSON.
        message = "Return JSON only.\n" + json.dumps(payload, separators=(",", ":"))
        if len(message) > 160000:
            raise ValueError("Input budget exceeded")
        start = time.monotonic()
        response = await self.agents[stage].run(message,
            options={"max_tokens": 6000, "temperature": 0, "response_format": {"type": "json_object"}, "store": False})
        usage = response.usage_details or {}
        self.trace.append(dict(stage=stage, agent=f"TacticLens11{stage}", status="complete", responseId=response.response_id,
            inputTokens=usage.get("input_token_count", 0), outputTokens=usage.get("output_token_count", 0),
            elapsedMs=round((time.monotonic()-start)*1000)))
        answer = decode_json_object(response.text)
        self.responses.append(dict(stage=stage, responseId=response.response_id, output=answer))
        return answer

    async def propose(self, facts): return await self._ask("Insight", {"facts": facts})
    async def verify(self, facts, proposal): return await self._ask("Verification", {"facts": facts, "proposal": proposal})
    async def present(self, facts, proposal): return await self._ask("Presentation", {"facts": facts, "verifiedProposal": proposal})
    async def close(self): await self.http.close()
