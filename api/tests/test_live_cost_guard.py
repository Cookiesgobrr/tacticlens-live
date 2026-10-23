import pytest
from api.live_cost_guard import cloud_trial_preflight

class Credential:
    def get_token(self, scope):
        assert scope == "https://management.azure.com/.default"
        return type("Access", (), {"token":"mock-token"})()

def test_free_trial_credential_preflight(monkeypatch):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_AZURE_SUBSCRIPTION_ID","11111111-2222-3333-4444-555555555555")
    urls=[]
    def good(url):
        urls.append(url)
        if "deployments/" in url:
            return {"name":"gpt-4.1-mini","properties":{
                "provisioningState":"Succeeded","model":{"name":"gpt-4.1-mini"}}}
        return {"state":"Enabled","subscriptionPolicies":{
            "spendingLimit":"On","quotaId":"FreeTrial_2014-09-01"}}
    assert cloud_trial_preflight(credential=Credential(),http_get=good)["spendingLimit"]=="On"
    assert len(urls)==2

@pytest.mark.parametrize("policy",[
  {"state":"Enabled","subscriptionPolicies":{"spendingLimit":"Off","quotaId":"FreeTrial_2014"}},
  {"state":"Enabled","subscriptionPolicies":{"spendingLimit":"On","quotaId":"PayAsYouGo"}},
  {"state":"Disabled","subscriptionPolicies":{"spendingLimit":"On","quotaId":"FreeTrial_2014"}},
])
def test_reject_unsafe_subscription(monkeypatch,policy):
    monkeypatch.setenv("TACTICLENS_LIVE_AI_ENABLED","true")
    monkeypatch.setenv("TACTICLENS_AZURE_SUBSCRIPTION_ID","11111111-2222-3333-4444-555555555555")
    with pytest.raises(RuntimeError):
        cloud_trial_preflight(credential=Credential(),http_get=lambda url:policy)

def test_preflight_disabled(monkeypatch):
    monkeypatch.delenv("TACTICLENS_LIVE_AI_ENABLED",raising=False)
    with pytest.raises(RuntimeError,match="disabled"):
        cloud_trial_preflight(credential=Credential(),http_get=lambda url:None)
