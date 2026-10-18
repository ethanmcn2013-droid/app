import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const output=path.resolve(process.argv[2]);
const ready=JSON.parse(await fs.readFile(path.join(output,'ready.json'),'utf8'));
const browser=await chromium.launch({headless:true});
const results=[],screenshots=[],errors=[],network=[],consoleMessages=[];
const dimensions=[[390,844],[768,1024],[1280,900],[1440,960]];
async function snapshot(){return fetch(ready.url+'/fixture/snapshot').then(r=>r.json());}
async function shot(page,id){const file=path.join(output,id+'.png');await page.screenshot({path:file,fullPage:true});const bytes=await fs.readFile(file);screenshots.push({id,path:file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
async function open(page){await page.goto(ready.url+'/assistant');await page.getByRole('button',{name:'Ping',exact:true}).click();await page.getByRole('textbox',{name:'Request for Ping'}).waitFor();}
async function send(page,text){await page.getByRole('textbox',{name:'Request for Ping'}).fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();}
async function settled(page){await page.waitForFunction(()=>{const t=document.querySelector('textarea[aria-label="Request for Ping"]');return t&&!t.disabled&&t.value==='';});}
try{
 for(const [width,height] of dimensions){
  const id=`${width}x${height}`,context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push({viewport:id,message:e.message}));
  page.on('console',m=>consoleMessages.push({viewport:id,type:m.type(),text:m.text()}));
  page.on('requestfailed',r=>network.push({viewport:id,path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  await open(page);await page.getByLabel('Ping scope').selectOption('synthetic-ping-project');await shot(page,id+'-empty');
  const before=await snapshot();
  await send(page,'Create 100 tasks and open private preview');await settled(page);
  let after=await snapshot();assert.equal(after.tasks.length-before.tasks.length,100);assert.equal(after.plans-before.plans,1);
  const previousIds=new Set(before.tasks.map(t=>t.id));
  assert.equal(after.tasks.filter(t=>!previousIds.has(t.id)&&t.milestone===1).length,10);
  await shot(page,id+'-success-populated');
  await page.getByRole('link',{name:'Open result',exact:true}).first().click();await page.getByRole('heading',{name:'Private preview',exact:true}).waitFor();
  assert.equal(await page.locator('button,input,textarea,select').count(),0);await shot(page,id+'-preview-populated-readonly');
  await page.goto(ready.url+'/assistant');await page.getByRole('button',{name:'Ping',exact:true}).click();await page.getByLabel('Ping scope').selectOption('synthetic-ping-project');
  await send(page,'Archive 90 of those tasks');await settled(page);after=await snapshot();assert.equal(after.tasks.filter(t=>t.archived_at!==null).length-before.tasks.filter(t=>t.archived_at!==null).length,90);await shot(page,id+'-archive90');
  await page.getByLabel('Draft only',{exact:true}).check();const draftBefore=await snapshot();await send(page,'Draft two tasks');await settled(page);assert.equal((await snapshot()).tasks.length,draftBefore.tasks.length);await shot(page,id+'-draft-unsaved');
  await page.getByRole('button',{name:'Apply this draft',exact:true}).click();await settled(page);assert.equal((await snapshot()).tasks.length,draftBefore.tasks.length+2);await shot(page,id+'-draft-applied');
  await page.getByLabel('Draft only',{exact:true}).uncheck();await send(page,'Create new Project and one task');await settled(page);await page.getByLabel('Ping scope').selectOption({label:'Synthetic new Project'});await shot(page,id+'-new-project-scope');
  await page.getByLabel('Ping scope').selectOption('synthetic-ping-project');
  // A lost HTTP reply is injected AFTER the actual server has committed.
  const lostBefore=await snapshot();let lostRequest;
  await page.route('**/api/ping/assistant',async route=>{if(route.request().method()==='POST'){lostRequest=route.request().postDataJSON().request;await route.fetch();await route.abort('failed');}else await route.continue();},{times:1});
  await send(page,'Create two recovery tasks');await page.getByRole('button',{name:'Check status',exact:true}).waitFor();await shot(page,id+'-recovery-error');
  await page.reload();await page.getByRole('button',{name:'Ping',exact:true}).click();await settled(page);const recovered=await snapshot();assert.equal(recovered.tasks.length,lostBefore.tasks.length+2);assert.equal(recovered.plans,lostBefore.plans+1);await shot(page,id+'-recovery-reloaded-saved');
  // Zero-dispatch loss leaves only the identifiers in the real client recovery note.
  let absentRequest;await page.getByLabel('Ping scope').selectOption('synthetic-ping-project');
  await page.route('**/api/ping/assistant',async route=>{absentRequest=route.request().postDataJSON().request;await route.abort('failed');},{times:1});
  const absentBefore=await snapshot();await send(page,'Create two recovery tasks');await page.getByRole('button',{name:'Check status',exact:true}).waitFor();await page.reload();await page.getByRole('button',{name:'Ping',exact:true}).click();await page.getByRole('button',{name:'Re-enter original request',exact:true}).waitFor();await shot(page,id+'-absent-original');
  await page.getByRole('button',{name:'Re-enter original request',exact:true}).click();await page.getByLabel('Ping scope').selectOption('synthetic-ping-project');await send(page,'Create two recovery tasks');await settled(page);
  const reentered=await snapshot();assert.equal(reentered.tasks.length,absentBefore.tasks.length+2);assert.equal(reentered.requests.at(-1).requestId,absentRequest.requestId);await shot(page,id+'-same-id-reentry');
  await page.getByLabel('Draft only',{exact:true}).check();await send(page,'Draft two tasks');await settled(page);const cancelBefore=await snapshot();await page.getByRole('button',{name:'Cancel remaining work',exact:true}).first().click();await settled(page);assert.equal((await snapshot()).tasks.length,cancelBefore.tasks.length);await shot(page,id+'-cancelled');
  await page.getByLabel('Draft only',{exact:true}).uncheck();await send(page,'Make a partial result');await settled(page);await shot(page,id+'-partial');
  await send(page,'Make an unknown result');await page.getByRole('button',{name:'Check status',exact:true}).waitFor();await shot(page,id+'-unknown');
  const unknownBefore=await snapshot();await page.getByRole('button',{name:'Cancel remaining work',exact:true}).first().click();await settled(page);
  assert.equal((await snapshot()).tasks.length,unknownBefore.tasks.length);assert.equal(await page.getByRole('button',{name:'Check status',exact:true}).count(),0);await shot(page,id+'-cancelled-unknown-unlocked');
  // Long user text is rendered by the real unsupported-plan path; no generated result is substituted.
  await send(page,'Long synthetic request '.repeat(70));await settled(page);await shot(page,id+'-long-content');
  await page.getByRole('textbox',{name:'Request for Ping'}).focus();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement instanceof HTMLButtonElement));await shot(page,id+'-keyboard-reduced-motion');
  await page.goto(ready.url+'/app/timeline/empty/current-preview?workspaceId=synthetic-foreign-project');await page.getByRole('heading',{name:'Private preview',exact:true}).waitFor();await shot(page,id+'-preview-empty');
  // Explicit network/auth seam states. These are not domain success evidence.
  for(const state of ['loading','disabled','restricted','error']){
   const extra=await context.newPage();let release;const hold=new Promise(r=>release=r);
   await extra.route('**/api/ping/assistant',async route=>{if(state==='loading'){await hold;await route.continue();}else await route.fulfill({status:state==='restricted'?401:state==='error'?503:200,contentType:'application/json',body:JSON.stringify(state==='disabled'?{version:'ping.assistant.v1',ok:true,available:false}:{version:'ping.assistant.v1',ok:false,code:state,message:state==='restricted'?'Synthetic session unavailable.':'Synthetic transport unavailable.'})});});
   await open(extra);if(state!=='loading')await extra.waitForTimeout(150);await shot(extra,id+'-'+state);release();await extra.close();
  }
  results.push({viewport:id,status:'passed',lostRequestId:lostRequest.requestId,reentryRequestId:absentRequest.requestId,counts:{created100:100,archived90:90,draftApplied:2,recoverySavedOnce:2,reentrySavedOnce:2},reducedMotion:true,keyboardFocus:true});await context.close();
 }
 await fs.writeFile(path.join(output,'receiving.json'),JSON.stringify({source:ready.head,scope:ready.scope,results,screenshots,errors,network,consoleMessages,finishedAt:new Date().toISOString()},null,2));
 assert.equal(errors.length,0,'Browser page errors');console.log(JSON.stringify({passed:results.length,screenshots:screenshots.length,errors:errors.length,expectedInjectedNetworkFailures:network.length}));
}catch(error){await fs.writeFile(path.join(output,'receiving-failed.json'),JSON.stringify({results,screenshots,errors,network,consoleMessages,error:String(error)},null,2));throw error;}finally{await browser.close();}
