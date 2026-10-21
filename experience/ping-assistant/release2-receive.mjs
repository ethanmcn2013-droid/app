import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const output=path.resolve(process.argv[2]);
const ready=JSON.parse(await fs.readFile(path.join(output,'ready.json'),'utf8'));
const root=process.cwd(),browser=await chromium.launch({headless:true});
const evidence={version:'ping.release2.synthetic-receiver.v1',startedAt:new Date().toISOString(),ready,exactInputs:[],checks:[],screenshots:[],errors:[],httpErrors:[],networkFailures:[],navigationTransitions:[],expectedNavigationAborts:[]};
async function snapshot(){const r=await fetch(ready.url+'/fixture/snapshot');assert.equal(r.status,200);return r.json();}
async function shot(page,id){const file=path.join(output,id+'.png');await page.screenshot({path:file,fullPage:true});const bytes=await fs.readFile(file);evidence.screenshots.push({id,path:file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}
let controlledNavigation=null;
function beginControlledNavigation(page,target){const transition={from:new URL(page.url()).pathname,to:new URL(target,ready.url).pathname,startedAt:new Date().toISOString(),completedAt:null};evidence.navigationTransitions.push(transition);controlledNavigation=transition;return transition;}
function finishControlledNavigation(transition){transition.completedAt=new Date().toISOString();setTimeout(()=>{if(controlledNavigation===transition)controlledNavigation=null;},1500);}
async function openPing(page,pathName='/assistant'){const transition=beginControlledNavigation(page,pathName);await page.goto(ready.url+pathName);await page.getByRole('textbox',{name:'Request for Ping'}).waitFor();finishControlledNavigation(transition);}
async function openConversation(page,pathName='/conversation',query=''){const target=pathName+query,transition=beginControlledNavigation(page,target);await page.goto(ready.url+target);await page.getByRole('textbox',{name:'Message Synthetic launch'}).waitFor();await page.getByText('We decided the welcome drink will be Spritz.').waitFor();finishControlledNavigation(transition);}
async function send(page,text){evidence.exactInputs.push({text,viewport:page.viewportSize(),path:new URL(page.url()).pathname});await page.getByRole('textbox',{name:'Request for Ping'}).fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();await page.waitForFunction(()=>{const e=document.querySelector('textarea[aria-label="Request for Ping"]');return !!e&&!e.disabled&&e.value==='';},null,{timeout:15000});}
async function applyLatest(page){const buttons=page.getByRole('button',{name:'Apply plan',exact:true});assert.ok(await buttons.count());await buttons.last().click();await page.waitForFunction(()=>{const e=document.querySelector('textarea[aria-label="Request for Ping"]');return !!e&&!e.disabled&&e.value==='';},null,{timeout:20000});}
async function check(name,details={}){evidence.checks.push({name,ok:true,...details});}
async function inspectPersonAvatar(page,theme){return page.evaluate(theme=>{
  document.documentElement.dataset.theme=theme;
  const avatar=[...document.querySelectorAll('[aria-hidden="true"][data-tone]')].find(node=>node.textContent?.trim()==='BO');
  if(!avatar)throw new Error('The rendered Bob DM has no person avatar');
  const foreground=getComputedStyle(avatar).color,background=getComputedStyle(avatar).backgroundColor;
  const accentToken=getComputedStyle(document.documentElement).getPropertyValue('--v3-accent').trim();
  const probe=document.createElement('span');probe.style.color='var(--v3-accent)';document.body.append(probe);const accent=getComputedStyle(probe).color;probe.remove();
  const luminance=rgb=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw new Error('Could not create a color-conversion canvas');
  const toRgb=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);};
  const fg=toRgb(foreground),bg=toRgb(background),ac=toRgb(accent);
  const contrast=(Math.max(luminance(fg),luminance(bg))+.05)/(Math.min(luminance(fg),luminance(bg))+.05);
  const accentDistance=Math.hypot(bg[0]-ac[0],bg[1]-ac[1],bg[2]-ac[2]);
  return{theme,foreground,background,accent,accentToken,contrast,accentDistance};
},theme);}
try{
  const viewport=process.argv[3]||'1440x960';
  const [width,height]=viewport.split('x').map(Number);assert.ok(width&&height,'Use widthxheight');
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>evidence.errors.push({kind:'pageerror',message:error.message}));
  page.on('console',message=>{if(message.type()==='error')evidence.errors.push({kind:'console',message:message.text()});});
  page.on('response',response=>{if(response.status()>=400)evidence.httpErrors.push({status:response.status(),url:response.url()});});
  page.on('requestfailed',request=>{const failure={url:request.url(),method:request.method(),error:request.failure()?.errorText};
    if(controlledNavigation&&request.method()==='GET'&&new URL(request.url()).pathname==='/api/ping/assistant'&&failure.error==='net::ERR_ABORTED')evidence.expectedNavigationAborts.push({...failure,at:new Date().toISOString(),transition:controlledNavigation});
    else evidence.networkFailures.push(failure);
  });
  await openPing(page,'/assistant-source');await shot(page,`${viewport}-source-empty`);
  let before=await snapshot();
  await send(page,'What did we decide about drinks?');
  let after=await snapshot();
  assert.equal(after.tasks.length,before.tasks.length,'answer-only source query must not mutate tasks');
  const quote=page.getByText('The conversation says the welcome drink is Spritz.');await quote.waitFor();
  const citation=page.locator('blockquote a[href]');assert.ok(await citation.count(),'answer should cite a real source and link to its canonical message');
  assert.ok((await citation.first().getAttribute('href'))?.includes(ready.sourceMessageId));
  await shot(page,`${viewport}-source-quoted-linked`);await check('canonical conversation context quoted and linked',{messageId:ready.sourceMessageId});

  await openPing(page,'/assistant-source');await shot(page,`${viewport}-plan-first-empty`);
  before=await snapshot();await send(page,'Create florist reminder tomorrow at 10');after=await snapshot();
  assert.equal(after.tasks.length,before.tasks.length,'draft plan did not change task rows before approval');
  assert.equal(after.executions,before.executions);assert.equal(after.plans,before.plans+1);
  assert.equal(await page.getByRole('button',{name:'Apply plan',exact:true}).count(),1);await shot(page,`${viewport}-florist-plan-unapplied`);
  const planRequest=after.requests.at(-1).requestId;const planRun=after.runs.find(r=>r.request_id===planRequest);assert.equal(planRun.status,'ready');

  await send(page,'Make it 11');await page.getByText("Here's the plan").last().waitFor();
  let runs=await snapshot();assert.equal(runs.tasks.length,before.tasks.length);assert.ok(runs.runs.some(r=>r.id===planRun.id&&r.status==='cancelled'),'superseded original waiting plan must no longer be applicable');
  const replacedCard=page.locator('[aria-label="Ping requests and results"] > ol > li').filter({has:page.getByText('Create florist reminder tomorrow at 10',{exact:true})});
  await replacedCard.getByText('This plan was replaced by your follow-up. Nothing was applied.').waitFor();
  assert.equal(await replacedCard.getByRole('button',{name:'Apply plan',exact:true}).count(),0,'a server-cancelled plan must not retain an Apply control');
  assert.equal(await replacedCard.getByRole('button',{name:'Cancel',exact:true}).count(),0,'a server-cancelled plan must not retain a Cancel control');
  await page.reload();await page.getByRole('textbox',{name:'Request for Ping'}).waitFor();await page.getByText("Create 1 task in this Project: Call the florist").waitFor();
  assert.equal(await page.getByRole('button',{name:'Apply plan',exact:true}).count(),1);await page.getByText('View details for all 1 tasks').last().click();
  await page.getByText(/Due tomorrow · 11:00/).waitFor();await check('follow-up time edit keeps the original waiting plan day and cancelled prior plan is no longer applicable');
  await send(page,'What time is the florist reminder?');await page.getByText('The waiting plan has the florist reminder at 11:00.').waitFor();
  assert.equal((await snapshot()).tasks.length,before.tasks.length);await shot(page,`${viewport}-waiting-plan-memory`);await check('question answered from current waiting plan');
  runs=await snapshot();const revisedRequest=runs.requests.find(r=>r.text==='Make it 11').requestId;const revisedRun=runs.runs.find(r=>r.request_id===revisedRequest);assert.equal(revisedRun.status,'ready');
  await send(page,'Assign it to Bob');await page.getByText('View details for all 1 tasks').last().click();await page.getByText('Assigned to bob').last().waitFor();
  runs=await snapshot();assert.equal(runs.tasks.length,before.tasks.length);assert.ok(runs.runs.some(r=>r.id===revisedRun.id&&r.status==='cancelled'),'a follow-up after an answer must still replace the ancestor waiting plan');
  const answeredAncestor=page.locator('[aria-label="Ping requests and results"] > ol > li').filter({has:page.getByText('Make it 11',{exact:true})});
  await answeredAncestor.getByText('This plan was replaced by your follow-up. Nothing was applied.').waitFor();
  assert.equal(await answeredAncestor.getByRole('button',{name:'Apply plan',exact:true}).count(),0,'the waiting plan behind an answer must not retain an Apply control');
  assert.equal(await answeredAncestor.getByRole('button',{name:'Cancel',exact:true}).count(),0,'the waiting plan behind an answer must not retain a Cancel control');
  await shot(page,`${viewport}-answered-ancestor-plan-cancelled`);
  await check('answer-follow-up edit reconciles ancestor waiting plan before Apply');
  await check('follow-up owner edit remains draft until apply');
  const appliedPlanRequest=(await snapshot()).requests.at(-1).requestId;
  await applyLatest(page);after=await snapshot();
  let florist=after.tasks.find(t=>t.title==='Call the florist');assert.ok(florist);assert.equal(florist.due,'2026-10-22 11:00');
  assert.deepEqual(JSON.parse(florist.assignees),['bob']);await shot(page,`${viewport}-florist-applied`);await check('apply persists edited task date, clock, and owner',{taskId:florist.id,due:florist.due,assignees:florist.assignees});
  await page.getByRole('button',{name:'Undo step',exact:true}).last().click();
  await page.waitForFunction(async()=>{const s=await fetch('/fixture/snapshot').then(r=>r.json());const t=s.tasks.find(t=>t.title==='Call the florist');return t?.archived_at!==null;});
  const undone=await snapshot();florist=undone.tasks.find(t=>t.title==='Call the florist');assert.ok(florist.archived_at);await shot(page,`${viewport}-florist-undo`);
  const history=await fetch(ready.url+'/api/ping/assistant').then(r=>r.json());const undoneRun=history.runs.find(r=>r.requestId===appliedPlanRequest);const undoneStep=undoneRun.steps.find(s=>s.kind==='create_tasks');
  const repeated=await fetch(ready.url+'/api/ping/assistant',{method:'POST',headers:{'content-type':'application/json',origin:ready.url},body:JSON.stringify({operation:'undo',runId:undoneRun.id,stepId:undoneStep.id})});
  assert.equal(repeated.status,200);assert.equal((await snapshot()).undos,1,'repeating Undo cannot apply it twice');assert.equal(await page.getByRole('button',{name:'Undo step',exact:true}).count(),0);await check('per-step task Undo is idempotent and database freshness is visible');

  await send(page,'Create a new Project with one starter task');before=await snapshot();assert.equal(before.tasks.some(t=>t.title==='Confirm kickoff'),false);
  await applyLatest(page);after=await snapshot();const kickoff=after.tasks.find(t=>t.title==='Confirm kickoff');assert.ok(kickoff);assert.notEqual(kickoff.workspace_id,ready.privateConversationId);await check('dependent Project creation and task assignment persisted',{projectId:kickoff.workspace_id,taskId:kickoff.id});

  await send(page,'Tick Catering on the wedding checklist');before=await snapshot();assert.equal(before.tasks.find(t=>t.id==='release2_child_catering').completed_at,null);
  await applyLatest(page);after=await snapshot();assert.notEqual(after.tasks.find(t=>t.id==='release2_child_catering').completed_at,null);
  assert.equal(after.tasks.find(t=>t.id==='release2_child_music').completed_at,null);assert.equal(after.tasks.find(t=>t.id==='release2_wedding_plan').completed_at,null);
  await shot(page,`${viewport}-checklist-one-child`);await check('checklist action toggles only the exact child item');

  await send(page,'Message Bob privately: please review the florist task');before=await snapshot();
  assert.equal(before.messages.filter(m=>m.body==='Please review the florist task.').length,0,'message stays unsent until Apply');
  await applyLatest(page);after=await snapshot();const privateMessage=after.messages.find(m=>m.body==='Please review the florist task.');assert.ok(privateMessage);
  assert.equal(privateMessage.conversation_id,ready.privateConversationId);assert.notEqual(privateMessage.conversation_id,ready.sourceConversationId);
  const sentPrivate=after.messages.find(m=>m.body==='Please review the florist task.');
  await page.getByRole('button',{name:'Take back',exact:true}).last().click();await page.waitForFunction(async(id)=>{const s=await fetch('/fixture/snapshot').then(r=>r.json());const m=s.messages.find(m=>m.id===id);return m?.deleted_at!==null;},sentPrivate.id);
  after=await snapshot();assert.ok(after.messages.find(m=>m.id===sentPrivate.id).deleted_at);await check('private message targets only accepted DM and canonical Undo takes it back');

  await send(page,'Draft one cancellable task');before=await snapshot();await page.getByRole('button',{name:'Cancel',exact:true}).last().click();
  await page.waitForFunction(()=>document.body.innerText.includes('Cancelled'));after=await snapshot();assert.equal(after.tasks.length,before.tasks.length);await check('Cancel closes a pending draft without mutation');

  await openPing(page,'/assistant-dm-source');await send(page,'What did Bob say about the client review?');
  await page.getByText('Bob said the client review is Friday.').waitFor();
  const dmCitation=page.locator('blockquote a[href]');await dmCitation.first().waitFor();
  const dmHref=await dmCitation.first().getAttribute('href');assert.ok(dmHref);
  const dmTarget=new URL(dmHref,'https://app.signalstudio.ie');assert.equal(dmTarget.pathname,'/app/messages');
  assert.equal(dmTarget.searchParams.get('conversationId'),ready.privateConversationId);assert.equal(dmTarget.searchParams.get('messageId'),ready.privateSourceMessageId);
  await dmCitation.first().click();await page.getByRole('textbox',{name:'Message bob'}).waitFor();
  await page.getByText('Client review is Friday.').waitFor();
  const messageGet= (await snapshot()).conversationRequests.filter(r=>r.method==='GET'&&r.action==='messages'&&r.conversationId===ready.privateConversationId);
  assert.ok(messageGet.length>0,'exact private message target should load its canonical message page');
  assert.equal(new URL(page.url()).pathname,'/app/messages');assert.equal(new URL(page.url()).searchParams.get('conversationId'),ready.privateConversationId);
  const avatarColors=[];for(const theme of ['dark','light']){const colors=await inspectPersonAvatar(page,theme);assert.ok(colors.accentDistance>80,`${theme} person avatar fill must remain visually distinct from Signal indigo`);assert.ok(colors.contrast>=4.5,`${theme} person avatar initials need at least 4.5:1 contrast`);avatarColors.push(colors);if(theme==='light')await shot(page,`${viewport}-exact-private-message-navigation-light`);}
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await check('rendered DM person avatar stays outside Signal indigo and keeps readable initials in light and dark themes',{avatarColors});
  await shot(page,`${viewport}-exact-private-message-navigation`);await check('private source link opens the exact existing DM and canonical message, without Project fallback',{href:dmHref,messageId:ready.privateSourceMessageId,conversationId:ready.privateConversationId});

  await openConversation(page);
  const chatBox=page.getByRole('textbox',{name:'Message Synthetic launch'});
  await chatBox.fill('Keep this shared draft for later.');await page.getByRole('button',{name:'Ask Ping privately'}).click();
  await page.getByRole('textbox',{name:'Request for Ping'}).waitFor();await page.getByRole('button',{name:'Back to conversation'}).click();
  assert.equal(await chatBox.inputValue(),'Keep this shared draft for later.','opening/closing Ping keeps the existing shared draft');
  await chatBox.fill('@Ping Create florist reminder tomorrow at 10');
  const beforePrivate=await snapshot(),pingSubmitsBefore=beforePrivate.requests.filter(r=>r.operation==='submit').length,sharedSendsBefore=beforePrivate.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').length;
  await chatBox.press('Enter');await page.getByRole('textbox',{name:'Request for Ping'}).waitFor();
  await page.getByText('Create 1 task in this Project: Call the florist').waitFor();
  const afterPrivate=await snapshot();
  assert.equal(afterPrivate.requests.filter(r=>r.operation==='submit').length,pingSubmitsBefore+1,'@Ping dispatches exactly one private assistant draft request');
  assert.equal(afterPrivate.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').length,sharedSendsBefore,'@Ping never posts to the shared chat');
  assert.equal(afterPrivate.tasks.length,beforePrivate.tasks.length,'the plan does not mutate tasks before Apply');
  assert.equal(afterPrivate.messages.length,beforePrivate.messages.length,'the request does not create shared or private messages before Apply');
  await shot(page,`${viewport}-at-ping-private-draft`);await check('desktop @Ping Enter routes once to a private plan, with no pre-Apply domain write');
  const privateCount=afterPrivate.requests.filter(r=>r.operation==='submit').length;
  const reloadTransition=beginControlledNavigation(page,page.url());await page.reload();await page.getByRole('textbox',{name:'Message Synthetic launch'}).waitFor();await page.getByText('We decided the welcome drink will be Spritz.').waitFor();finishControlledNavigation(reloadTransition);
  assert.equal((await snapshot()).requests.filter(r=>r.operation==='submit').length,privateCount,'reload does not auto-replay the forwarded command');
  const afterReload=await snapshot();assert.equal(afterReload.tasks.length,beforePrivate.tasks.length);assert.equal(afterReload.messages.length,beforePrivate.messages.length);
  await check('reload does not replay the forwarded @Ping request');
  const beforeOrdinary=afterReload.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').length;
  await page.getByRole('textbox',{name:'Message Synthetic launch'}).fill('Ordinary shared message.');await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByText('Ordinary shared message.').last().waitFor();
  await page.waitForFunction(async(expected)=>{const response=await fetch('/fixture/snapshot');if(!response.ok)return false;const state=await response.json();return state.conversationRequests.filter(request=>request.method==='POST'&&request.action==='send').length>=expected&&state.messages.some(message=>message.body==='Ordinary shared message.');},beforeOrdinary+1,{timeout:10000});
  const afterOrdinary=await snapshot();
  assert.equal(afterOrdinary.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').length,beforeOrdinary+1,'ordinary messages still use canonical shared send once');
  assert.equal(afterOrdinary.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').at(-1).conversationId,ready.sourceConversationId);
  await check('ordinary Send uses canonical shared conversation path exactly once');

  const mobileContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),mobile=await mobileContext.newPage();
  mobile.on('pageerror',error=>evidence.errors.push({kind:'pageerror',viewport:'390x844-private-ping',message:error.message}));
  await openConversation(mobile);const mobileBox=mobile.getByRole('textbox',{name:'Message Synthetic launch'});
  await mobileBox.fill('@Ping Draft one cancellable task');const mobileBefore=await snapshot();
  const mobileSubmitCount=mobileBefore.requests.filter(r=>r.operation==='submit').length,mobileSharedCount=mobileBefore.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').length;
  await mobile.getByRole('button',{name:'Send',exact:true}).click();await mobile.getByRole('textbox',{name:'Request for Ping'}).waitFor();await mobile.getByText('Create 1 task in this Project: Cancellable task').waitFor();
  const mobileAfter=await snapshot();assert.equal(mobileAfter.requests.filter(r=>r.operation==='submit').length,mobileSubmitCount+1);assert.equal(mobileAfter.conversationRequests.filter(r=>r.method==='POST'&&r.action==='send').length,mobileSharedCount);assert.equal(mobileAfter.tasks.length,mobileBefore.tasks.length);assert.equal(mobileAfter.messages.length,mobileBefore.messages.length);
  await shot(mobile,'390x844-at-ping-private-draft');await check('phone Send button routes @Ping once to a private plan without shared send or pre-Apply writes');await mobileContext.close();

  await page.evaluate(()=>{document.documentElement.dataset.theme='light';});await shot(page,`${viewport}-light-theme`);
  assert.deepEqual(evidence.errors,[],'browser must not report runtime errors');assert.deepEqual(evidence.networkFailures,[],'synthetic app requests must all resolve');
  assert.ok(evidence.expectedNavigationAborts.length<=1,'only a single Ping read may be cancelled by the explicit page reload');
  const selectedFiles=['src/components/app/messages/ping-personal-assistant.tsx','src/components/app/messages/ping-personal-assistant-client.ts','src/components/app/messages/conversation-workspace.tsx','src/components/app/messages/conversation-session-provider.tsx','src/components/app/messages/private-ping-command-router.tsx','src/server/ping/assistant/service.ts','src/server/ping/assistant/store.ts','src/server/ping/assistant/actions.ts','src/server/ping/assistant/undo.ts','src/server/ping/assistant/conversation-context.ts','src/server/ping/assistant/task-context.ts','src/server/ping/assistant/plan-targets.ts','src/server/ping/assistant/task-snapshot.ts','src/server/conversations/http.ts','src/server/conversations/service.ts','src/lib/ping/assistant/contract.ts','src/lib/ping/assistant/release2.ts'];
  evidence.sourceHashesAtServerStart=ready.sourceHashes;evidence.sourceHashesAfter={};for(const file of selectedFiles){const bytes=await fs.readFile(path.join(root,file));evidence.sourceHashesAfter[file]=createHash('sha256').update(bytes).digest('hex');}
  evidence.changedDuringRun=selectedFiles.filter(file=>ready.sourceHashes[file]!==evidence.sourceHashesAfter[file]);
  for(const [w,h] of [[390,844],[768,1024],[1280,900],[1440,960]]){
    const visualContext=await browser.newContext({viewport:{width:w,height:h},reducedMotion:'reduce'}),visual=await visualContext.newPage();
    visual.on('pageerror',error=>evidence.errors.push({kind:'pageerror',viewport:`${w}x${h}`,message:error.message}));
    await openPing(visual,'/assistant-source');
    for(const theme of ['dark','light']){await visual.evaluate(value=>{document.documentElement.dataset.theme=value;},theme);await shot(visual,`${w}x${h}-${theme}-history`);}
    await visualContext.close();
  }
  evidence.finishedAt=new Date().toISOString();evidence.finalSnapshot=after;evidence.scope='Synthetic receiving integration only; injected planner tests product workflow and persistence, not model quality or production authentication.';
  await fs.writeFile(path.join(output,'release2-receipt.json'),JSON.stringify(evidence,null,2));
  await context.close();console.log(JSON.stringify({receipt:path.join(output,'release2-receipt.json'),checks:evidence.checks.length,screenshots:evidence.screenshots.length}));
}catch(error){evidence.failure=String(error);evidence.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'release2-failure.json'),JSON.stringify(evidence,null,2));throw error;}
finally{await browser.close();}
