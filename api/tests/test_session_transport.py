"""Actual SDK transport contract, against MockTransport only. Zero Azure calls."""
import asyncio
import json
import pytest
pytest.importorskip('agent_framework.openai')
import httpx
from openai import AsyncOpenAI
from api.session_agents import SessionFoundryBackend

class Credential:
    def get_token(self, scope):
        assert scope=='https://cognitiveservices.azure.com/.default'
        return type('Token',(),{'token':'offline-test-token'})()

LIMITS=dict(inputTokensPerCall=16000,inputBytesPerCall=12000,outputTokensPerCall=1000)
FACTS=dict(candidate=dict(id='SIM-82-00131'), claims=dict(event=[],score=[],team0=[],team1=[],player=[],totals=[]))
PROPOSAL=dict(id='SIM-82-00131',angle='event',claimIds=list(FACTS['claims']))

def test_three_agent_wire_budget_and_attempt_order():
    requests,stages=[],[]
    def handle(request):
        payload=json.loads(request.content);requests.append(payload)
        assert payload['max_output_tokens']==1000 and payload['model']=='gpt-4.1-mini'
        assert payload['store'] is False and payload['stream'] is False
        format=payload['text']['format']
        assert format['type']=='json_schema' and format['strict'] is True
        schema=format['schema']; assert schema['additionalProperties'] is False
        identity=schema['properties'].get('id',schema['properties'].get('checkedId'))
        assert identity['enum']==['SIM-82-00131']
        assert 'TacticLens Session' in payload['instructions']
        if format['name'].endswith('Insight'):
            assert schema['properties']['claimIds']['items']['enum']==list(FACTS['claims'])
        return httpx.Response(200,json=dict(id=f'resp-session-mock-{len(requests)}',object='response',created_at=1,status='completed',model='gpt-4.1-mini',
            output=[dict(id='msg-mock',type='message',status='completed',role='assistant',content=[dict(type='output_text',text='{"ok":true}',annotations=[])])],
            usage=dict(input_tokens=10,output_tokens=5,total_tokens=15)))
    async def run():
        client=AsyncOpenAI(base_url='https://offline.invalid/openai/v1',api_key='offline',max_retries=0,
                          http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)))
        b=SessionFoundryBackend(LIMITS,stages.append,credential=Credential(),async_client=client)
        try:
            await b.propose(FACTS);await b.verify(FACTS,PROPOSAL);await b.present(FACTS,PROPOSAL)
            with pytest.raises(RuntimeError):await b.propose(FACTS)
            assert [t['inputTokens'] for t in b.trace]==[10,10,10]
        finally:await b.close()
    asyncio.run(run());assert stages==['Insight','Verification','Presentation'] and len(requests)==3


def test_input_cap_and_ledger_rejection_precede_transport():
    calls=[]
    def handle(request):calls.append(request);return httpx.Response(500,json={})
    async def run():
        client=AsyncOpenAI(base_url='https://offline.invalid/openai/v1',api_key='offline',max_retries=0,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)))
        def blocked(stage):raise RuntimeError('durable budget unavailable')
        b=SessionFoundryBackend(LIMITS,blocked,credential=Credential(),async_client=client)
        try:
            with pytest.raises(ValueError):await b.propose({**FACTS,'x':'x'*13000})
            with pytest.raises(RuntimeError):await b.propose(FACTS)
        finally:await b.close()
    asyncio.run(run());assert calls==[]
