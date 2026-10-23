"""Independent numeric/positional verification; English is constrained by the Node
compiler gate, not accepted on a language model's approval. No model calls."""
import json
import math
from pathlib import Path
import subprocess
from api.eleven_pipeline import validate_source
ROOT = Path(__file__).resolve().parents[1]

def verify_editorial_review(manifest: dict) -> None:
    if manifest.get('schemaVersion') != 'tacticlens.editorial-review.v1':
        raise ValueError('Invalid editorial manifest')
    source = manifest['source']
    validate_source(source)
    frames = {f['second']: f for f in manifest['sampleFrames']}
    if len(frames) != len(manifest['sampleFrames']):
        raise ValueError('Duplicate position samples')
    rnd = lambda n: math.floor(n*10+.5)/10
    for facts in manifest['formations']:
        team, at = facts['team'], facts['atSecond']
        if type(team) is not int or not math.isfinite(at) or not 0 <= at <= 5400:
            raise ValueError('Invalid formation boundary')
        if facts['matchId'] != source['matchId'] or facts['seed'] != 82 or team not in (0, 1) or facts['formation'] != '4-3-3':
            raise ValueError('Wrong formation identity')
        window = facts['window']
        start = max(0, at-300)
        wanted = list(range(math.ceil(start/5)*5, math.floor(at)+1, 5))
        if any(t not in frames for t in wanted):
            raise ValueError('Missing position sample')
        samples = [frames[t] for t in wanted if frames[t]['phase'] != 3]
        if window != dict(fromSecond=start, toSecond=at, sampleSeconds=5, activeSamples=len(samples), sampledSeconds=[f['second'] for f in samples]):
            raise ValueError('Future or wrong sample window')
        sums = dict(width=0, back=0, gap=0, support=0, own=0, other=0)
        counts = dict(own=0, other=0)
        ids = list(range(team*11+1,team*11+11))
        for frame in samples:
            people = frame['people']
            if len(people) != 22 or not all(math.isfinite(p[k]) and 0 <= p[k] <= b for p in people for k,b in [('x',105),('y',68)]):
                raise ValueError('Invalid tracking sample')
            local = lambda n: people[team*11+n]['x'] if team == 0 else 105-people[team*11+n]['x']
            back = sum(local(n) for n in (1,2,3,4))/4
            mid = sum(local(n) for n in (5,6,7))/3
            ys = [people[i]['y'] for i in ids]
            sums['width'] += max(ys)-min(ys); sums['back'] += back; sums['gap'] += mid-back
            owner = frame['owner']
            if type(owner) is not int or not -1 <= owner < 22:
                raise ValueError('Invalid tracking owner')
            if owner >= 0:
                side = 'own' if source['players'][owner]['team'] == team else 'other'
                sums[side] += back; counts[side] += 1
                if side == 'own':
                    p = people[owner]
                    sums['support'] += sum(i != owner and 4 <= math.hypot(people[i]['x']-p['x'],people[i]['y']-p['y']) <= 26 for i in ids)
        observed = None if not samples else dict(widthM=rnd(sums['width']/len(samples)),backDepthM=rnd(sums['back']/len(samples)),midfieldGapM=rnd(sums['gap']/len(samples)),
            withBallBackDepthM=rnd(sums['own']/counts['own']) if counts['own'] else None,withoutBallBackDepthM=rnd(sums['other']/counts['other']) if counts['other'] else None,
            nearbyOptions=rnd(sums['support']/counts['own']) if counts['own'] else None,withBallSamples=counts['own'],withoutBallSamples=counts['other'])
        if facts['observed'] != observed:
            raise ValueError('Positional statistic mismatch')
        events = [e for e in source['events'] if start <= e['time'] <= at and e['team'] == team]
        count = lambda kind: sum(e['type'] == kind for e in events)
        actions = dict(passes=count('pass'),completed=count('receive'),ballWins=sum(e['type'] in ('tackle','interception','recovery') for e in events),shots=count('shot'),xg=rnd(sum(e['shotXg'] for e in events if e['type']=='shot')))
        if facts['actions'] != actions:
            raise ValueError('Formation event counts mismatch')
        ids = [e['id'] for e in events if e['type'] in ('pass','receive','tackle','interception','recovery','shot')]
        if facts['evidenceIds'] != ids or not set(facts['exampleIds']) <= set(ids):
            raise ValueError('Invalid/future formation evidence')


def verify_editorial_file(path: Path) -> None:
    verify_editorial_review(json.loads(path.read_text()))
    # Arbitrary prose, unsupported causation and altered roster/claim references
    # fail exact regeneration. A verifier's approval cannot bypass this gate.
    subprocess.run(['node','--experimental-strip-types',str(ROOT/'web/scripts/check-editorial-review.mjs'),str(path)],check=True,cwd=ROOT,capture_output=True,text=True,timeout=45)
