import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from api.editorial_verification import verify_editorial_review, verify_editorial_file
ROOT = Path(__file__).resolve().parents[2]

class TestEditorialVerification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT/'artifacts/test-editorial-review.json'
        subprocess.run(['node','--experimental-strip-types','web/scripts/export-editorial-review.mjs',str(cls.path)],cwd=ROOT,check=True,capture_output=True)
        cls.manifest = json.loads(cls.path.read_text())

    def test_independent_numeric_and_canonical_english_contracts(self):
        verify_editorial_file(self.path)
        self.assertEqual(len(self.manifest['narratives']),42)
        self.assertEqual(len(self.manifest['formations']),14)
        winner = next(f for f in self.manifest['formations'] if f['atSecond']==4680.25 and f['team']==0)
        self.assertEqual(winner['observed']['widthM'],43.3)
        self.assertEqual(winner['actions']['completed'],14)

    def test_independent_rejection_of_position_and_event_mutations(self):
        for kind in ('width','sample','future','count','id','identity','owner'):
            p=copy.deepcopy(self.manifest)
            f=p['formations'][-1]
            if kind=='width': f['observed']['widthM']+=1
            if kind=='sample': p['sampleFrames']=p['sampleFrames'][1:]
            if kind=='future': f['window']['sampledSeconds'].append(5405)
            if kind=='count': f['actions']['completed']+=1
            if kind=='id': f['evidenceIds'].append('EVT-ARCHIVED')
            if kind=='identity': f['matchId']='SIM-2027'
            if kind=='owner': p['sampleFrames'][-1]['owner']=99
            with self.assertRaises(ValueError,msg=kind): verify_editorial_review(p)

    def test_english_and_raw_positions_cannot_bypass_code_gate(self):
        for kind in ('prose','formation-prose','raw-position'):
            p=copy.deepcopy(self.manifest)
            if kind=='prose': p['narratives'][0]['text']+=' A roaring crowd celebrates.'
            if kind=='formation-prose': p['formationNarratives'][0]['paragraphs'][0]+=' A tactical switch caused the goal.'
            # A goalkeeper does not affect outfield summary metrics. Raw-frame
            # regeneration must still reject its changed location.
            if kind=='raw-position': p['sampleFrames'][-1]['people'][0]['y']+=1
            with tempfile.TemporaryDirectory() as d:
                path=Path(d)/'mutated.json';path.write_text(json.dumps(p))
                with self.assertRaises(subprocess.CalledProcessError,msg=kind): verify_editorial_file(path)
