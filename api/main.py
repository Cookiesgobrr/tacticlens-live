"""TacticLens Live REST API (synthetic demo, no live football feed)."""
from fastapi import FastAPI
from api.simulator import build_match
from api.analytics import detect_insights, match_stats

app = FastAPI(title="TacticLens Live", version="0.1.0")
MATCH = build_match()
INSIGHTS = detect_insights(MATCH["events"])


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
