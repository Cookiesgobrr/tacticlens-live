"""All tests here are OFFLINE. Fake provider traces are explicitly labelled."""
import asyncio
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch

from api.live_event_facts import validate_source, detect, facts_for, check_proposal, check_plan, digest
from api.live_sessions import (PREFIX, LEDGER, start_session, pulse, public_session, stop_session,
                               transaction, approval_for)

ROOT = Path(__file__).resolve().parents[2]
NOW = 1792800000.0
SID = 'offline-session-82'


class MemoryStore:
    def __init__(self):
        self.data, self.version, self.lock = {}, 0, threading.Lock()
    def get(self, name):
        with self.lock:
            return copy.deepcopy(self.data.get(name))
    def snapshot(self, name):
        with self.lock:
            return copy.deepcopy(self.data.get(name)), self.version if name in self.data else None
    def compare_and_swap(self, name, etag, value):
        with self.lock:
            expected = self.version if name in self.data else None
            if etag != expected:
                return False
            self.data[name] = copy.deepcopy(value)
            self.version += 1
            return True


class FakeBackend:
    provider = 'offline-mock'
    calls, seen, fail_stage, corrupt = [], [], None, None
    def __init__(self, limits, before):
        self.limits, self.before, self.trace = limits, before, []
    async def call(self, stage, facts):
        self.before(stage)
        self.calls.append(stage)
        self.seen.append(copy.deepcopy(facts))
        await asyncio.sleep(0)
        if self.fail_stage == stage:
            raise TimeoutError('offline timeout')
        self.trace.append(dict(stage=stage, responseId=f'mock-response-{len(self.calls)}', inputTokens=80, outputTokens=30, elapsedMs=1))
    async def propose(self, facts):
        await self.call('Insight', facts)
        result=dict(id=facts['candidate']['id'], angle='event', claimIds=list(facts['claims']))
        if self.corrupt == 'proposal':
            result['claimIds'].append('invented')
        return result
    async def verify(self, facts, proposal):
        await self.call('Verification', facts)
        return dict(approved=self.corrupt!='review', checkedId=facts['candidate']['id'], issues=[])
    async def present(self, facts, proposal):
        await self.call('Presentation', facts)
        result=dict(id=facts['candidate']['id'],modes=dict(fan=['event','score'],analyst=['totals','activity'],
            club_home=['event','team0'],club_away=['event','team1'],player=['player'] if facts['actor'] else ['score'],broadcast=['event']))
        if self.corrupt == 'text':
            result['unrestrictedText']='Invented player scores 99 goals'
        return result
    async def close(self):
        pass


def export(seed):
    result=subprocess.run(['node','--experimental-strip-types','web/scripts/export-session-source.mjs',f'--seed={seed}'],
                          cwd=ROOT,check=True,capture_output=True,text=True)
    return json.loads(result.stdout)


def setup(store, source, sid=SID):
    limits=dict(moments=15,calls=45,inputTokensPerCall=16000,outputTokensPerCall=1000,inputBytesPerCall=12000,microUsd=1000000,speed=60)
    approval=dict(schemaVersion='tacticlens.session-approval.v1',id=sid,ownerApproved=True,
                  sourceId=f'approved-{source["seed"]}',sourceSha256=digest(source),engineSha256=source['engineSha256'],seed=source['seed'],
                  subscriptionId='offline-subscription',subscriptionType='FreeTrial',spendingLimit='On',creditsCheckedAt=NOW,
                  expiresAt=NOW+1800,remainingCreditMicroUsd=200000000,limits=limits,
                  inputRateMicroUsdPerMillion=400000,outputRateMicroUsdPerMillion=1600000)
    store.data[f'{PREFIX}/sources/{approval["sourceId"]}.json']=copy.deepcopy(source)
    store.data[f'{PREFIX}/approvals/{sid}.json']=approval
    return approval


class SessionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=export(82)
        cls.other=export(2027)
    def setUp(self):
        self.store=MemoryStore()
        self.approval=setup(self.store,self.source)
        self.env=patch.dict(os.environ,dict(TACTICLENS_SESSION_AI_ENABLED='true',TACTICLENS_SESSION_APPROVAL_IDS=SID,
            TACTICLENS_SESSION_PUBLIC_IDS=SID,TACTICLENS_AZURE_SUBSCRIPTION_ID='offline-subscription',
            TACTICLENS_SESSION_GLOBAL_LIMITS=json.dumps(dict(calls=45,inputTokens=720000,outputTokens=45000,microUsd=1000000,activeSessions=1,concurrency=1))))
        self.env.start();self.addCleanup(self.env.stop)
        FakeBackend.calls=[];FakeBackend.seen=[];FakeBackend.fail_stage=None;FakeBackend.corrupt=None
    def start(self):
        return start_session(self.store,SID,now=NOW)
    def tick(self,at):
        return asyncio.run(pulse(self.store,SID,backend_factory=FakeBackend,preflight=lambda:None,now=NOW+at/60))
    def feed(self):
        return public_session(self.store,SID,now=NOW+90)
    def test_disabled_never_touches_store_or_backend(self):
        os.environ['TACTICLENS_SESSION_AI_ENABLED']='false'
        self.assertEqual(start_session(None,SID)['status'],'disabled')
        self.assertEqual(asyncio.run(pulse(None,SID,backend_factory=None,preflight=None))['status'],'disabled')
        self.assertEqual(FakeBackend.calls,[])
    def test_source_integrity_and_seeds(self):
        for source in (self.source,self.other):
            validate_source(source)
            self.assertGreater(len(detect(source,5400)),8)
            self.assertEqual(detect(source,0),[])
            bad=copy.deepcopy(source);bad['events'][0]['player']=21
            with self.assertRaises(ValueError):validate_source(bad)
        self.assertIn('-F2',self.other['matchId'])
    def test_source_hash_and_credit_fail_closed(self):
        self.approval['spendingLimit']='Off'
        with self.assertRaises(ValueError):self.start()
        self.approval['spendingLimit']='On'
        self.store.data[f'{PREFIX}/sources/approved-82.json']['events'][0]['text']='tampered'
        with self.assertRaises(ValueError):self.start()
        self.assertEqual(FakeBackend.calls,[])
    def test_no_browser_timestamp_or_restart(self):
        self.assertEqual(self.start()['status'],'started')
        self.assertEqual(self.start()['status'],'existing')
        self.assertEqual(self.tick(0)['status'],'idle')
        self.assertEqual(len(self.store.data[LEDGER]['sessions']),1)
        with self.assertRaises(ValueError):start_session(self.store,'../../secret',now=NOW)
    def test_multiple_event_workflows_and_cached_views(self):
        self.start()
        for at in range(0,5401,60):self.tick(at)
        feed=self.feed();records=feed['records']
        self.assertGreaterEqual(len(records),8)
        self.assertLessEqual(len(records),15)
        self.assertTrue(all(r['state']=='verified' for r in records))
        self.assertEqual(len(FakeBackend.calls),3*len(records))
        self.assertEqual([r['candidate']['eventId'] for r in records if r['candidate']['kind']=='goal'],
                         [e['id'] for e in self.source['events'] if e['type']=='goal'])
        self.assertEqual({r['candidate']['kind'] for r in records if r['candidate']['kind'] in ('halftime','fulltime')},{'halftime','fulltime'})
        count=len(FakeBackend.calls)
        for _ in range(5):self.feed();self.tick(5400)
        self.assertEqual(len(FakeBackend.calls),count)
        for facts in FakeBackend.seen:
            at=facts['candidate']['atSecond'];sources={e['id']:e for e in self.source['events'] if e['time']<=at}
            self.assertTrue(all(i in sources for ids in facts['claims'].values() for i in ids))
            self.assertNotIn('events',facts)
        output=ROOT/'artifacts/offline-session-feed.json';output.parent.mkdir(exist_ok=True);output.write_text(json.dumps(feed))
    def test_failure_consumes_reservation_without_retry(self):
        self.start();FakeBackend.fail_stage='Verification'
        self.assertEqual(self.tick(60)['status'],'failed_locked')
        self.assertEqual(FakeBackend.calls,['Insight','Verification'])
        self.assertEqual(self.feed()['reservedCalls'],3)
        for _ in range(5):self.tick(60)
        self.assertEqual(len(FakeBackend.calls),2)
        self.assertEqual(self.feed()['records'][0]['state'],'fallback')
    def test_model_veto_and_unrestricted_prose_rejected(self):
        for corruption in ('proposal','review','text'):
            self.setUp_store_only()
            FakeBackend.corrupt=corruption;self.start()
            self.assertEqual(self.tick(60)['status'],'failed_locked')
            self.assertEqual(self.feed()['records'][0]['state'],'fallback')
    def setUp_store_only(self):
        self.store=MemoryStore();self.approval=setup(self.store,self.source);FakeBackend.calls=[]
    def test_parallel_workers_deduplicate_and_reserve_atomically(self):
        self.start()
        async def workers():
            return await asyncio.gather(*(pulse(self.store,SID,backend_factory=FakeBackend,preflight=lambda:None,now=NOW+1) for _ in range(12)))
        results=asyncio.run(workers())
        self.assertEqual(sum(r['status']=='published' for r in results),1)
        self.assertEqual(FakeBackend.calls,['Insight','Verification','Presentation'])
        self.assertEqual(self.feed()['reservedCalls'],3)
    def test_budget_exhaustion_and_global_accounting(self):
        self.approval['limits'].update(moments=2,calls=6)
        self.start()
        for at in range(0,5401,60):self.tick(at)
        self.assertLessEqual(len(FakeBackend.calls),6)
        self.assertEqual(self.feed()['reservedCalls'],6)
        self.assertEqual(sum(d['calls'] for d in self.store.data[LEDGER]['days'].values()),6)
    def test_future_wrong_player_score_seed_and_source_rejected(self):
        c=next(c for c in detect(self.source,5400) if c['kind']=='goal');facts=facts_for(self.source,c)
        proposal=dict(id=c['id'],angle='event',claimIds=list(facts['claims']))
        check_proposal(facts,proposal)
        for field in ('id','angle'):
            bad={**proposal,field:'wrong-seed-or-future'}
            with self.assertRaises(ValueError):check_proposal(facts,bad)
        self.assertEqual(facts['stats']['score'],[0,1])
        winner=next(c for c in detect(self.source,5400) if c['id']=='SIM-82-01629')
        current=facts_for(self.source,winner)
        self.assertEqual(current['stats']['shots'],[14,6])
        self.assertEqual(sum(current['stats']['score']),5)
        self.assertEqual(current['actor']['id'],9)
        self.assertNotEqual(current['stats']['shots'],facts_for(self.source,detect(self.source,5400)[-1])['stats']['shots'])
    def test_kill_switch_between_stages(self):
        self.start()
        class Kill(FakeBackend):
            async def propose(inner,facts):
                out=await super().propose(facts);os.environ['TACTICLENS_SESSION_AI_ENABLED']='false';return out
        result=asyncio.run(pulse(self.store,SID,backend_factory=Kill,preflight=lambda:None,now=NOW+1))
        self.assertEqual(result['status'],'failed_locked')
        self.assertEqual(FakeBackend.calls,['Insight'])
    def test_stop_preserves_budget_and_prevents_more_calls(self):
        self.start();self.tick(60);stop_session(self.store,SID)
        count=len(FakeBackend.calls);self.tick(120)
        self.assertEqual(count,len(FakeBackend.calls))
        self.assertEqual(self.feed()['status'],'stopped')
    def test_unavailable_preflight_never_initializes_model(self):
        self.start()
        def fail():raise RuntimeError('Azure unavailable')
        with self.assertRaises(RuntimeError):asyncio.run(pulse(self.store,SID,backend_factory=FakeBackend,preflight=fail,now=NOW+1))
        self.assertEqual(self.feed()['reservedCalls'],0)
    def test_public_read_allowlist_and_no_credit_leak(self):
        self.start();self.tick(60)
        text=json.dumps(self.feed())
        self.assertNotIn('subscriptionId',text);self.assertNotIn('remainingCredit',text)
        os.environ['TACTICLENS_SESSION_PUBLIC_IDS']=''
        self.assertEqual(self.feed(),{'status':'unavailable'})
    def test_many_seed_detection_and_python_js_parity(self):
        samples=[]
        for seed in (1,2,3,7,15,42,82,123,2027,9999):
            source=export(seed);validate_source(source)
            candidates=detect(source,5400)
            self.assertGreaterEqual(len(candidates),8)
            self.assertTrue(all(c['kind']!='goal' or any(e['id']==c['id'] and e['type']=='goal' for e in source['events']) for c in candidates))
            samples.append(dict(seed=seed,candidates=candidates,facts=[facts_for(source,c) for c in candidates]))
        path=ROOT/'artifacts/session-parity.json';path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(samples))
    def test_cas_contention_never_loses_updates(self):
        self.store.data[LEDGER]=dict(sessions={},days={},reservations={},count=0)
        def increment():
            for _ in range(5):transaction(self.store,lambda s:s.update(count=s['count']+1))
        threads=[threading.Thread(target=increment) for _ in range(4)]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertEqual(self.store.data[LEDGER]['count'],20)
