import asyncio

from api.agent_pipeline import DemoBackend
from api.cloud_publish import LOCK_BLOB, RESULT_BLOB, public_feed, publish_once


class Store:
    def __init__(self):
        self.blobs = {}
    def get(self, name):
        return self.blobs.get(name)
    def claim(self, name):
        if name in self.blobs:
            return False
        self.blobs[name] = {"state": "reserved"}
        return True
    def put(self, name, value):
        assert name not in self.blobs
        self.blobs[name] = value


class MockCloudBackend(DemoBackend):
    def __init__(self, record):
        self.record = record
    async def propose(self, facts):
        self.record.append("insight")
        return await super().propose(facts)
    async def verify(self, facts, proposal):
        self.record.append("verification")
        return await super().verify(facts, proposal)
    async def present(self, facts, proposal):
        self.record.append("presentation")
        return await super().present(facts, proposal)


def test_generation_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("TACTICLENS_AI_GENERATION_ENABLED", raising=False)
    store = Store()
    calls = []
    result = asyncio.run(publish_once(store, lambda: MockCloudBackend(calls)))
    assert result["status"] == "disabled"
    assert store.blobs == {}
    assert calls == []


def test_one_time_verification_cache_and_public_read(monkeypatch):
    monkeypatch.setenv("TACTICLENS_AI_GENERATION_ENABLED", "true")
    store = Store()
    calls = []
    first = asyncio.run(publish_once(store, lambda: MockCloudBackend(calls)))
    assert first["status"] == "published"
    assert calls == ["insight", "verification", "presentation"]
    assert LOCK_BLOB in store.blobs and RESULT_BLOB in store.blobs
    feed = public_feed(store)
    assert feed["status"] == "ready"
    assert feed["result"]["insight"]["id"] == "INS-001"
    second = asyncio.run(publish_once(store, lambda: MockCloudBackend(calls)))
    assert second["status"] == "already_published"
    assert len(calls) == 3


def test_concurrent_or_failed_claim_never_invokes_models(monkeypatch):
    monkeypatch.setenv("TACTICLENS_AI_GENERATION_ENABLED", "true")
    store = Store()
    store.claim(LOCK_BLOB)
    calls = []
    result = asyncio.run(publish_once(store, lambda: MockCloudBackend(calls)))
    assert result["status"] == "locked"
    assert calls == []
    assert public_feed(store)["status"] == "pending"


def test_error_leaves_lock_and_no_public_output(monkeypatch):
    monkeypatch.setenv("TACTICLENS_AI_GENERATION_ENABLED", "true")
    store = Store()
    def bad_backend():
        raise RuntimeError("simulated cloud configuration error")
    outcome = asyncio.run(publish_once(store, bad_backend))
    assert outcome["status"] == "error"
    assert LOCK_BLOB in store.blobs
    assert public_feed(store)["status"] == "pending"
    assert asyncio.run(publish_once(store, bad_backend))["status"] == "locked"
