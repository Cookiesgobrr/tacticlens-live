import asyncio
from api.agent_pipeline import DemoBackend, run_pipeline
from api.simulator import build_match

MATCH = build_match()

def run(backend=None, at=4500):
    return asyncio.run(run_pipeline(MATCH, at, backend))

def test_end_to_end():
    result = run()
    assert result["status"] == "verified"
    assert set(result["insight"]["modes"]) == {"fan", "analyst", "broadcast"}
    assert [t["stage"] for t in result["trace"]] == [
        "Analytics", "Insight", "Evidence gate", "Verification", "Presentation"
    ]

def test_no_future_events():
    assert run(at=4499)["status"] == "waiting"

def test_invented_count_rejected():
    class Bad(DemoBackend):
        async def propose(self, facts):
            p = await super().propose(facts)
            p["recent"] += 1
            return p
    assert run(Bad())["status"] == "rejected"

def test_invented_event_rejected():
    class Bad(DemoBackend):
        async def propose(self, facts):
            p = await super().propose(facts)
            p["evidence_ids"][0] = "NOT-AN-EVENT"
            return p
    assert run(Bad())["status"] == "rejected"

def test_verifier_veto():
    class Veto(DemoBackend):
        async def verify(self, facts, proposal):
            return {"approved": False}
    assert run(Veto())["status"] == "rejected"

def test_generated_numeric_hallucination_falls_back():
    class Bad(DemoBackend):
        async def present(self, facts, proposal):
            p = await super().present(facts, proposal)
            p["fan"] = "The team took 999 shots."
            return p
    result = run(Bad())
    assert result["status"] == "fallback"
    assert "999" not in result["insight"]["modes"]["fan"]

def test_backend_failure_fails_closed():
    class Broken(DemoBackend):
        async def propose(self, facts):
            raise RuntimeError("secret")
    result = run(Broken())
    assert result["status"] == "error"
    assert result["insight"] is None
    assert "secret" not in str(result["trace"])
