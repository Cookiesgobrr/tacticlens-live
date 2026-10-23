"""TacticLens Live Azure Functions v2: public cache and protected generator.

Deploy using Azure Functions Python 3.12 and Microsoft-managed identity.
Function-auth protected POST is the *only* route making Foundry model calls.
Never expose the function key on the public GitHub Pages website.
"""
from __future__ import annotations

import json
import logging
import os

import azure.functions as func
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.identity import ManagedIdentityCredential
from azure.storage.blob import BlobServiceClient, ContentSettings

from api.cloud_publish import public_feed, publish_once

app = func.FunctionApp()


class VerifiedBlobStore:
    """Separate state in an Azure Storage container, via managed identity."""

    def __init__(self):
        url = os.environ["TACTICLENS_STORAGE_BLOB_URL"].rstrip("/")
        container = os.environ.get("TACTICLENS_STORAGE_CONTAINER", "tacticlens-verification")
        service = BlobServiceClient(url, credential=ManagedIdentityCredential())
        self.container = service.get_container_client(container)

    def get(self, name: str):
        try:
            return json.loads(self.container.get_blob_client(name).download_blob().readall())
        except ResourceNotFoundError:
            return None

    def claim(self, name: str) -> bool:
        try:
            self.container.get_blob_client(name).upload_blob(
                json.dumps({"state": "reserved", "identity": name, "maxModelCalls": 3}),
                overwrite=False, content_settings=ContentSettings(content_type="application/json")
            )
            return True
        except ResourceExistsError:
            return False

    def put(self, name: str, value: dict) -> None:
        self.container.get_blob_client(name).upload_blob(
            json.dumps(value, ensure_ascii=False), overwrite=False,
            content_settings=ContentSettings(content_type="application/json")
        )


def respond(payload: dict, code: int = 200) -> func.HttpResponse:
    return func.HttpResponse(json.dumps(payload, ensure_ascii=False), status_code=code,
                             mimetype="application/json", headers={"Cache-Control": "no-store"})


@app.route(route="verified", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def verified(req: func.HttpRequest) -> func.HttpResponse:
    """Public cache read; cheap and never a model invocation."""
    try:
        return respond(public_feed(VerifiedBlobStore()))
    except Exception as exc:
        logging.error("Public cache lookup failed: %s", type(exc).__name__)
        return respond({"status": "unavailable"}, 503)


@app.route(route="generate", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
async def generate(req: func.HttpRequest) -> func.HttpResponse:
    """Operator-only request; Function key required by Azure host."""
    # Check before opening storage, initializing agents, or spending any credits.
    if os.environ.get("TACTICLENS_AI_GENERATION_ENABLED", "").lower() != "true":
        return respond({"status": "disabled"}, 403)

    # The endpoint deliberately accepts no arbitrary prompts/match IDs/times.
    # This avoids turning the service into a public, unbounded model proxy.
    if req.get_body().strip() not in (b"", b"{}"):
        return respond({"status": "invalid_input"}, 400)

    try:
        from api.foundry_agents import FoundryAgentBackend
        outcome = await publish_once(VerifiedBlobStore(), FoundryAgentBackend)
        return respond({"status": outcome["status"]})
    except Exception as exc:
        logging.error("Protected generation failed: %s", type(exc).__name__)
        return respond({"status": "error"}, 500)


@app.route(route="live-moment/{seed:int}/{at_second}", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def live_moment(req: func.HttpRequest) -> func.HttpResponse:
    """Private cache-only poll. A read does not trigger inference."""
    from api.live_moments import get_cached
    try:
        seed = int(req.route_params["seed"])
        at_second = float(req.route_params["at_second"])
        return respond(get_cached(VerifiedBlobStore(), seed, at_second))
    except (ValueError, TypeError):
        return respond({"status": "invalid_input"}, 400)
    except Exception as exc:
        logging.error("Live moment cache lookup failed: %s", type(exc).__name__)
        return respond({"status": "unavailable"}, 503)


@app.route(route="live-generate/{seed:int}/{at_second}", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
async def live_generate(req: func.HttpRequest) -> func.HttpResponse:
    """Operator-only; accepts NO prompts, event payloads or public browser tokens."""
    if os.environ.get("TACTICLENS_LIVE_AI_ENABLED", "").lower() != "true":
        return respond({"status": "disabled"}, 403)
    if req.get_body().strip() not in (b"", b"{}"):
        return respond({"status": "invalid_input"}, 400)
    try:
        from api.live_moments import generate_once
        from api.live_cost_guard import cloud_trial_preflight
        from api.eleven_agents import ElevenFoundryBackend
        seed = int(req.route_params["seed"])
        second = float(req.route_params["at_second"])
        result = await generate_once(
            VerifiedBlobStore(), seed=seed, at_second=second,
            backend_factory=ElevenFoundryBackend,
            preflight=cloud_trial_preflight,
        )
        return respond(result, 200 if result["status"] in ("published", "already_cached") else 409)
    except (ValueError, TypeError):
        return respond({"status": "invalid_input"}, 400)
    except Exception as exc:
        logging.error("Live AI generation failed: %s", type(exc).__name__)
        return respond({"status": "unavailable"}, 503)


@app.route(route="live-preflight", methods=["GET"], auth_level=func.AuthLevel.FUNCTION)
def live_preflight(req: func.HttpRequest) -> func.HttpResponse:
    """Operator-only management-plane checks; never initialize a model client."""
    from api.live_cost_guard import cloud_trial_preflight
    generation_enabled = os.environ.get("TACTICLENS_LIVE_AI_ENABLED", "").lower() == "true"
    try:
        checks = cloud_trial_preflight(require_enabled=False)
        return respond(dict(status="protected", generationEnabled=generation_enabled, checks=checks))
    except Exception as exc:
        return respond(dict(status="blocked", errorType=type(exc).__name__, generationEnabled=generation_enabled), 409)
