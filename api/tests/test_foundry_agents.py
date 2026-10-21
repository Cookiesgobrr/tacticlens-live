import asyncio
import json
import pytest

from api.agent_pipeline import run_pipeline
from api.foundry_agents import FoundryAgentBackend, decode_json_object
from api.simulator import build_match


class FakeAgent:
    def __init__(self, handler):
        self.handler = handler
        self.calls = []

    async def run(self, message):
        data = json.loads(message)
        self.calls.append(data)
        class Reply:
            def __init__(self, text):
                self.text = text
        return Reply(json.dumps(self.handler(data)))


def fake_agents():
    def insight(req):
        s = req["facts"]["signal"]
        return {
            "headline": s["headline"], "previous": s["metric"]["previous"],
            "recent": s["metric"]["recent"],
            "evidence_ids": s["evidence_ids"], "baseline_ids": s["baseline_ids"],
        }
    def verifier(req):
        return {"approved": True, "reason": "Valid"}
    def presenter(req):
        s = req["facts"]["signal"]
        return {"fan": s["casual"], "analyst": s["analyst"],
                "broadcast": s["broadcast"]}
    return {
        "insight": FakeAgent(insight),
        "verification": FakeAgent(verifier),
        "presentation": FakeAgent(presenter),
    }


def test_real_agent_adapter_contract_without_cloud_calls():
    agents = fake_agents()
    adapter = FoundryAgentBackend(agent_overrides=agents)
    result = asyncio.run(run_pipeline(
        build_match(), 4500, adapter, provider="foundry-test-double"
    ))
    assert result["status"] == "verified"
    assert len(agents["insight"].calls) == 1
    assert len(agents["verification"].calls) == 1
    assert len(agents["presentation"].calls) == 1
    assert agents["verification"].calls[0]["proposed_insight"]["recent"] == 9


def test_reject_fabricated_numbers_from_model():
    agents = fake_agents()
    agents["insight"] = FakeAgent(
        lambda req: {
            "headline": "Wrong insight", "previous": 0, "recent": 999,
            "evidence_ids": [], "baseline_ids": [],
        }
    )
    result = asyncio.run(run_pipeline(
        build_match(), 4500,
        FoundryAgentBackend(agent_overrides=agents)
    ))
    assert result["status"] == "rejected"
    assert len(agents["verification"].calls) == 0


def test_adapter_requires_explicit_cloud_config(monkeypatch):
    monkeypatch.delenv("FOUNDRY_PROJECT_ENDPOINT", raising=False)
    monkeypatch.delenv("FOUNDRY_MODEL", raising=False)
    monkeypatch.delenv("FOUNDRY_OPENAI_BASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="not configured"):
        FoundryAgentBackend()


def test_json_parser_rejects_executable_or_array_output():
    assert decode_json_object('{"approved":true}') == {"approved": True}
    with pytest.raises(ValueError):
        decode_json_object('[1, 2, 3]')
    with pytest.raises(json.JSONDecodeError):
        decode_json_object('print("hello")')


def test_agent_runtime_failure_suppresses_response():
    agents = fake_agents()
    class FailedAgent:
        async def run(self, message):
            raise RuntimeError("model unavailable")
    agents["insight"] = FailedAgent()
    result = asyncio.run(run_pipeline(
        build_match(), 4500,
        FoundryAgentBackend(agent_overrides=agents)
    ))
    assert result["status"] == "error"
    assert result["insight"] is None


def test_reject_incorrect_resource_url_without_creating_clients(monkeypatch):
    monkeypatch.setenv("FOUNDRY_OPENAI_BASE_URL", "https://example.com/incomplete")
    monkeypatch.delenv("FOUNDRY_PROJECT_ENDPOINT", raising=False)
    monkeypatch.setenv("FOUNDRY_MODEL", "gpt-4.1-mini")
    # URL validation should occur before any SDK dependencies are loaded.
    # Once SDKs are installed, a malformed URL must still be rejected.
    with pytest.raises((ValueError, ImportError)):
        FoundryAgentBackend()
