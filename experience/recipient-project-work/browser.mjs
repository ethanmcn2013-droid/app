import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url), root = path.resolve(import.meta.dirname, '../..');
const { recipientFixture } = require('./fixture.cjs');
const esbuild = createRequire(require.resolve('tsx/package.json'))('esbuild');
const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium } = require('@playwright/test');
const out = path.resolve(process.env.RECIPIENT_OUTPUT ?? 'experience/output/recipient-project-work');
await fs.mkdir(out, { recursive: true });
const f = await recipientFixture();
await f.client.executeMultiple(`INSERT INTO tasks(id,workspace_id,title,lane,priority,assignees,due_at) VALUES
  ('undated','project-b','Confirm the guest access list','todo','p2','["recipient"]',NULL),
  ('later','project-b','Check the final arrival plan','todo','p2','["recipient"]',1803211200),
  ('soon','project-b','Confirm the arrival time','todo','p2','["recipient"]',1800705600),
  ('unassigned','project-b','Prepare the shared checklist','todo','p2','[]',NULL);`);
const guard = f.load('src/components/app/tasks-project-arrival');
const recovery = f.load('src/server/actions/tasks-project-arrival').openTasksProjectAction;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {MyWeekApp} from '@/components/app/my-week/my-week-app';
import {TasksArrivalRefusal} from '@/components/app/tasks-project-arrival';
window.opened=[];window.toggled=[];
window.openTask=id=>{window.opened.push(id);document.querySelector('#opened').textContent='Opened task: '+id};
window.fixtureNavigate=async href=>{history.pushState(null,'',href);await window.refresh()};
window.recover=async(_previous,form)=>{const res=await fetch('/recover',{method:'POST',body:new URLSearchParams(form)});const data=await res.json();if(data.href){await window.fixtureNavigate(data.href);return null}return data};
const root=createRoot(document.getElementById('root'));
window.refresh=async()=>{const res=await fetch('/view'+location.search),v=await res.json();
 window.view=v;window.tasks=v.tasks.map(t=>({...t,dueAt:t.dueAt?new Date(t.dueAt):undefined,updatedAt:new Date(t.updatedAt)}));
 root.render(<><header className='border-b border-line-soft px-6 py-4 text-ink'><p className='text-xs text-ink-soft'>Isolated current-source My work fixture</p><h1 className='mt-1 text-lg font-medium'>{v.arrival.kind==='ready'?v.arrival.project.name+' · My work':'Project link'}</h1><nav className='mt-2 flex gap-4 text-sm'><a href='/app/my-tasks?workspaceId=project-a' onClick={e=>{e.preventDefault();window.fixtureNavigate(e.currentTarget.href)}}>Project A</a><a href='/app/my-tasks?workspaceId=project-b' onClick={e=>{e.preventDefault();window.fixtureNavigate(e.currentTarget.href)}}>Project B</a></nav></header>
 {v.arrival.kind==='ready'?<MyWeekApp canSetUpProject={v.canSetUpProject}/>:<TasksArrivalRefusal arrival={v.arrival} requested={v.requested} surface='my-work'/>}<output id='opened' className='px-6 text-sm text-ink-soft' aria-live='polite'/></>);
};window.addEventListener('popstate',window.refresh);window.refresh();
`;
const plugin = { name: 'recipient-request-boundaries', setup(build) {
  const names = new Set(['server-only','next/link','@/lib/auth-context','@/lib/tasks/tasks-context','@/lib/tasks/use-task-panel','@/lib/domain-context','@/components/app/room/room-brief-context','@/components/app/add-task/add-task-context','@/server/actions/seed','@/server/actions/tasks-project-arrival','@/server/projects/route-authz','@/lib/projects/flags','@/components/app/active-project-route-sync']);
  build.onResolve({ filter: /.*/ }, a => {
    if (a.path === './active-project-route-sync') return { path: '@/components/app/active-project-route-sync', namespace: 'fixture' };
    return names.has(a.path) ? { path: a.path, namespace: 'fixture' } : undefined;
  });
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, a => {
    let contents = '';
    if (a.path === 'next/link') contents = `import React from 'react';export default function Link({href,children,...props}){return <a {...props} href={href} onClick={e=>{e.preventDefault();window.fixtureNavigate(href)}}>{children}</a>}`;
    else if (a.path.endsWith('/auth-context')) contents = `export const useCurrentUser=()=>window.view.actor;`;
    else if (a.path.endsWith('/tasks-context')) contents = `export const useTasksState=()=>({tasks:window.tasks});export const useTasksDispatch=()=>({toggleComplete:id=>window.toggled.push(id)});`;
    else if (a.path.endsWith('/use-task-panel')) contents = `export const useTaskPanel=()=>({taskId:null,openTask:window.openTask});`;
    else if (a.path.endsWith('/domain-context')) contents = `export const useActiveWorkspace=()=>({id:window.view.arrival.project?.workspaceId});export const usePersonalization=()=>({headline:'Your project starts here',body:'Add the first piece of work.',firstTaskExample:'Add your first task'});export const useColumnConfig=()=>null;export const useWorkspaceMembers=()=>[];`;
    else if (a.path.endsWith('/room-brief-context')) contents = `export const useCalendarFrame=()=>({nowIso:'2027-01-21T12:00:00Z',timeZone:'UTC',locale:'en-GB'});`;
    else if (a.path.endsWith('/add-task-context')) contents = `export const useAddTask=()=>({openDialog:()=>window.openTask('new')});`;
    else if (a.path.endsWith('/seed')) contents = `export const seedDomainAction=()=>{throw Error('Reset forbidden in personal view fixture')};`;
    else if (a.path.endsWith('/tasks-project-arrival')) contents = `export const openTasksProjectAction=(...args)=>window.recover(...args);`;
    else if (a.path.endsWith('/route-authz')) contents = `export const resolveProjectForRoute=()=>{throw Error('Authorization runs only on the local server')};`;
    else if (a.path.endsWith('/flags')) contents = `export const isActiveProjectV3Enabled=()=>window.view.v3;`;
    else if (a.path.endsWith('/active-project-route-sync')) contents = `export const ActiveProjectRouteSync=()=>null;`;
    return { contents, loader: 'tsx', resolveDir: root };
  });
} };
const bundle = await esbuild.build({ bundle: true, metafile: true, platform: 'browser', absWorkingDir: root, alias: { '@': path.join(root,'src') }, plugins: [plugin], jsx: 'automatic', define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' }, stdin: { contents: entry, loader: 'tsx', resolveDir: root }, outfile: path.join(out,'bundle.js'), logLevel: 'warning' });
const css = await postcss([tailwind({ base: root })]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'), { from: path.join(root,'src/app/globals.css') });
await fs.writeFile(path.join(out,'app.css'),css.css);
const js = await fs.readFile(path.join(out,'bundle.js'));
const html = `<!doctype html><html lang='en'><head><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='/app.css'><style>:root{--font-sans:Arial;--font-mono:monospace}body{font-family:Arial;margin:0}#root{min-height:100vh;display:flex;flex-direction:column}</style></head><body><div id='root'></div><script src='/bundle.js'></script></body></html>`;
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://fixture.invalid');
    if(url.pathname==='/view') {
      const requested = url.searchParams.get('workspaceId') ?? undefined;
      const arrival = await guard.resolveTasksArrival(requested);
      const tasks = arrival.kind==='ready' ? await f.reload(arrival.project.workspaceId) : [];
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({arrival,requested,tasks,actor:f.state.actor,v3:f.state.v3,canSetUpProject:arrival.kind==='ready'&&arrival.project.project.capabilities.manageProject}));return;
    }
    if(url.pathname==='/recover'&&req.method==='POST') {
      let body='';for await(const chunk of req)body+=chunk;
      const form=new FormData();for(const [key,value] of new URLSearchParams(body))form.append(key,value);
      let result;try{result=await recovery(null,form)}catch(error){if(!error.href)throw error;result={href:error.href}}
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    res.setHeader('Content-Type',url.pathname==='/bundle.js'?'text/javascript':url.pathname==='/app.css'?'text/css':'text/html');
    res.end(url.pathname==='/bundle.js'?js:url.pathname==='/app.css'?css.css:html);
  }catch(error){res.statusCode=500;res.end('Fixture failed');console.error(error)}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`, browser=await chromium.launch({headless:true});
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),checks:[],sourceInputs:{},limits:['Focused actual components/current Tailwind and tokens; fixture header and framework/context adapters, not full Next shell','Real local membership/route guard/recovery action/SQLite read; no provider identity or real network','Task detail opening recorded at context boundary; continuous mutation story is separate']};
for(const file of Object.keys(bundle.metafile.inputs))if(file.startsWith('src/'))receipt.sourceInputs[file]=createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replace(/\r\n/g,'\n')).digest('hex');
try {
  for(const width of [1440,390]) {
    f.state.v3=true;f.state.actor='recipient';f.cookies();
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}), page=await context.newPage(),errors=[];
    page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message)});
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin+'/app/my-tasks?workspaceId=project-b');
    // The row title is a real keyboard-operable button, independent of Done.
    await page.getByRole('heading',{name:'Without a date',exact:true}).waitFor();
    assert.equal(await page.getByText('Check the final arrival plan',{exact:true}).count(),1);
    assert.equal(await page.getByText('Prepare the shared checklist',{exact:true}).count(),0);
    const titleButton=page.locator('button').filter({hasText:'Confirm the guest access list'});
    await titleButton.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#opened').textContent(),'Opened task: undated');
    assert.ok((await titleButton.boundingBox()).height>=44);
    await page.screenshot({path:path.join(out,`my-work-${width}.png`),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('link',{name:'Project A',exact:true}).click();
    await page.getByRole('button',{name:/Add your first task/}).waitFor();
    await page.goBack();await page.getByRole('heading',{name:'Without a date',exact:true}).waitFor();
    await page.reload();await page.getByRole('heading',{name:'Without a date',exact:true}).waitFor();
    assert.equal(f.state.cookieWrites.length,0);
    receipt.checks.push({width,name:'authorized B stale A, keyboard row, all date states, owner empty, Back and reload',passed:true});
    f.state.v3=false;f.cookies();await page.reload();
    await page.getByRole('button',{name:'Open Project B',exact:true}).waitFor();
    await page.screenshot({path:path.join(out,`recovery-${width}.png`),fullPage:true});
    await page.getByRole('button',{name:'Open Project B',exact:true}).click();
    await page.getByRole('heading',{name:'Without a date',exact:true}).waitFor();
    assert.equal(f.state.cookieWrites.length,2);assert.equal(f.state.cookies.get('tasks_active_ws'),'project-b');
    receipt.checks.push({width,name:'flag-off explicit recovery actual POST and both cookies',passed:true});
    f.state.actor='creator';await page.reload();await page.getByRole('heading',{name:'No tasks assigned to you yet'}).waitFor();
    assert.equal(await page.getByRole('link',{name:'View project tasks'}).getAttribute('href'),'/app/tasks?workspaceId=project-b');
    await page.screenshot({path:path.join(out,`unassigned-${width}.png`),fullPage:true});
    f.state.actor='outsider';f.state.v3=true;await page.reload();await page.getByRole('heading',{name:'Project unavailable'}).waitFor();
    assert.equal(await page.getByText('Confirm the guest access list',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    receipt.checks.push({width,name:'empty personal projection exact link and account switch refusal',passed:true});
    await context.close();
  }
  console.log(`PASS ${receipt.checks.length} browser scenarios across desktop/mobile`);
} finally {
  await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));f.close();
}
