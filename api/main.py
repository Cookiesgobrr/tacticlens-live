"""TacticLens Live REST API (synthetic demo, no live football feed)."""
from fastapi import FastAPI
from api.agent_pipeline import run_pipeline
from api.simulator import build_match
from api.analytics import detect_insights, match_stats
from api.overlays import build_overlay_cues, cues_at
from api.players import player_stats

app = FastAPI(title="TacticLens Live", version="0.1.0")
MATCH = build_match()
INSIGHTS = detect_insights(MATCH["events"])
OVERLAYS = build_overlay_cues(MATCH, INSIGHTS)


@app.get("/api/health")
def health():
    return {"status": "ok", "match_id": MATCH["match_id"]}


@app.get("/api/match")
def get_match():
    return {**MATCH, "insights": INSIGHTS}


@app.get("/api/stats")
def get_stats(at: int = 5400):
    at = max(0, min(MATCH["duration_seconds"], at))
    return {"at_second": at, "stats": match_stats(MATCH["events"], at)}


@app.get("/api/agent-demo")
async def agent_demo(at: int = 4500):
    """Free deterministic agent-style workflow; NOT generative AI."""
    return await run_pipeline(MATCH, at_second=at)


@app.get("/api/overlays")
def get_overlays(at: int | None = None):
    """Broadcast-ready synthetic cues, with optional match-clock filtering."""
    return {"match_id": MATCH["match_id"], "cues": OVERLAYS if at is None else cues_at(OVERLAYS, max(0, min(at, MATCH["duration_seconds"])))}


@app.get("/api/players/{player_name}/stats")
def get_player_stats(player_name: str, at: int = 5400):
    """Evidence-backed player metrics through the chosen replay time."""
    return player_stats(MATCH["events"], player_name, max(0, min(at, MATCH["duration_seconds"])))
