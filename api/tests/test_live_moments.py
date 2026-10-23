import asyncio
import json
import os
from pathlib import Path
import subprocess

import pytest

from api.live_moments import generate_once, get_cached


class Store:
    def __init__(self):
        self.data = {}
    def get(self, name):
        return self.data.get(name)
    def claim(self, name):
        if name in self.data:
            return False
        self.data[name] = {"state": "reserved"}
        return True
    def put(self, name, value):
        assert name not in self.data
        self.data[name] = value


@pytest.fixture(scope="module")
def source(tmp_path_factory):
    out = tmp_path_factory.mktemp("approved") / "seed82.json"
    root = Path(__file__).resolve().parents[2]
    subprocess.run(["node", "--experimental-strip-types",
        "web/scripts/export-ai-source.mjs", str(out)],
        cwd=root, check=True, capture_output=True)
    return json.loads(out.read_text())


class Fake:
    def __init__(self, events):
        self.events = events
        self.trace = []
    async def propose(self, facts):
        self.events.append("Insight")
        m = facts["moments"][0]
        ids = [c["id"] for c in m["claims"]]
        return {"cards": [{"id": m["id"], "angle": "score", "claimIds": ids}]}
    async def verify(self, facts, proposal):
        self.events.append("Verification")
        return {"approved": True,
                "checkedMomentIds": [m["id"] for m in facts["moments"]], "issues": []}
    async def present(self, facts, proposal):
        self.events.append("Presentation")
        m = facts["moments"][0]
        self.trace = [{"stage": s, "responseId": f"response-{s}"}
                      for s in ("Insight", "Verification", "Presentation")]
        return {"cards": [{"id": m["id"], "modes": {
            "fan": ["score"], "analyst": ["activity"],
            "club_home": ["team0"], "club_away": ["team1"],
            "player": ["player"] if "player" in proposal["cards"][0]["claimIds"] else ["totals"],
            "broadcast": ["score"]}}]}
    async def close(self):
        self.events.append("Close")


def run(*args, **kwargs):
    return asyncio.run(generate_once(*args, **kwargs))


def test_disabled_never_touches_backend(monkeypatch):
    monkeypatch.delenv("TACTICLENS_LIVE_AI_ENABLED", raising=False)
    called=[]
    outcome=run(Store(),seed=82,at_second=4680.25,
        backend_factory=lambda:called.append("backend"),
        preflight=lambda:called.append("preflight"))
    assert outcome["status"]=="disabled" and not called


def test_unapproved_seed_fails_without_credit(monkeypatch):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25,82/2700,15/2700")
    called=[]
    outcome=run(Store(),seed=987,at_second=2700,
        backend_factory=lambda:called.append("backend"),
        preflight=lambda:called.append("preflight"))
    assert outcome["status"]=="unapproved_seed" and not called


def test_single_moment_cached_and_isolated(monkeypatch, source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    storage=Store()
    storage.data["live/sources/82.json"]=source
    recorded=[]
    approved=[]
    def backend():return Fake(recorded)
    result=run(storage,seed=82,at_second=4680.25,
        backend_factory=backend, preflight=lambda:approved.append("pass"))
    assert result["status"]=="published"
    assert recorded==["Insight","Verification","Presentation","Close"]
    assert approved==["pass"]
    cached=get_cached(storage,82,4680.25)
    assert cached["status"]=="ready"
    assert len(cached["result"]["cards"])==1
    assert cached["result"]["cards"][0]["moment"]["id"]=="SIM-82@4680.25"
    assert run(storage,seed=82,at_second=4680.25,
        backend_factory=lambda:pytest.fail("Should not re-run"),preflight=lambda:None)["status"]=="already_cached"
    assert get_cached(storage,82,4585.25)["status"]=="pending"


def test_operator_guard_and_lock_survive_failure(monkeypatch,source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    store=Store()
    store.data["live/sources/82.json"]=source
    credit=[]
    with pytest.raises(RuntimeError):
        run(store,seed=82,at_second=4680.25,
            preflight=lambda: (_ for _ in ()).throw(RuntimeError("Not a free trial")),
            backend_factory=lambda:credit.append("backend"))
    assert not credit
    assert not any(name.startswith("live/claims/") for name in store.data)
    outcome=run(store,seed=82,at_second=2700,
        preflight=lambda:None,backend_factory=lambda:(_ for _ in ()).throw(RuntimeError("provider failed")))
    assert outcome["status"]=="failed_locked"
    assert run(store,seed=82,at_second=2700,
        preflight=lambda:None,backend_factory=lambda:pytest.fail("Retry should be blocked"))["status"]=="already_reserved"


def test_reject_mismatched_source_before_model(monkeypatch,source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    store=Store()
    store.data["live/sources/15.json"]=source
    with pytest.raises(ValueError):
        run(store,seed=15,at_second=2700,
            backend_factory=lambda:pytest.fail("Wrong seed"),preflight=lambda:pytest.fail("No spend"))


def test_reject_invalid_identity():
    store=Store()
    for seed,time in ((0,2700),(82,-1),(-1,12),(82,5401),(True,100)):
        with pytest.raises(ValueError):
            get_cached(store,seed,time)
