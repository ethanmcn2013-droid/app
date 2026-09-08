import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'../..');
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const hash=value=>createHash('sha256').update(value).digest('hex');

// Only framework navigation, ambient suite metadata and the completion side
// effect are adapters. Calendar authority, Floor, store and CSS are real source.
const adapters={
  'next/link':`import React from 'react';export default function Link(props){return <a {...props}/>}`,
  'next/navigation':`export const usePathname=()=>'/app/tasks';export const useRouter=()=>({push:()=>{}});`,
  '@/components/app/use-suite-context':`export const useSuiteContext=()=>({workspaceId:'calendar-project'});`,
  '@/lib/domain-context':`export const useColumnConfig=()=>null;`,
  '@/components/app/done-dopamine/first-completion-moment':`export const maybeFireFirstCompletion=()=>{};`,
};
const entry=`import React from 'react';
import {FloorWorkspace} from '@/components/floor/floor-workspace';
import {timeOf} from '@/components/floor/floor-board';
import {LabStoreProvider,useLabStore} from '@/components/hybrid/store';
import {RoomBriefProvider,useCalendarFrame} from '@/components/app/room/room-brief-context';
import {createCalendarFrame,PINNED_REVIEW_CALENDAR_FRAME} from '@/lib/calendar-frame';
import {addDays} from '@/components/hybrid/dates';
import styles from '@/components/floor/floor.module.css';
export {createCalendarFrame,PINNED_REVIEW_CALENDAR_FRAME,timeOf,addDays};
function Surface(){const store=useLabStore(),frame=useCalendarFrame();return <><output hidden data-frame>{frame.today}</output><FloorWorkspace view="board" tasks={store.tasks} projectName="Project calendar" initials="EC" onOpenPlanning={()=>{}}/></>}
export function App({frame,tasks}){return <RoomBriefProvider value={{calendarFrame:frame,purpose:null,periodName:null,dateWindow:null,ownerName:null}}><LabStoreProvider initialTasks={tasks} initialInspectedId={null} readOnly={false} onInspectedChange={()=>{}}><Surface/></LabStoreProvider></RoomBriefProvider>}
`;

// Shared with the date-function suite so its tests execute the exported source
// function, not a copied parser. No browser is launched merely by importing.
export async function buildFloorCalendarFixture(out,{browserBundle=false}={}) {
  await fs.mkdir(out,{recursive:true});
  const common={bundle:true,metafile:true,absWorkingDir:root,alias:{'@':path.join(root,'src')},jsx:'automatic',logLevel:'silent',plugins:[{
    name:'calendar-request-adapters',setup(build){
      build.onResolve({filter:/.*/},a=>Object.hasOwn(adapters,a.path)?{path:a.path,namespace:'adapter'}:undefined);
      build.onLoad({filter:/.*/,namespace:'adapter'},a=>({contents:adapters[a.path],loader:'jsx',resolveDir:root}));
    },
  }]};
  const server=await esbuild.build({...common,platform:'node',format:'cjs',stdin:{contents:entry+`import {renderToString} from 'react-dom/server';export const render=props=>renderToString(<App {...props}/>);`,loader:'jsx',resolveDir:root},outfile:path.join(out,'server.cjs')});
  const model=require(path.join(out,'server.cjs'));
  let browser;
  if(browserBundle)browser=await esbuild.build({...common,platform:'browser',define:{'process.env':'{}','process.env.NODE_ENV':'"development"'},stdin:{contents:entry+`
import {hydrateRoot,createRoot} from 'react-dom/client';
window.hydrationErrors=[];let mounted;
window.start=(props,hydrate)=>{mounted=hydrate?hydrateRoot(document.getElementById('root'),<App {...props}/>,{onRecoverableError:e=>window.hydrationErrors.push(e.message)}):createRoot(document.getElementById('root'));if(!hydrate)mounted.render(<App {...props}/>);};
window.update=props=>mounted.render(<App {...props}/>);
window.read=()=>({frame:document.querySelector('[data-frame]')?.textContent,header:document.querySelector('.'+styles.headFacts+' > span:first-child')?.textContent,summary:[...document.querySelectorAll('.'+styles.headFacts+' button')].map(n=>n.textContent),cards:[...document.querySelectorAll('article[data-id]')].map(n=>{const chip=n.querySelector('[data-t]');return {id:n.dataset.id,kind:chip?.dataset.t??'none',label:chip?[...chip.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join(''):'',title:chip?.title??''};}),hydrationErrors:window.hydrationErrors});`,loader:'jsx',resolveDir:root},outfile:path.join(out,'browser.js')});
  const sourceInputs={};
  for(const file of new Set([...Object.keys(server.metafile.inputs),...Object.keys(browser?.metafile.inputs??{})]))if(file.startsWith('src/'))sourceInputs[file]=hash((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n'));
  return {model,sourceInputs};
}

function clock(now) {
  const NativeDate=globalThis.Date;
  globalThis.Date=class extends NativeDate {
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return new NativeDate(now).getTime();}
  };
  return ()=>{globalThis.Date=NativeDate;};
}

export async function runFloorCalendarBrowser() {
  const out=path.resolve(process.env.FLOOR_CALENDAR_OUTPUT??path.join(root,'experience/output/recipient-project-work/floor-calendar'));
  await fs.mkdir(out,{recursive:true});
  assert.equal(await fs.access(path.join(out,'receipt.json')).then(()=>true,()=>false),false,'Use a fresh calendar evidence directory');
  const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status:'running',adapters:Object.keys(adapters),sourceInputs:{},cases:[],limits:[
    'Actual Floor, RoomBriefProvider, LabStoreProvider/reducer, React SSR/hydration and global/module CSS; synthetic task prerequisites and listed request/context adapters.',
    'Wall clock/timezone are controlled only in this fixture. No Next/Clerk, database, real provider, physical device, registry adoption or human-comprehension acceptance.',
    'Request-frame updates are explicit; no autonomous midnight service is supplied or tested.',
  ]};
  let browser,server;
  try {
    const {model,sourceInputs}=await buildFloorCalendarFixture(out,{browserBundle:true});
    receipt.sourceInputs=sourceInputs;
    const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
    const css=await postcss([require('@tailwindcss/postcss')({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
    const assets={'/app.css':css.css,'/browser.js':await fs.readFile(path.join(out,'browser.js')),'/browser.css':await fs.readFile(path.join(out,'browser.css'))};
    receipt.appCssSha256=hash(css.css);receipt.styleDependencies={};
    for(const msg of css.messages)if(msg.type==='dependency'&&msg.file)receipt.styleDependencies[path.relative(root,msg.file)]=hash(await fs.readFile(msg.file));
    for(const name of ['Geist','GeistMono'])assets[`/${name}.woff2`]=await fs.readFile(path.join(root,`docs/design/labs/tasks-2026-08/fonts/${name}.woff2`));
    receipt.fonts=Object.fromEntries(['Geist','GeistMono'].map(n=>[n,hash(assets[`/${n}.woff2`])]));
    let markup='';
    const html=()=>`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/browser.css"><style>@font-face{font-family:Geist;src:url('/Geist.woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('/GeistMono.woff2');font-weight:100 900}:root{--font-geist-sans:Geist;--font-geist-mono:'Geist Mono'}body{margin:0}#root{height:100dvh;display:flex;min-width:0}</style></head><body><div id="root">${markup}</div><script src="/browser.js"></script></body></html>`;
    server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':req.url.endsWith('.woff2')?'font/woff2':'text/html');res.end(assets[req.url]??html());});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    browser=await require('@playwright/test').chromium.launch({headless:true});
    receipt.environment={node:process.version,platform:process.platform,chromium:browser.version()};
    const scenarios=[
      {id:'demo-host-drift',now:'2026-09-05T12:00:00Z',zone:'America/Los_Angeles',frame:{...model.PINNED_REVIEW_CALENDAR_FRAME,source:'demo'},header:'Thu 16 Jul'},
      {id:'project-ahead-of-UTC',now:'2026-07-15T23:30:00Z',zone:'Europe/Dublin',header:'Thu 16 Jul'},
      {id:'project-behind-UTC',now:'2026-07-16T02:00:00Z',zone:'America/Los_Angeles',header:'Wed 15 Jul'},
      {id:'timezone-hydration',now:'2026-07-16T12:00:00Z',ssr:'2026-07-16T12:00:00Z',zone:'Pacific/Kiritimati',header:'Fri 17 Jul'},
      {id:'UTC-midnight-hydration',now:'2026-07-16T00:01:00Z',ssr:'2026-07-15T23:59:00Z',zone:'Europe/Dublin',header:'Thu 16 Jul'},
      {id:'DST-hydration',now:'2026-03-08T07:01:00Z',ssr:'2026-03-08T06:59:00Z',zone:'America/New_York',header:'Sun 8 Mar'},
      {id:'mounted-frame-update',now:'2026-07-15T23:59:00Z',zone:'UTC',header:'Wed 15 Jul',update:'2026-07-16T00:01:00Z'},
      {id:'mounted-timezone-update',now:'2026-07-16T10:00:00Z',zone:'UTC',header:'Thu 16 Jul',updateZone:'Asia/Tokyo'},
    ];
    for(const viewport of [{width:390,height:844},{width:1280,height:900}])for(const scenario of scenarios) {
      const frame=scenario.frame??model.createCalendarFrame({now:new Date(scenario.ssr??scenario.now),timeZone:scenario.zone});
      const tasks=[
        ['today','Confirm the venue arrival plan','todo',{kind:'due',dueOn:frame.today}],
        ['late','Confirm supplier access','todo',{kind:'due',dueOn:model.addDays(frame.today,-1)}],
        ['tomorrow','Share the arrival details','doing',{kind:'range',startOn:frame.today,dueOn:model.addDays(frame.today,1)}],
        ['undated','Collect the remaining questions','todo',{kind:'unscheduled'}],
        ['milestone','Approve the final plan','review',{kind:'milestone',on:frame.today}],
        ['done','Confirm the booking','done',{kind:'due',dueOn:frame.today}],
      ].map(([id,title,status,schedule],order)=>({id,title,status,schedule,order,description:'Keep everyone working from the agreed project date.',priority:'high',assigneeIds:[],labelIds:[],subtasks:[],attachments:[],comments:[],blockedByIds:[],blockerIds:[],completed:status==='done',completedAt:status==='done'?(scenario.updateZone?'2026-07-15T23:30:00Z':frame.nowIso):undefined,workspaceId:'calendar-project'}));
      const props={frame,tasks};
      const restore=clock(scenario.ssr??scenario.now);
      try{markup=scenario.ssr?model.render(props):'';}finally{restore();}
      const result={id:scenario.id,viewport,clock:scenario.now,serverClock:scenario.ssr??null,frame,checks:[]};
      receipt.cases.push(result);
      const check=(name,actual,expected)=>{result.checks.push({name,actual,expected,ok:JSON.stringify(actual)===JSON.stringify(expected)});assert.deepEqual(actual,expected,name);};
      const page=await browser.newPage({viewport,timezoneId:scenario.zone,reducedMotion:'reduce'}),errors=[];
      page.setDefaultTimeout(10000);
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      await page.addInitScript(now=>{const NativeDate=Date;window.wallClock=now;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.wallClock]));}static now(){return new NativeDate(window.wallClock).getTime();}};},scenario.now);
      await page.goto(origin);
      await page.evaluate(({props,hydrate})=>window.start(props,hydrate),{props,hydrate:!!scenario.ssr});
      await page.locator('article[data-id="today"]').waitFor();await page.evaluate(()=>document.fonts.ready);
      const read=()=>page.evaluate(()=>window.read());
      result.initial=await read();
      check('project header',result.initial.header,scenario.header);
      check('today count excludes completed and milestone',result.initial.summary,['1 today','1 overdue','1 with no date']);
      check('date facts',result.initial.cards.map(c=>[c.id,c.kind]).sort(),[['today','today'],['late','overdue'],['tomorrow','soon'],['undated','none'],['milestone','milestone'],['done','done']].sort());
      check('tomorrow range label',result.initial.cards.find(c=>c.id==='tomorrow').label,'Tomorrow');
      check('hydration agrees',result.initial.hydrationErrors,[]);
      if(scenario.ssr){check('SSR contains frame header',markup.includes(scenario.header),true);await fs.writeFile(path.join(out,`${scenario.id}-${viewport.width}-ssr.html`),markup);}
      await page.screenshot({path:path.join(out,`${scenario.id}-${viewport.width}.png`),animations:'disabled'});
      const ids=async()=>(await read()).cards.map(c=>c.id).sort();
      await page.getByRole('button',{name:'1 today',exact:true}).click();check('today filter',await ids(),['today']);
      await page.getByRole('button',{name:'1 today',exact:true}).click();
      await page.getByRole('button',{name:'1 overdue',exact:true}).click();check('overdue filter',await ids(),['late']);
      await page.getByRole('button',{name:'1 today',exact:true}).click();check('combined filters intersect',await ids(),[]);
      await page.getByRole('button',{name:'1 overdue',exact:true}).click();await page.getByRole('button',{name:'1 today',exact:true}).click();
      check('clearing restores existing tasks',await ids(),tasks.map(t=>t.id).sort());
      if(scenario.update){
        await page.evaluate(({props,now})=>{window.wallClock=now;window.update(props);},{props,now:scenario.update});
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        check('clock alone retains request snapshot',await read(),result.initial);
        const next={...props,frame:model.createCalendarFrame({now:new Date(scenario.update),timeZone:scenario.zone})};
        await page.evaluate(props=>window.update(props),next);await page.waitForFunction(()=>window.read().header==='Thu 16 Jul');
        result.updated=await read();
        check('updated summary',result.updated.summary,['1 today','2 overdue','1 with no date']);
        check('updated board matches header',result.updated.cards.filter(c=>['today','tomorrow'].includes(c.id)).map(c=>[c.id,c.kind]).sort(),[['today','overdue'],['tomorrow','today']]);
        await page.getByRole('button',{name:'1 today',exact:true}).click();check('updated today filter',await ids(),['tomorrow']);
        await page.getByRole('button',{name:'1 today',exact:true}).click();
        await page.screenshot({path:path.join(out,`${scenario.id}-${viewport.width}-updated.png`),animations:'disabled'});
      }
      if(scenario.updateZone){
        check('UTC completion date',result.initial.cards.find(c=>c.id==='done').label,'15 Jul');
        await page.evaluate(props=>window.update(props),{...props,frame:model.createCalendarFrame({now:new Date(scenario.now),timeZone:scenario.updateZone})});
        await page.waitForFunction(()=>window.read().cards.find(c=>c.id==='done').label==='Today');
        result.updated=await read();check('timezone update keeps header',result.updated.header,scenario.header);check('completion timezone updates',result.updated.cards.find(c=>c.id==='done').label,'Today');
      }
      check('no browser errors',errors,[]);check('no later hydration recovery',(await read()).hydrationErrors,[]);
      await page.close();
    }
    receipt.status='passed';
  }catch(error){receipt.status='failed';receipt.error={name:error.name,message:error.message};throw error;}
  finally{
    try{await browser?.close();}catch(error){receipt.status='failed';receipt.cleanupError=error.message;}
    try{if(server?.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}catch(error){receipt.status='failed';receipt.cleanupError=error.message;}
    await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));
  }
  assert.equal(receipt.status,'passed','Calendar fixture/cleanup failed');
  console.log(JSON.stringify({status:receipt.status,cases:receipt.cases.length,checks:receipt.cases.reduce((n,c)=>n+c.checks.length,0),receipt:path.join(out,'receipt.json')}));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runFloorCalendarBrowser();
