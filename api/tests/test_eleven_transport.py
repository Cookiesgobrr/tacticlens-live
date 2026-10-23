"""Real Agent Framework/OpenAI wiring against a local MockTransport, never Azure."""
import asyncio
import json
import pytest
pytest.importorskip('agent_framework.openai')
import httpx
from openai import AsyncOpenAI
from api.eleven_agents import ElevenFoundryBackend

class Credential:
    def get_token(self, scope):
        assert scope=='https://cognitiveservices.azure.com/.default'
        return type('Token',(),{'token':'offline-test-token'})()

def backend(handler):
    client=AsyncOpenAI(base_url='https://offline.invalid/openai/v1',api_key='offline-only',max_retries=0,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    return ElevenFoundryBackend(credential=Credential(),async_client=client)


def test_live_wire_contract_and_three_attempt_ceiling(monkeypatch):
    monkeypatch.setenv('TACTICLENS_LIVE_AI_ENABLED','true')
    requests=[]
    def handle(request):
        body=json.loads(request.content);requests.append(body)
        assert request.url.path=='/openai/v1/responses'
        assert body['model']=='gpt-4.1-mini' and body['max_output_tokens']==1000
        assert body['store'] is False and body['stream'] is False
        assert body['text']['format']=={'type':'json_object'}
        assert 'Return JSON only.' in json.dumps(body['input'])
        return httpx.Response(200,json=dict(id=f'resp-offline-{len(requests)}',object='response',created_at=1,status='completed',model='gpt-4.1-mini',
            output=[dict(id='msg-test',type='message',status='completed',role='assistant',content=[dict(type='output_text',text='{"ok":true}',annotations=[])])],
            usage=dict(input_tokens=10,output_tokens=5,total_tokens=15)))
    async def run():
        b=backend(handle)
        try:
            assert await b.propose({})=={'ok':True}
            assert await b.verify({}, {})=={'ok':True}
            assert await b.present({}, {})=={'ok':True}
            with pytest.raises(RuntimeError):await b.propose({})
            assert b.attempts==['Insight','Verification','Presentation'] and len(b.trace)==3
        finally:await b.close()
    asyncio.run(run());assert len(requests)==3


def test_transport_failure_consumes_attempt_and_never_retries(monkeypatch):
    monkeypatch.setenv('TACTICLENS_LIVE_AI_ENABLED','true');requests=[]
    def handle(request):requests.append(request);return httpx.Response(500,json={'error':{'message':'offline failure'}})
    async def run():
        b=backend(handle)
        try:
            with pytest.raises(Exception):await b.propose({})
            with pytest.raises(RuntimeError):await b.propose({})
            assert b.attempts==['Insight'] and len(requests)==1
        finally:await b.close()
    asyncio.run(run())
