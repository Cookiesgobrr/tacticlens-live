"""Actual Functions route/auth and diagnostics checks; never Azure or inference."""
import json
import pytest
pytest.importorskip('azure.functions')
pytest.importorskip('azure.storage.blob')
import azure.functions as func
import function_app
from api import live_cost_guard


def test_blocked_preflight_reports_actual_enabled_state(monkeypatch):
    monkeypatch.setenv('TACTICLENS_LIVE_AI_ENABLED','true')
    def blocked(**kwargs):
        assert kwargs=={'require_enabled':False}
        raise RuntimeError('offline management failure')
    monkeypatch.setattr(live_cost_guard,'cloud_trial_preflight',blocked)
    response=function_app.live_preflight.build().get_user_function()(func.HttpRequest(method='GET',url='https://offline.invalid/api/live-preflight',body=b''))
    assert response.status_code==409
    assert json.loads(response.get_body())=={'status':'blocked','errorType':'RuntimeError','generationEnabled':True}
    assert response.headers['Cache-Control']=='no-store'


def test_disabled_routes_cannot_initialize_storage_or_backend(monkeypatch):
    import asyncio
    monkeypatch.setenv('TACTICLENS_LIVE_AI_ENABLED','false')
    monkeypatch.setenv('TACTICLENS_AI_GENERATION_ENABLED','false')
    monkeypatch.setattr(function_app,'VerifiedBlobStore',lambda:pytest.fail('No storage/model access while disabled'))
    request=func.HttpRequest(method='POST',url='https://offline.invalid/api/disabled',body=b'{}')
    for route in (function_app.live_generate,function_app.generate):
        response=asyncio.run(route.build().get_user_function()(request))
        assert response.status_code==403 and json.loads(response.get_body())=={'status':'disabled'}


def test_live_routes_require_function_auth():
    for route in (function_app.live_generate,function_app.live_moment,function_app.live_preflight):
        bindings=route.build().get_bindings()
        trigger=next(b.get_dict_repr() for b in bindings if b.get_dict_repr()['type']=='httpTrigger')
        assert trigger['authLevel']==func.AuthLevel.FUNCTION
