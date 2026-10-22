import asyncio
import copy
import json
from pathlib import Path
import subprocess
import unittest
from api.eleven_pipeline import validate_source, run_eleven_pipeline

ROOT = Path(__file__).resolve().parents[2]


class TestElevenPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        target = ROOT/"artifacts/test-sim82-source.json"
        subprocess.run(["node", "--experimental-strip-types", "web/scripts/export-ai-source.mjs", str(target)], cwd=ROOT, check=True, capture_output=True)
        cls.source = json.loads(target.read_text())

    def backend(self, mutation=None):
        outer = self
        class Fake:
            calls = []
            async def propose(self, facts):
                self.calls.append("Insight")
                answer = {"cards": [dict(id=m["id"], angle="score", claimIds=[c["id"] for c in m["claims"]]) for m in facts["moments"]]}
                if mutation == "id": answer["cards"][-1]["claimIds"].append("EVT-ARCHIVED")
                return answer
            async def verify(self, facts, proposal):
                self.calls.append("Verification")
                return dict(approved=mutation != "veto", checkedMomentIds=[m["id"] for m in facts["moments"]], issues=[])
            async def present(self, facts, proposal):
                self.calls.append("Presentation")
                cards = []
                for m in facts["moments"]:
                    modes = dict(fan=["score"], analyst=["activity", "totals"], club_home=["team0"], club_away=["team1"],
                        player=["player"] if any(c["id"] == "player" for c in m["claims"]) else ["totals"], broadcast=["score"])
                    cards.append(dict(id=m["id"], modes=modes))
                if mutation == "presentation": cards[-1]["modes"]["fan"] = ["invented-99-percent"]
                outer.assertTrue(cards)
                return {"cards": cards}
        return Fake()

    def test_independent_actual_seed82(self):
        validate_source(self.source)
        self.assertEqual(self.source["moments"][-1]["checks"]["score"], [3, 2])
        self.assertEqual(sum(self.source["moments"][-1]["checks"]["shots"]), 22)
        backend = self.backend()
        result = asyncio.run(run_eleven_pipeline(self.source, backend))
        self.assertEqual(len(result["cards"]), 7)
        self.assertEqual(backend.calls, ["Insight", "Verification", "Presentation"])

    def test_tampered_source_suppressed_before_agents(self):
        for kind in ("count", "future", "seed", "xg", "actor", "source"):
            source = copy.deepcopy(self.source)
            if kind == "count": source["moments"][0]["checks"]["score"][0] = 99
            if kind == "future": source["moments"][0]["claims"][0]["evidenceIds"].append("SIM-82-01629")
            if kind == "seed": source["seed"] = 2027
            shot = next(e for e in source["events"] if e["type"] == "shot")
            goal = next(e for e in source["events"] if e["type"] == "goal")
            if kind == "xg": shot["shotXg"] = .99
            if kind == "actor": goal["player"] = 0
            if kind == "source": goal["sourceId"] = "SIM-2027-00001"
            backend = self.backend()
            with self.assertRaises(ValueError, msg=kind): asyncio.run(run_eleven_pipeline(source, backend))
            self.assertEqual(backend.calls, [])

    def test_model_failures_fail_closed(self):
        for mutation, calls in [("id", ["Insight"]), ("veto", ["Insight", "Verification"]), ("presentation", ["Insight", "Verification", "Presentation"])]:
            backend = self.backend(mutation)
            with self.assertRaises(ValueError): asyncio.run(run_eleven_pipeline(self.source, backend))
            self.assertEqual(backend.calls, calls)
