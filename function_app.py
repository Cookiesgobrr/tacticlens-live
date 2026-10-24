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
from azure.core.exceptions import ResourceModifiedError
from azure.core import MatchConditions
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

    def snapshot(self, name: str):
        try:
            blob = self.container.get_blob_client(name).download_blob()
            return json.loads(blob.readall()), blob.properties.etag
        except ResourceNotFoundError:
            return None, None

    def compare_and_swap(self, name: str, etag, value: dict) -> bool:
        try:
            options = dict(overwrite=False) if etag is None else dict(
                overwrite=True, etag=etag, match_condition=MatchConditions.IfNotModified)
            self.container.get_blob_client(name).upload_blob(json.dumps(value, ensure_ascii=False),
                content_settings=ContentSettings(content_type="application/json"), **options)
            return True
        except (ResourceExistsError, ResourceModifiedError):
            return False


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


@app.route(route="session-start/{approval_id}", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def session_start(req: func.HttpRequest) -> func.HttpResponse:
    from api.live_sessions import start_session, enabled
    if not enabled():
        return respond({"status": "disabled"}, 403)
    if req.get_body() not in (b"", b"{}"):
        return respond({"status": "invalid_input"}, 400)
    try:
        return respond(start_session(VerifiedBlobStore(), req.route_params["approval_id"]))
    except (ValueError, KeyError):
        return respond({"status": "not_approved"}, 409)
    except Exception:
        return respond({"status": "unavailable"}, 503)


@app.route(route="session-stop/{session_id}", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def session_stop(req: func.HttpRequest) -> func.HttpResponse:
    from api.live_sessions import stop_session
    if req.get_body() not in (b"", b"{}"):
        return respond({"status": "invalid_input"}, 400)
    try:
        return respond(stop_session(VerifiedBlobStore(), req.route_params["session_id"]))
    except (ValueError, KeyError):
        return respond({"status": "unknown_session"}, 404)


@app.route(route="session-resume/{session_id}", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
def session_resume(req: func.HttpRequest) -> func.HttpResponse:
    from api.live_sessions import resume_session, enabled
    if not enabled():
        return respond({"status": "disabled"}, 403)
    if req.get_body() not in (b"", b"{}"):
        return respond({"status": "invalid_input"}, 400)
    try:
        return respond(resume_session(VerifiedBlobStore(), req.route_params["session_id"]))
    except (ValueError, KeyError):
        return respond({"status": "not_approved"}, 409)


@app.route(route="session-feed/{session_id}", methods=["GET"], auth_level=func.AuthLevel.ANONYMOUS)
def session_feed(req: func.HttpRequest) -> func.HttpResponse:
    # Empty by default. Explicit exposure is a separate operator decision.
    sid = req.route_params["session_id"]
    if sid not in os.environ.get("TACTICLENS_SESSION_PUBLIC_IDS", "").split(",") or not sid:
        return respond({"status": "unavailable"}, 404)
    try:
        from api.live_sessions import public_session
        value = public_session(VerifiedBlobStore(), sid)
        return func.HttpResponse(json.dumps(value, ensure_ascii=False), mimetype="application/json",
            headers={"Cache-Control": "public, max-age=2", "X-Content-Type-Options": "nosniff"})
    except Exception:
        return respond({"status": "unavailable"}, 503)


@app.timer_trigger(schedule="*/5 * * * * *", arg_name="timer", run_on_startup=False, use_monitor=True)
async def session_coordinator(timer: func.TimerRequest) -> None:
    from api.live_sessions import enabled, LEDGER, pulse
    if not enabled():
        return
    from api.live_cost_guard import cloud_trial_preflight
    from api.session_agents import SessionFoundryBackend
    store = VerifiedBlobStore()
    state, _ = store.snapshot(LEDGER)
    # Source, clock, queue and budget are all server-owned. Viewers do not tick.
    for sid, session in (state or {}).get("sessions", {}).items():
        if session["status"] != "running":
            continue
        try:
            await pulse(store, sid, backend_factory=SessionFoundryBackend,
                        preflight=lambda: cloud_trial_preflight(require_enabled=False))
        except Exception as exc:
            logging.warning("Session coordinator blocked: %s", type(exc).__name__)
