import assert from 'node:assert/strict';
import {generateMatch,eventsUntil} from '../src/footballEngine.ts';
import {auditEvidenceReport,broadcastVtt,buildEvidenceReport,vttTimestamp} from '../src/matchEvidence.ts';
const match=generateMatch(2027);
const firstShot=match.events.find(e=>e.type==='shot');
const firstResult=match.events.find(e=>e.sourceId===firstShot.id);
for(const time of [0,firstShot.time-.01,firstShot.time,firstShot.time+.0001,firstShot.time+.0006,firstShot.time+.01,firstResult.time-.01,firstResult.time,2700,5400]){
  for(const lens of ['fan','analyst','club','player']){
    const report=buildEvidenceReport(match,time,{lens,team:0,player:9});
    assert.deepEqual(auditEvidenceReport(match,JSON.parse(JSON.stringify(report))),[]);
    assert.deepEqual(report.events,eventsUntil(match,time));
    assert.ok(report.events.every(e=>e.time<=time));
    assert.ok(report.cues.every(c=>c.startSecond<c.endSecond&&c.endSecond<=time));
    assert.ok(report.cues.every(c=>vttTimestamp(c.startSecond)!==vttTimestamp(c.endSecond)),'Every caption has a positive duration at millisecond precision');
    for(const cue of report.cues)assert.ok(cue.evidenceIds.every(id=>report.events.some(e=>e.id===id&&e.time<=cue.startSecond)));
    for(let i=1;i<report.cues.length;i++)assert.ok(report.cues[i].startSecond>=report.cues[i-1].endSecond);
    const vtt=broadcastVtt(report);
    assert.ok(vtt.startsWith('WEBVTT\n\n'));
    assert.equal((vtt.match(/ --> /g)??[]).length,report.cues.length);
    assert.equal(report.totals.shots.reduce((a,b)=>a+b),report.events.filter(e=>e.type==='shot').length);
  }
}
const during=buildEvidenceReport(match,firstShot.time+.01);
assert.ok(!JSON.stringify(during).includes(firstResult.id),'No future outcome in early export');
const report=buildEvidenceReport(match,2700);
const clone=()=>structuredClone(report);
let broken=clone();broken.totals.score[0]+=1;
assert.ok(auditEvidenceReport(match,broken).includes('Evidence mismatch: totals'));
broken=clone();broken.recap.text='A fictional 99% win probability';
assert.ok(auditEvidenceReport(match,broken).includes('Evidence mismatch: recap'));
broken=clone();broken.events.push(match.events.find(e=>e.time>2700));
assert.ok(auditEvidenceReport(match,broken).includes('Evidence mismatch: events'));
broken=clone();broken.cues[0].evidenceIds=['ARCHIVED-75'];
assert.ok(auditEvidenceReport(match,broken).includes('Evidence mismatch: cues'));
broken=clone();broken.provenance.foundryEvidence=true;
assert.ok(auditEvidenceReport(match,broken).includes('Evidence mismatch: provenance'));
assert.ok(auditEvidenceReport(generateMatch(2028),report).includes('Wrong match identity'));
for(const value of [null,{},'report',{...report,view:null},{...report,asOfSecond:NaN}])assert.ok(auditEvidenceReport(match,value).length);
for(const time of [NaN,-1,5401,Infinity])assert.throws(()=>buildEvidenceReport(match,time),RangeError);
assert.equal(vttTimestamp(59.9996),'00:01:00.000');
assert.equal(vttTimestamp(5400),'01:30:00.000');
console.log('Evidence export gates passed: exact replay prefix, cue timing, provenance, JSON/VTT and fabricated/future/cross-match mutations.');
