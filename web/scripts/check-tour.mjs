import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {chromium} from "playwright";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5186","--strictPort"],{cwd:new URL("../",import.meta.url),stdio:"ignore"});
let browser;
try{
  let ok=false;
  for(let i=0;i<100;i++){try{if((await fetch("http://127.0.0.1:5186")).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ok,"Local preview required");
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:5186/?seed=82");
  const tour=page.getByTestId("first-visit-tour");
  await tour.waitFor();
  for(const heading of ["Watch the match","Replay key moments","Meet Microsoft Foundry","Explore team formations"]){
    assert.equal(await tour.getByRole("heading").innerText(),heading);
    if(heading!=="Explore team formations")await tour.getByRole("button",{name:"Next"}).click();
  }
  await tour.getByRole("button",{name:"Finish tour"}).click();
  assert.equal(await tour.count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem("tacticlens.onboarding.v1")),"done");
  await page.reload();assert.equal(await tour.count(),0);
  await page.getByRole("button",{name:"Take a tour"}).click();await tour.waitFor();
  await tour.getByRole("button",{name:"Skip tour"}).click();assert.equal(await tour.count(),0);
  await page.goto("http://127.0.0.1:5186/?seed=82&tour=on");await tour.waitFor();
  await page.keyboard.press("Escape");assert.equal(await tour.count(),0);
  await page.goto("http://127.0.0.1:5186/?seed=82&tour=off");assert.equal(await tour.count(),0);
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await mobile.goto("http://127.0.0.1:5186/?seed=82&tour=on");
  const popup=mobile.getByTestId("first-visit-tour");await popup.waitFor();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  for(let i=0;i<3;i++)await popup.getByRole("button",{name:"Next"}).click();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await popup.getByRole("button",{name:"Finish tour"}).click();
  await mobile.close();await context.close();
  console.log("First-visit onboarding: 4 steps, skip, persistence, forced/disabled tour, desktop/mobile pass.");
}finally{await browser?.close();server.kill();}
