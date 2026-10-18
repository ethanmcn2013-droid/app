import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const here=path.dirname(fileURLToPath(import.meta.url));
export const VIEWPORTS=[{id:'desktop',width:1440,height:810},{id:'phone',width:390,height:844},{id:'laptop',width:1280,height:800}];
export function buildMatrix(fixtures){return fixtures.flatMap(f=>['light','dark'].flatMap(theme=>VIEWPORTS.map(viewport=>({id:`${f.fixtureId}-${theme}-${viewport.id}`,fixtureId:f.fixtureId,theme,viewport,sourceTheme:f.sourceTheme,viewer:f.viewerScenario,followDesignState:f.followScenario.requestedDesignState,followServiceRequired:f.followScenario.status.startsWith('blocked'),ownerServiceRequired:f.viewerScenario==='owner',returningHintPending:!!f.returningVisitorHint,screenshot:theme===f.sourceTheme&&viewport.id!=='laptop'||viewport.id==='laptop'&&[0,8,10,13].includes(fixtures.indexOf(f))&&theme===f.sourceTheme}))));}
export async function capture({readyPath,output,admissionPath}){
 if(!readyPath||!output||!admissionPath)throw Error('Explicit ready file, fresh output, and capture admission required');
 const ready=JSON.parse(await fs.readFile(readyPath,'utf8')),admission=JSON.parse(await fs.readFile(admissionPath,'utf8'));
 assert.equal(admission.allowCapture,true);assert.equal(admission.sourceHead,ready.head);assert.equal(admission.fixtureSha256,ready.fixtureSha256);assert.ok(admission.uiFreeze&&admission.modelFreeze&&admission.dtoFreeze,'All component input freezes required');
 const origin=new URL(ready.url);assert.equal(origin.hostname,'127.0.0.1');assert.equal(origin.protocol,'http:');
 const sourceRequire=createRequire(path.join(ready.source,'package.json')), {chromium}=sourceRequire('@playwright/test');
 const raw=await fs.readFile(path.join(here,'fixtures.json'));assert.equal(createHash('sha256').update(raw).digest('hex'),ready.fixtureSha256);
 const fixtures=JSON.parse(raw).fixtures,cases=buildMatrix(fixtures);await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'capture-owner.json'),JSON.stringify({pid:process.pid,source:ready.head,admission,planned:cases.length}),{flag:'wx'});
 const browser=await chromium.launch({headless:true}),results=[],screenshots=[],errors=[];
 const shot=async(page,id)=>{const file=path.join(output,id+'.png');await page.screenshot({path:file,fullPage:true});const bytes=await fs.readFile(file);screenshots.push({id,path:file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});};
 async function runCase(c,{spacing=false,forcedColors='none'}={}){
  const context=await browser.newContext({viewport:{width:c.viewport.width,height:c.viewport.height},reducedMotion:'reduce',colorScheme:c.theme,forcedColors});const page=await context.newPage(),caseErrors=[],blocked=[];
  page.on('pageerror',error=>caseErrors.push(error.message));page.on('console',m=>{if(m.type()==='error')caseErrors.push(m.text());});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin.origin)return route.continue();blocked.push(new URL(route.request().url()).origin);return route.abort();});
  let result;try{
   await page.goto(`${ready.url}/fixture?id=${encodeURIComponent(c.fixtureId)}&theme=${c.theme}${spacing?'&spacing=1':''}`,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#artifact-root article')&&window.__MASTER3_FIXTURE_READY__);
   await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const metrics=await page.evaluate(()=>{const root=document.querySelector('#artifact-root'),article=root.querySelector('article'),rect=article.getBoundingClientRect();return {innerWidth,innerHeight,devicePixelRatio,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},documentWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,article:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},theme:document.documentElement.dataset.theme,headingCount:root.querySelectorAll('h1,h2,h3').length,focusables:[...root.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(e=>e.getClientRects().length).length,forcedColors:matchMedia('(forced-colors:active)').matches,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches};});
   assert.equal(metrics.innerWidth,c.viewport.width);assert.equal(metrics.innerHeight,c.viewport.height);assert.equal(metrics.visualViewport.scale,1,'Native zoom not simulated by CSS/deviceScaleFactor');assert.ok(metrics.article.width>0);assert.ok(metrics.documentWidth<=metrics.clientWidth+1,`Horizontal overflow ${metrics.documentWidth}/${metrics.clientWidth}`);assert.equal(caseErrors.length,0);assert.equal(blocked.length,0,'Unexpected remote dependency');
   const focus=[];for(let i=0;i<Math.min(metrics.focusables+1,12);i++){await page.keyboard.press('Tab');focus.push(await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect();return {tag:el.tagName,name:el.getAttribute('aria-label')??el.textContent?.trim().slice(0,100),visible:!!el.getClientRects().length,inViewport:r.left>=-1&&r.right<=innerWidth+1};}));}await page.keyboard.press('Escape');
   assert.ok(focus.every(f=>f.visible&&f.inViewport));assert.equal(caseErrors.length,0);if(c.screenshot||spacing||forcedColors==='active')await shot(page,c.id);
   result={...c,status:'passed-layout',designStateComplete:!c.followServiceRequired&&!c.ownerServiceRequired&&!c.returningHintPending,missingDependencies:[...(c.followServiceRequired?['confirmed-follow-service']:[]),...(c.ownerServiceRequired?['authorized-owner-services']:[]),...(c.returningHintPending?['frozen-returning-hint-binding']:[])],followService:'unavailable',metrics,focus,errors:caseErrors,blockedRemoteOrigins:blocked};
  }catch(error){errors.push({caseId:c.id,message:error.message});try{await shot(page,c.id+'-failed');}catch{}result={...c,status:'failed',designStateComplete:false,error:error.message,errors:caseErrors,blockedRemoteOrigins:blocked};}
  finally{await context.close();}results.push(result);await fs.writeFile(path.join(output,'progress.json'),JSON.stringify({planned:cases.length,attempted:results.length,results,screenshots},null,2));
 }
 try{for(const c of cases)await runCase(c);
  for(const index of [0,8,10,13]){const fixture=fixtures[index];for(const variant of ['spacing','forced-colors'])await runCase({id:`${fixture.fixtureId}-${variant}`,fixtureId:fixture.fixtureId,theme:variant==='spacing'?'light':'dark',viewport:VIEWPORTS[index===8?1:0],screenshot:true,followServiceRequired:fixture.followScenario.status.startsWith('blocked')},{spacing:variant==='spacing',forcedColors:variant==='forced-colors'?'active':'none'});}
 }finally{await browser.close();}
 const receipt={schemaVersion:'timeline-master3.component-capture.v1',sourceHead:ready.head,inputFreezes:admission,fixtureSha256:ready.fixtureSha256,browser:'Playwright Chromium headless',scope:'Actual TimelineArtifact component/model/CSS with synthetic DTO; not Next/Clerk/production or complete follow-state acceptance',nativeZoom:{tested:false,status:'pending root native-browser smoke; no zoom substituted'},counts:{plannedBase:cases.length,attempted:results.length,passedLayout:results.filter(r=>r.status==='passed-layout').length,failed:results.filter(r=>r.status==='failed').length,followStateUnavailable:results.filter(r=>r.followServiceRequired).length,screenshots:screenshots.length},results,screenshots,errors};
 await fs.writeFile(path.join(output,'receiving.json'),JSON.stringify(receipt,null,2),{flag:'wx'});return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]==='--plan'){const fixtures=JSON.parse(await fs.readFile(path.join(here,'fixtures.json'),'utf8')).fixtures;console.log(JSON.stringify({cases:buildMatrix(fixtures),browserExecuted:false},null,2));}
 else capture({readyPath:process.argv[2],output:path.resolve(process.argv[3]??''),admissionPath:process.argv[4]}).then(r=>{console.log(JSON.stringify(r.counts));if(r.errors.length)process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
}


