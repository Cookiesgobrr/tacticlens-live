"""Live-only Azure cost guard: explicitly deny unless subscription and model match.

This call uses managed identity instead of an interactive Azure CLI login.
It performs management-plane GET requests, NEVER any inference, resource
provisioning or subscription upgrade.
"""
import json
import os
from urllib.request import Request, urlopen

SUBSCRIPTION_RESOURCE = "https://management.azure.com/.default"
MANAGEMENT_URL = "https://management.azure.com"
ACCOUNT = "tarunjacob2927-8313-resource"
RESOURCE_GROUP = "rg-tarun.jacob2927-3851"


def cloud_trial_preflight(*, credential=None, http_get=None):
    if os.environ.get("TACTICLENS_LIVE_AI_ENABLED", "").lower() != "true":
        raise RuntimeError("Live generation disabled")
    if credential is None:
        from azure.identity import ManagedIdentityCredential
        credential = ManagedIdentityCredential()
    token = credential.get_token(SUBSCRIPTION_RESOURCE).token

    def fetch(url):
        request = Request(url, headers={"Authorization": f"Bearer {token}"})
        with urlopen(request, timeout=15) as response:
            return json.load(response)

    getter = http_get or fetch
    subscription = os.environ.get("TACTICLENS_AZURE_SUBSCRIPTION_ID", "")
    if not subscription or not all(ch.isalnum() or ch == "-" for ch in subscription):
        raise RuntimeError("Missing approved subscription ID")
    base = f"{MANAGEMENT_URL}/subscriptions/{subscription}"
    policy = getter(f"{base}?api-version=2022-12-01")
    protection = policy.get("subscriptionPolicies", {})
    if (policy.get("state") != "Enabled"
            or protection.get("spendingLimit") != "On"
            or not protection.get("quotaId", "").startswith("FreeTrial_")):
        raise RuntimeError("Subscription is not an enabled FreeTrial with spending limit On")
    deployment = getter(
        f"{base}/resourceGroups/{RESOURCE_GROUP}/providers/Microsoft.CognitiveServices"
        f"/accounts/{ACCOUNT}/deployments/gpt-4.1-mini?api-version=2024-10-01"
    )
    properties = deployment.get("properties", {})
    if (deployment.get("name") != "gpt-4.1-mini"
            or properties.get("provisioningState") != "Succeeded"
            or properties.get("model", {}).get("name") != "gpt-4.1-mini"):
        raise RuntimeError("Approved GPT-4.1-mini deployment unavailable")
    return {"spendingLimit": "On", "subscriptionType": "FreeTrial"}
