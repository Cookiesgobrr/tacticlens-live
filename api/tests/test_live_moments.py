import asyncio
import json
import os
from pathlib import Path
import subprocess

import pytest

from api.live_moments import generate_once, get_cached
from api.live_approval import APPROVAL_PATH, source_sha256, AUTHORIZATION_ID
from datetime import datetime, timezone, timedelta


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


def approval(source):
    now=datetime.now(timezone.utc)
    return dict(schemaVersion="tacticlens.live-approval.v1",authorizationId=AUTHORIZATION_ID,moment="82/4680.25",
        sourceSha256=source_sha256(source),engineSha256="a"*64,subscriptionId="test-subscription",subscriptionType="FreeTrial",spendingLimit="On",
        remainingCredit=dict(currency="USD",value=200),creditsCheckedAt=now.isoformat(),expiresAt=(now+timedelta(minutes=10)).isoformat(),
        limits=dict(modelCalls=3,outputTokensPerCall=1000,inputBytesPerCall=16000,automaticRetries=0))


@pytest.fixture(autouse=True)
def protected_environment(monkeypatch,source):
    monkeypatch.setenv("TACTICLENS_LIVE_SOURCE_SHA256",source_sha256(source))
    monkeypatch.setenv("TACTICLENS_AZURE_SUBSCRIPTION_ID","test-subscription")


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
        self.trace = [{"stage": s, "responseId": f"response-{s}", "status":"complete", "inputTokens":10,"outputTokens":10,"elapsedMs":1}
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
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25")
    called=[]
    outcome=run(Store(),seed=987,at_second=2700,
        backend_factory=lambda:called.append("backend"),
        preflight=lambda:called.append("preflight"))
    assert outcome["status"]=="not_approved_for_generation" and not called


def test_single_moment_cached_and_isolated(monkeypatch, source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25")
    storage=Store()
    storage.data["live/sources/82.json"]=source
    storage.data[APPROVAL_PATH]=approval(source)
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
    assert len(cached["result"]["pack"]["cards"])==1
    assert cached["result"]["pack"]["cards"][0]["moment"]["id"]=="SIM-82@4680.25"
    assert run(storage,seed=82,at_second=4680.25,
        backend_factory=lambda:pytest.fail("Should not re-run"),preflight=lambda:None)["status"]=="already_cached"
    assert get_cached(storage,82,4585.25)["status"]=="unavailable"


def test_operator_guard_and_lock_survive_failure(monkeypatch,source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25")
    store=Store()
    store.data["live/sources/82.json"]=source
    store.data[APPROVAL_PATH]=approval(source)
    credit=[]
    with pytest.raises(RuntimeError):
        run(store,seed=82,at_second=4680.25,
            preflight=lambda: (_ for _ in ()).throw(RuntimeError("Not a free trial")),
            backend_factory=lambda:credit.append("backend"))
    assert not credit
    assert not any(name.startswith("live/claims/") for name in store.data)
    outcome=run(store,seed=82,at_second=4680.25,
        preflight=lambda:None,backend_factory=lambda:(_ for _ in ()).throw(RuntimeError("provider failed")))
    assert outcome["status"]=="failed_locked"
    assert run(store,seed=82,at_second=4680.25,
        preflight=lambda:None,backend_factory=lambda:pytest.fail("Retry should be blocked"))["status"]=="already_reserved"


def test_reject_mismatched_source_before_model(monkeypatch,source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25")
    store=Store()
    store.data["live/sources/15.json"]=source
    assert run(store,seed=15,at_second=2700,
        backend_factory=lambda:pytest.fail("Wrong seed"),preflight=lambda:pytest.fail("No spend"))["status"]=="not_approved_for_generation"



def test_reject_invalid_identity():
    store=Store()
    for seed,time in ((0,2700),(82,-1),(-1,12),(82,5401),(True,100)):
        with pytest.raises(ValueError):
            get_cached(store,seed,time)


@pytest.mark.parametrize("kind",["source","hash","credits","expiry","budget","moment"])
def test_approval_mutations_never_open_a_model(monkeypatch,source,kind):
    import copy
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25")
    store=Store();store.data["live/sources/82.json"]=copy.deepcopy(source)
    permit=approval(source);store.data[APPROVAL_PATH]=permit
    if kind=="source": store.data["live/sources/82.json"]["players"][9]["name"]="Invented scorer"
    if kind=="hash": permit["sourceSha256"]="b"*64
    if kind=="credits": permit["remainingCredit"]["value"]=0
    if kind=="expiry": permit["expiresAt"]=(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()
    if kind=="budget": permit["limits"]["modelCalls"]=4
    if kind=="moment": permit["moment"]="82/4680"
    with pytest.raises(ValueError):
        run(store,seed=82,at_second=4680.25,backend_factory=lambda:pytest.fail("No model"),preflight=lambda:pytest.fail("No spend"))
    assert not any(k.startswith("live/claims/") for k in store.data)


def test_more_than_one_moment_cannot_expand_authorization(monkeypatch,source):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_LIVE_APPROVED_MOMENTS","82/4680.25,82/2700")
    assert run(Store(),seed=82,at_second=4680.25,backend_factory=lambda:pytest.fail("No model"),preflight=lambda:pytest.fail("No spend"))["status"]=="not_approved_for_generation"


def test_all_cloud_python_modules_parse_before_any_deployment():
    import ast
    root=Path(__file__).resolve().parents[2]
    for path in [*root.joinpath("api").rglob("*.py"), root/"function_app.py"]:
        ast.parse(path.read_text(),filename=str(path))
