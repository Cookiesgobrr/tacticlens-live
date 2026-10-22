import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{cwd:root,stdio:'ignore'});
let browser;
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch('http://127.0.0.1:5179')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'Vite must start');
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5179');
  const pitch=page.locator('.new-pitch');await pitch.waitFor();
  assert.equal(await pitch.locator('g[style]').count(),22);
  const timeline=page.getByRole('slider',{name:'Match timeline'});
  await timeline.fill('1200');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const elapsed=+(await timeline.inputValue())-1200;
  assert.ok(elapsed>.8&&elapsed<2,`1x wall-clock advance: ${elapsed}`);
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  assert.equal(await timeline.inputValue(),'0');
  await page.getByRole('checkbox',{name:'Player stats'}).check();
  await timeline.fill('2700');
  mkdirSync(new URL('../test-results/',import.meta.url),{recursive:true});
  const expected=await page.evaluate(async()=>{
    const {generateMatch,eventsUntil}=await import('/src/footballEngine.ts');
    const m=generateMatch();const ev=eventsUntil(m,2700);
    return {shots:ev.filter(e=>e.type==='shot').length,xg:[0,1].map(team=>ev.filter(e=>e.type==='shot'&&e.team===team).reduce((a,e)=>a+e.shotXg,0).toFixed(2)),firstShot:m.events.find(e=>e.type==='shot')};
  });
  assert.deepEqual(await page.locator('.new-xg-totals b').allTextContents(),expected.xg.map(x=>`${x} xG`));
  assert.equal(await page.locator('.new-shotmap [role=button]').count(),expected.shots);
  const boxes=await pitch.locator('[data-stat-label] rect').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}}));
  assert.ok(boxes.length>0&&boxes.length<=5);
  for(let i=0;i<boxes.length;i++)for(const b of boxes.slice(i+1)){const a=boxes[i];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Stat labels must not overlap');}
  await page.screenshot({path:new URL('../test-results/desktop.png',import.meta.url).pathname,fullPage:true});
  await page.getByRole('button',{name:`Inspect shot ${expected.firstShot.id}`,exact:true}).click();
  assert.equal(+(await timeline.inputValue()),expected.firstShot.time);
  assert.ok((await page.locator('.new-inspection').innerText()).includes(expected.firstShot.id));
  await timeline.fill(String(expected.firstShot.time-.25));
  assert.equal(await page.locator('.new-shotmap [role=button]').count(),0);
  assert.deepEqual(await page.locator('.new-xg-totals b').allTextContents(),['0.00 xG','0.00 xG']);
  await page.getByRole('combobox',{name:'Pitch zoom'}).selectOption('2');
  assert.ok((await pitch.getAttribute('viewBox')).endsWith('500 330'));
  await page.getByRole('combobox',{name:'Pitch zoom'}).selectOption('1');
  await timeline.fill('2700');
  await page.getByRole('button',{name:'3D studio',exact:true}).click();
  const canvas=page.locator('.new-pitch3d canvas');await canvas.waitFor();
  await page.waitForFunction(()=>document.querySelector('.new-pitch3d canvas')?.dataset.renderedFrame);
  const rendered=JSON.parse(await canvas.getAttribute('data-rendered-frame'));
  const original=await page.evaluate(async()=>{const {generateMatch,atTime}=await import('/src/footballEngine.ts');return atTime(generateMatch(),2700)});
  assert.equal(rendered.people.length,22);
  for(let i=0;i<22;i++){assert.ok(Math.abs(rendered.people[i].x-original.people[i].x)<1e-5);assert.ok(Math.abs(rendered.people[i].y-original.people[i].y)<1e-5);}
  assert.ok(Math.abs(rendered.ball.x-original.ball.x)<1e-5&&Math.abs(rendered.ball.y-original.ball.y)<1e-5&&Math.abs(rendered.ball.z-original.ball.z)<1e-5);
  await page.screenshot({path:new URL('../test-results/3d-broadcast.png',import.meta.url).pathname,fullPage:true});
  for(const camera of ['tactical','player']){
    await page.getByRole('combobox',{name:'3D camera'}).selectOption(camera);await page.waitForTimeout(200);
    await page.screenshot({path:new URL(`../test-results/3d-${camera}.png`,import.meta.url).pathname,fullPage:true});
  }
  await page.getByRole('button',{name:'Flip pitch',exact:true}).click();
  await page.getByRole('combobox',{name:'Graphics quality'}).selectOption('medium');
  await canvas.waitFor();await page.waitForTimeout(200);
  await page.getByRole('button',{name:'2D pitch',exact:true}).click();
  await pitch.waitFor();assert.equal(+(await timeline.inputValue()),2700);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow on mobile');
  assert.ok(await page.locator('.new-mobile-stats').isVisible());
  await page.screenshot({path:new URL('../test-results/mobile.png',import.meta.url).pathname,fullPage:true});
  const mobile3d=page.locator('.new-pitch3d canvas');
  await page.getByRole('button',{name:'3D studio',exact:true}).click();await mobile3d.waitFor();
  assert.ok(await page.locator('.new-mobile-stats').isVisible());
  await page.screenshot({path:new URL('../test-results/3d-mobile.png',import.meta.url).pathname,fullPage:true});
  await page.getByRole('button',{name:'2D pitch',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Reproducible match seed'}).fill('2027');
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await timeline.fill('5400');
  const expectedScore=await page.evaluate(async()=>{const {generateMatch}=await import('/src/footballEngine.ts');const m=generateMatch(2027);return [0,1].map(team=>m.events.filter(e=>e.type==='goal'&&e.team===team).length).join(' : ')});
  assert.ok((await page.locator('.new-score').innerText()).includes(expectedScore));
  const fallback=await browser.newPage();
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')return null;return original.call(this,type,...args)}});
  await fallback.goto('http://127.0.0.1:5179');await fallback.locator('.new-pitch').waitFor();
  await fallback.getByRole('button',{name:'3D studio',exact:true}).click();
  await fallback.getByRole('status').filter({hasText:'3D graphics are unavailable'}).waitFor();
  assert.ok(await fallback.locator('.new-pitch').isVisible());
  await fallback.close();
  assert.deepEqual(errors,[]);
  console.log('Browser gates passed: 22 actors, 1x/seek/zoom/restart, no future xG, labels, seeded score, 3D frame parity/cameras/quality, mobile and WebGL fallback.');
}finally{await browser?.close();server.kill();}
