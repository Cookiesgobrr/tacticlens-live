"""Operator-only three-call batch. No HTTP inference route and no cloud writes."""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone
from api.eleven_pipeline import run_eleven_pipeline, validate_source

ROOT = Path(__file__).resolve().parents[1]


def trial_preflight():
    def az(*args):
        result = subprocess.run(["az", *args, "-o", "json"], capture_output=True, text=True, check=True, timeout=45)
        return json.loads(result.stdout)
    account = az("account", "show")
    policy = az("rest", "--method", "get", "--url", f"https://management.azure.com/subscriptions/{account['id']}?api-version=2022-12-01")
    protection = policy.get("subscriptionPolicies", {})
    if policy.get("state") != "Enabled" or protection.get("spendingLimit") != "On" or not protection.get("quotaId", "").startswith("FreeTrial_"):
        raise RuntimeError("Enabled Free Trial with spending limit On is required; no inference performed")
    deployments = az("cognitiveservices", "account", "deployment", "list", "--name", "tarunjacob2927-8313-resource", "--resource-group", "rg-tarun.jacob2927-3851")
    if not any(d.get("name") == "gpt-4.1-mini" and d.get("properties", {}).get("model", {}).get("name") == "gpt-4.1-mini" and d.get("properties", {}).get("provisioningState") == "Succeeded" for d in deployments):
        raise RuntimeError("Existing GPT-4.1-mini deployment unavailable")
    return {"subscriptionType": "FreeTrial", "spendingLimit": "On", "state": "Enabled"}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=str(ROOT/"artifacts/sim82-source.json"))
    parser.add_argument("--output", default=str(ROOT/"web/public/data/foundry-sim82.json"))
    parser.add_argument("--confirm-trial-credits", action="store_true")
    args = parser.parse_args()
    if not args.confirm_trial_credits:
        parser.error("Explicit trial-credit confirmation required. No calls made.")
    raw = Path(args.source).read_bytes()
    source = json.loads(raw)
    validate_source(source)
    subprocess.run(["node", "--experimental-strip-types", str(ROOT/"web/scripts/check-ai-source.mjs"), str(Path(args.source).resolve())], check=True, cwd=ROOT)
    protection = trial_preflight()
    artifact = ROOT/"artifacts"
    artifact.mkdir(exist_ok=True)
    # Durable local reservation stays after failure. Never auto-reset or retry.
    lock = artifact/"foundry-sim82.claimed"
    with lock.open("x") as handle:
        handle.write(json.dumps({"state": "reserved", "maxCalls": 3, "maxOutputTokensPerCall": 6000}))
    from api.eleven_agents import ElevenFoundryBackend
    backend = ElevenFoundryBackend()
    try:
        result = await run_eleven_pipeline(source, backend)
        pack = dict(schemaVersion="tacticlens.foundry11.v1", status="verified", provider="microsoft-foundry", model="gpt-4.1-mini",
            matchId="SIM-82", seed=82, generatedAt=datetime.now(timezone.utc).isoformat(), cards=result["cards"], trace=backend.trace)
        target = Path(args.output)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise FileExistsError("Refusing to overwrite an existing publication")
        temp = target.with_suffix(".pending.json")
        temp.write_text(json.dumps(pack, ensure_ascii=False, indent=2)+"\n")
        # Browser-side gate regenerates the actual engine facts before publication.
        subprocess.run(["node", "--experimental-strip-types", str(ROOT/"web/scripts/check-ai-pack.mjs"), str(temp)], check=True, cwd=ROOT)
        temp.rename(target)
        audit = dict(sourceSha256=hashlib.sha256(raw).hexdigest(), sourceEngine="web/src/footballEngine.ts",
            costProtection=protection, limits={"maxCalls": 3, "maxOutputTokensPerCall": 6000, "automaticRetries": 0},
            trace=backend.trace, responses=backend.responses, decisions=result["decisions"])
        (artifact/"foundry-sim82-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2)+"\n")
        print(json.dumps({"status": "published", "moments": len(pack["cards"]), "modelCalls": len(backend.trace), "output": str(target)}))
    except Exception as error:
        (artifact/"foundry-sim82-failed-attempt.json").write_text(json.dumps({"errorType": type(error).__name__, "trace": backend.trace, "responses": backend.responses}, indent=2)+"\n")
        raise
    finally:
        await backend.close()


if __name__ == "__main__":
    asyncio.run(main())
