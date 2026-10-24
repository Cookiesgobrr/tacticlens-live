"""Local OFFLINE browser-test harness. Never deployed or imported by Functions.

Only the test driver can advance this fake clock. Production has no such route.
"""
import asyncio
import json
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import os
from urllib.parse import urlparse, parse_qs
from api.tests.test_live_sessions import MemoryStore, FakeBackend, setup, export, NOW, SID
from api.live_sessions import start_session, pulse, public_session

os.environ.update(TACTICLENS_SESSION_AI_ENABLED='true',TACTICLENS_SESSION_APPROVAL_IDS=SID,
    TACTICLENS_SESSION_PUBLIC_IDS=SID,TACTICLENS_AZURE_SUBSCRIPTION_ID='offline-subscription',
    TACTICLENS_SESSION_GLOBAL_LIMITS=json.dumps(dict(calls=45,inputTokens=720000,outputTokens=45000,microUsd=1000000,activeSessions=1,concurrency=1)))
store=MemoryStore();setup(store,export(82));start_session(store,SID,now=NOW)
clock=0
class SlowFake(FakeBackend):
    async def call(self,stage,facts):
        await super().call(stage,facts)
        await asyncio.sleep(4.0)
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,value):
        body=json.dumps(value).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(body)
    def do_GET(self):
        if self.path=='/stats':return self.send(dict(calls=len(FakeBackend.calls)))
        self.send(public_session(store,SID,now=NOW+clock/60))
    def do_POST(self):
        global clock
        clock=float(parse_qs(urlparse(self.path).query)['at'][0])
        self.send(asyncio.run(pulse(store,SID,backend_factory=SlowFake,preflight=lambda:None,now=NOW+clock/60)))
ThreadingHTTPServer(('127.0.0.1',5190),Handler).serve_forever()
