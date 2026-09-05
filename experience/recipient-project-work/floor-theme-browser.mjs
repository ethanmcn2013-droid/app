import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Actual FloorWorkspace/Board and LabStoreProvider; only Next navigation,
// suite context and the completion-notification side effect are adapters.
// This is a component/theme fixture, not a Next route or persistence claim.
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const {chromium}=require('@playwright/test');
const baseline=process.argv.includes('--baseline');
const baselineRef='e2e4a0c8864408938529ccb8caf2d8e831481669';
const cssSources={
  'src/components/floor/floor.module.css':{asset:'floor.module.css',sha256LF:'9b5beabbb2622d1d897b5aa4ef8eb00f1d9dec734b6ae48a71ea107e0e0f3879'},
  'src/components/studio-bar/active-project/active-project.module.css':{asset:'active-project.module.css',sha256LF:'f821094c3483be7423ab5cff09421f3154c7a1629f51617af9fa69c43ad7c040'},
};
const out=path.resolve(process.env.FLOOR_THEME_OUTPUT??`experience/output/recipient-project-work/floor-theme/${baseline?'before':'after'}`);
await fs.mkdir(out,{recursive:true});
assert.equal(await fs.access(path.join(out,'receipt.json')).then(()=>true,()=>false),false,'Use a fresh evidence directory');
const hash=content=>createHash('sha256').update(content).digest('hex');
// Original failed e2e4 capture, not a newly approved visual baseline. Normalize
// checkout line endings only; every other byte remains pinned, including failure.
const retainedBaseline='experience/reviews/january-recipient-2026-09-05/floor-theme-e2e4a0c8-before.json';
const baselineSha256LF='4d676b6f51493caa992a6074d66b268336ee636b530d30ea5e8ad11df57f1aa3';
async function readHistoricalBaseline() {
  const file=process.env.FLOOR_THEME_BEFORE?path.resolve(process.env.FLOOR_THEME_BEFORE,'receipt.json'):path.join(root,retainedBaseline);
  const content=(await fs.readFile(file,'utf8')).replace(/\r\n/g,'\n');
  assert.equal(hash(content),baselineSha256LF,'Floor geometry baseline SHA-256 mismatch');
  const old=JSON.parse(content);
  assert.equal(old.head,baselineRef,'Floor geometry baseline HEAD mismatch');
  assert.equal(old.cssBaselineRef,baselineRef,'Floor geometry baseline CSS identity mismatch');
  assert.equal(old.baseline,true,'Floor geometry baseline must be an original baseline capture');
  assert.equal(old.status,'failed','Keep the original failed contrast receipt as historical evidence');
  return {old,identity:{path:file,sha256LF:baselineSha256LF,head:old.head,cssBaselineRef:old.cssBaselineRef,baseline:old.baseline,status:old.status}};
}
const receipt={head:null,baseline,status:'running',sourceInputs:{},cases:[],limits:['Actual Floor components, store/reducer and global/module CSS; synthetic task prerequisites, Next/suite adapters.','No Next/Clerk/DB/provider or final experience-registry capture.','Chromium emulation, not physical-device or human-comprehension proof.']};
let browser,gateError;
const servers=[],originalCss={};
async function captureCssPass(baseline,out,head) {
await fs.mkdir(out,{recursive:true});
const baselineCss=file=>baseline&&Object.hasOwn(cssSources,file);
const readSource=async file=>baselineCss(file)?originalCss[file]:fs.readFile(path.join(root,file),'utf8');
const receipt={head,baseline,status:'running',phase:baseline?'original-css-comparison':'current-css',sourceInputs:{},cases:[]};
try {
const stubs={
  'next/link':`import React from 'react';export default function Link(props){return <a {...props}/>}`,
  'next/navigation':`export const usePathname=()=>'/app/tasks';export const useRouter=()=>({push:href=>window.navigation.push(href)});`,
  '@/components/app/use-suite-context':`export const useSuiteContext=()=>({workspaceId:'floor-fixture-project'});`,
  '@/lib/domain-context':`export const useColumnConfig=()=>null;`,
  '@/components/app/done-dopamine/first-completion-moment':`export const maybeFireFirstCompletion=()=>{};`,
  '@/components/app/active-project-provider':`export const ACTIVE_PROJECT_TRIGGER_SKELETON_WIDTH=180;export const useActiveProject=()=>window.projectFixture;`,
  '@/server/actions/project-catalog':`export const loadProjectCatalogAction=()=>{throw Error('Catalog request outside color fixture')};`,
};
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';
import {FloorWorkspace} from '@/components/floor/floor-workspace';
import styles from '@/components/floor/floor.module.css';
import {LabStoreProvider,useLabStore} from '@/components/hybrid/store';
import {ActiveProjectBarCell,ActiveProjectMobileStrip} from '@/components/studio-bar/active-project/active-project-control';
window.floorStyles=styles;window.navigation=[];
const scene=[
 ['access','Confirm the guest access list','Agree the final arrival details with the venue coordinator.','todo',{kind:'due',dueOn:'2027-01-20'}],
 ['seating','Send the seating plan','Include the two accessible tables near the entrance.','todo',{kind:'due',dueOn:'2027-01-21'}],
 ['supplier','Confirm supplier arrival times','Share the agreed loading entrance and contact number.','doing',{kind:'unscheduled'}],
 ['milestone','Approve the final arrival plan','Everyone has the same plan before the first arrival.','review',{kind:'milestone',on:'2027-01-25'}],
 ['done','Confirm the venue booking','The date and deposit are confirmed.','done',{kind:'due',dueOn:'2027-01-19'}],
].map(([id,title,description,status,schedule],order)=>({id,title,description,status,schedule,priority:'high',assigneeIds:[],labelIds:[],subtasks:[],attachments:[],comments:[],blockedByIds:[],blockerIds:[],completed:status==='done',completedAt:status==='done'?'2027-01-19T12:00:00Z':undefined,workspaceId:'floor-fixture-project',order}));
function Surface(){const store=useLabStore();return <FloorWorkspace view="board" tasks={store.tasks} projectName="January arrival plan" initials="EC" onOpenPlanning={()=>{}}/>}
const root=createRoot(document.getElementById('root'));
window.mountProject=state=>{const project={id:'project-b',name:'Arrival project B',archivedAt:state==='archived'?1:null};window.projectFixture={chrome:{kind:'verified',project},pending:state==='pending'?{label:'Arrival project B'}:null,refusal:null,lastError:null};root.render(<div key={state} style={{width:'100%'}}><header style={{background:'var(--x-studio-chrome)',height:56,display:'flex',alignItems:'center',padding:'0 16px'}}><ActiveProjectBarCell/></header><ActiveProjectMobileStrip/><main style={{padding:24,color:'var(--ink)'}}>My work</main></div>)};
if(location.search.includes('surface=project'))window.mountProject('verified');else root.render(<LabStoreProvider initialTasks={scene} initialInspectedId={null} readOnly={false} onInspectedChange={()=>{}}><Surface/></LabStoreProvider>);`;
const bundle=await esbuild.build({bundle:true,metafile:true,platform:'browser',absWorkingDir:root,alias:{'@':path.join(root,'src')},jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},stdin:{contents:entry,loader:'jsx',resolveDir:root},outfile:path.join(out,'bundle.js'),plugins:[{name:'floor-fixture-adapters',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'fixture'}:undefined);build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'jsx',resolveDir:root}));build.onLoad({filter:/\.module\.css$/},async args=>{const file=path.relative(root,args.path).replaceAll('\\','/');return baselineCss(file)?{contents:await readSource(file),loader:'local-css'}:undefined;});}}]});
const css=await postcss([require('@tailwindcss/postcss')({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
receipt.cssBaselineRef=baseline?baselineRef:null;
for(const file of Object.keys(bundle.metafile.inputs))if(file.startsWith('src/'))receipt.sourceInputs[file]=hash((await readSource(file)).replace(/\r\n/g,'\n'));
for(const file of ['src/app/globals.css','docs/design/labs/tasks-2026-08/floor.html','scripts/design/extract-floor-css.mjs'])receipt.sourceInputs[file]=hash((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n'));
receipt.styleDependencies={};
for(const msg of css.messages)if(msg.type==='dependency'&&msg.file)receipt.styleDependencies[path.relative(root,msg.file)]=hash(await fs.readFile(msg.file));
const assets={'/app.css':css.css,'/bundle.js':await fs.readFile(path.join(out,'bundle.js')),'/bundle.css':await fs.readFile(path.join(out,'bundle.css'))};
for(const name of ['Geist','GeistMono'])assets[`/${name}.woff2`]=await fs.readFile(path.join(root,`docs/design/labs/tasks-2026-08/fonts/${name}.woff2`));
receipt.fonts=Object.fromEntries(['Geist','GeistMono'].map(n=>[n,hash(assets[`/${n}.woff2`])]));
const html=`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/bundle.css"><style>@font-face{font-family:Geist;src:url('/Geist.woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('/GeistMono.woff2');font-weight:100 900}:root{--font-geist-sans:Geist;--font-geist-mono:'Geist Mono'}body{margin:0}#root{height:100dvh;display:flex;min-width:0}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
receipt.appCssSha256=hash(css.css);
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.css')?'text/css':req.url.endsWith('.woff2')?'font/woff2':'text/html');res.end(assets[req.url]??html);});
servers.push(server);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
receipt.origin=origin;
  for(const viewport of [{width:1280,height:900},{width:390,height:844}])for(const theme of ['light','dark']){
    const page=await browser.newPage({viewport,colorScheme:theme,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error(message.text());}});
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2027-01-21T12:00:00Z']))}static now(){return new NativeDate('2027-01-21T12:00:00Z').getTime()}};});
    await page.goto(origin+'/app/tasks');await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.getByRole('heading',{name:'January arrival plan'}).waitFor({timeout:10000});await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const result={theme,viewport,checks:[],failures:[]};
    const measure=async()=>page.evaluate(()=>{
      const s=window.floorStyles,canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const rgba=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
      const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
      const bg=node=>{const chain=[];for(let n=node;n;n=n.parentElement)chain.unshift(n);return chain.reduce((color,n)=>over(rgba(getComputedStyle(n).backgroundColor),color),[255,255,255,1]);};
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const read=(name,selector,pseudo)=>{const node=document.querySelector(selector);if(!node)return {name,missing:true};if(!node.getClientRects().length)return {name,hidden:true};const style=getComputedStyle(node,pseudo);const back=bg(node);return {name,foreground:style.color,background:back,contrast:ratio(over(rgba(style.color),back),back)};};
      const measures=[read('navigation',`a.${s.railTile}:not([data-active])`),read('rail mark',`.${s.railMark}`),read('selected navigation',`.${s.railTile}[data-active]`),read('secondary note',`.${s.cardNote}`),read('micro label',`.${s.trayNote}`),read('milestone', '[data-t="milestone"]'),read('overdue','[data-t="overdue"]'),read('today','[data-t="today"]'),read('completed task',`[data-done] .${s.cardTitle}`),read('completed checkbox','[data-done] [role="checkbox"]'),read('add task',`.${s.dockPrimary}`)];
      const tick=document.querySelector('[role="checkbox"][aria-checked="false"]'),ts=getComputedStyle(tick),color=ts.boxShadow.match(/(?:rgba?\([^)]*\)|color\([^)]*\))/)?.[0];
      measures.push({name:'unchecked checkbox edge',contrast:ratio(over(rgba(color),bg(tick)),bg(tick)),foreground:color,background:bg(tick)});
      if(document.querySelector('.'+s.carry))measures.push(read('undo button','.'+s.carryDo),read('completion receipt','.'+s.carry));
      const focused=document.activeElement,outline=getComputedStyle(focused);const focus=outline.outlineStyle!=='none'?{contrast:ratio(over(rgba(outline.outlineColor),bg(focused)),bg(focused)),color:outline.outlineColor,width:outline.outlineWidth}:null;
      const floor=document.querySelector('.'+s.root);const layout=Object.fromEntries(['root','sheet','head','views','board','tray','dock','rail'].map(name=>{const box=document.querySelector('.'+s[name])?.getBoundingClientRect();return [name,box?{x:box.x,y:box.y,width:box.width,height:box.height}:null];}));return {measures,layout,focus,ground:getComputedStyle(floor).backgroundColor,sheet:getComputedStyle(document.querySelector('.'+s.sheet)).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    result.rest=await measure();
    const check=(name,ok,detail)=>{result.checks.push({name,ok,detail});if(!ok)result.failures.push(name);};
    check('no viewport overflow',!result.rest.overflow);
    const nonText=new Set(['navigation','rail mark','selected navigation','completed checkbox','unchecked checkbox edge']);
    result.excluded=result.rest.measures.filter(item=>item.hidden);for(const item of result.rest.measures.filter(item=>!item.hidden)){const target=nonText.has(item.name)?3:4.5;check(item.name,!item.missing&&item.contrast>=target,{...item,target});}
    const prefix=`${viewport.width}-${theme}`;
    await page.screenshot({path:path.join(out,prefix+'-rest.png'),animations:'disabled'});
    const first=page.locator('[data-id="access"] [role="checkbox"]');await first.focus();
    result.focus=await first.evaluate(node=>({color:getComputedStyle(node).outlineColor,width:getComputedStyle(node).outlineWidth}));
    check('keyboard focus visible',parseFloat(result.focus.width)>=2,result.focus);
    result.focusContrast=(await measure()).focus;check('focus indicator contrast',result.focusContrast?.contrast>=3,result.focusContrast);
    await first.click();await page.locator('[data-id="access"][data-done]').waitFor();
    const carry=page.getByRole('button',{name:'Undo',exact:true});await carry.waitFor();
    result.undo=await carry.evaluate(node=>({text:getComputedStyle(node).color,background:getComputedStyle(node.parentElement).backgroundColor}));
    result.completed=await measure();for(const item of result.completed.measures.filter(item=>['undo button','completion receipt'].includes(item.name)))check(item.name,item.contrast>=4.5,item);
    await page.screenshot({path:path.join(out,prefix+'-completed.png'),animations:'disabled'});
    await carry.click();await page.locator('[data-id="access"] [role="checkbox"][aria-checked="false"]').waitFor();
    check('actual completion and undo',true);check('no browser errors',errors.length===0,errors);
    receipt.cases.push(result);await page.close();
  }
  receipt.projectCases=[];
  for(const viewport of [{width:390,height:844},{width:1440,height:960}])for(const theme of ['light','dark']){
    const page=await browser.newPage({viewport,colorScheme:theme,reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin+'/app/my-tasks?surface=project');await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.evaluate(()=>document.fonts.ready);
    for(const state of ['verified','pending','archived']){
      await page.evaluate(state=>window.mountProject(state),state);
      const trigger=page.locator('[data-slot="active-project-trigger"]');await trigger.waitFor();
      const result=await trigger.evaluate(node=>{
        const rgb=text=>text.match(/[\d.]+/g).map(Number);const bg=n=>{for(;n;n=n.parentElement){const s=getComputedStyle(n).backgroundColor;if(s!=='rgba(0, 0, 0, 0)')return rgb(s);}return [255,255,255];};
        const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
        const background=bg(node),label=node.querySelector('span[title]')??node.children[1],color=getComputedStyle(label).color,x=lum(rgb(color)),y=lum(background);
        return {color,background,contrast:(Math.max(x,y)+.05)/(Math.min(x,y)+.05),text:node.textContent};
      });
      result.viewport=viewport;result.theme=theme;result.state=state;result.pass=result.contrast>=4.5;receipt.projectCases.push(result);
      await page.screenshot({path:path.join(out,`project-${viewport.width}-${theme}-${state}.png`),animations:'disabled'});
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  receipt.status=receipt.cases.some(c=>c.failures.length)||receipt.projectCases.some(c=>!c.pass)?'failed':'passed';
  console.log(JSON.stringify({phase:receipt.phase,cases:receipt.cases.map(c=>({theme:c.theme,width:c.viewport.width,ground:c.rest.ground,failures:c.failures}))}));
  return receipt;
}catch(error){
  receipt.status='failed';receipt.error={name:error.name,message:error.message};throw error;
}finally{await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));}
}
try {
  receipt.head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const historical=await readHistoricalBaseline();receipt.historicalBaseline=historical.identity;
  receipt.originalCss={};
  for(const [file,pin] of Object.entries(cssSources)){
    const asset=path.join(root,'experience/reviews/january-recipient-2026-09-05/floor-theme-e2e4a0c8',pin.asset);
    const content=(await fs.readFile(asset,'utf8')).replace(/\r\n/g,'\n');
    assert.equal(hash(content),pin.sha256LF,'Original Floor CSS SHA-256 mismatch');
    assert.equal(pin.sha256LF,historical.old.sourceInputs[file],'Original CSS must match the retained Windows receipt');
    originalCss[file]=content;receipt.originalCss[file]={asset,sha256LF:pin.sha256LF,ref:baselineRef};
  }
  browser=await chromium.launch({headless:true});
  receipt.environment={platform:process.platform,node:process.version,chromium:browser.version(),sameBrowserForBothPasses:true};
  const beforePath=baseline?out:path.join(out,'comparison-before');
  const before=await captureCssPass(true,beforePath,receipt.head);
  if(baseline){Object.assign(receipt,before);receipt.acceptance=false;}
  else {
    // A fresh comparison render is separate from the immutable failed Windows
    // receipt. Both CSS versions use this browser, fixture, fonts and globals.
    receipt.comparisonBefore={receipt:path.join(beforePath,'receipt.json'),status:before.status,acceptance:false,cssBaselineRef:before.cssBaselineRef};
    Object.assign(receipt,await captureCssPass(false,out,receipt.head));
    assert.deepEqual(receipt.fonts,before.fonts,'Both CSS passes must use identical fonts');
    assert.deepEqual(receipt.styleDependencies,before.styleDependencies,'Both CSS passes must use identical style dependencies');
    assert.equal(receipt.appCssSha256,before.appCssSha256,'Both CSS passes must use identical global CSS');
    assert.deepEqual(Object.keys(receipt.sourceInputs).sort(),Object.keys(before.sourceInputs).sort(),'Both CSS passes must use identical component inputs');
    for(const [file,sha] of Object.entries(before.sourceInputs))if(!Object.hasOwn(cssSources,file))assert.equal(receipt.sourceInputs[file],sha,`Both CSS passes must use identical ${file}`);
    assert.deepEqual(receipt.cases.map(c=>[c.theme,c.viewport]),before.cases.map(c=>[c.theme,c.viewport]),'Both CSS passes must use identical viewports and themes');
    for(const c of receipt.cases)assert.deepEqual(c.rest.layout,before.cases.find(b=>b.theme===c.theme&&b.viewport.width===c.viewport.width).rest.layout,'The Floor layout must remain unchanged');
    receipt.geometryBaseline={kind:'same-browser-original-css',receipt:path.join(beforePath,'receipt.json'),historicalRef:baselineRef};
    receipt.layoutIdentity=true;
    assert.equal(receipt.status,'passed','Theme contrast/behavior checks failed; see receipt');
  }
}catch(error){
  gateError=error;receipt.status='failed';receipt.error={name:error.name,message:error.message};throw error;
}finally{
  let cleanupError;
  for(const close of [()=>browser?.close(),...servers.map(server=>()=>server.listening?new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())):undefined)]){
    try{await close();}catch(error){cleanupError??=error;receipt.status='failed';receipt.cleanupError={name:error.name,message:error.message};}
  }
  await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));
  if(cleanupError&&!gateError)throw cleanupError;
}
