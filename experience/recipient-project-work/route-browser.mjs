import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const {routeFixture}=require('./route-fixture.cjs');
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const ts=require('typescript'),{chromium}=require('@playwright/test');
const postcss=createRequire(require.resolve('@tailwindcss/postcss'))('postcss'),tailwind=require('@tailwindcss/postcss');
const out=path.resolve(process.env.RECIPIENT_ROUTE_OUTPUT ?? 'experience/output/recipient-project-work/routes');
const capture=process.argv.includes('--capture'),prepare=process.argv.includes('--prepare'),serve=process.argv.includes('--serve');
await fs.mkdir(out,{recursive:true});
const f=await routeFixture(),actionModules=new Map(),sourceInputs={};
const surfaces=[
  {id:'tasks.page.app-tasks',href:'/app/tasks?workspaceId=project-b',text:'Confirm the guest access list'},
  {id:'tasks.page.app-my-tasks',href:'/app/my-tasks?workspaceId=project-b',text:'Without a date'},
  {id:'tasks.page.app-task-by-id',href:'/app/task/archive-b',text:'Archived B arrival note'},
  {id:'tasks.page.app-archived',href:'/app/archived?workspaceId=project-b',text:'Archived B arrival note'},
];
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status:'running',mode:prepare?'prepare':capture?'capture':serve?'serve':'smoke',checks:[],sourceInputs,limits:[
  'Actual page/layout/server functions, membership/room/task queries, App shell and client components with disposable SQLite prerequisites.',
  'Explicit RSC serialization and Next navigation/headers/cache/action adapters; synthetic Clerk server identity and client account widget; no Next build/session/middleware/Flight proof.',
  'Local SQLite immediate transactions are scheduled serially; no provider or concurrency acceptance claim.',
  'Realtime endpoint is deliberately disabled (204); no cross-tab event/reconciliation claim. Other unhandled API requests fail.',
  'Final exact-source four-width capture requires --capture after principal source freeze. Smoke/prepare do not close capture or human-comprehension gates.',
]};
const hash=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
const external={
  'server-only':'export {};',
  'next/link':`import React from 'react';export default function Link({href,children,prefetch:_p,replace,scroll:_s,...props}){return <a {...props} href={typeof href==='string'?href:href.pathname} onClick={e=>{props.onClick?.(e);if(!e.defaultPrevented&&!e.metaKey&&!e.ctrlKey){e.preventDefault();window.fixtureNavigate(e.currentTarget.href,replace)}}}>{children}</a>}`,
  'next/navigation':`import {useSyncExternalStore} from 'react';function useLocation(){return useSyncExternalStore(window.fixtureSubscribe,window.fixtureLocation,window.fixtureLocation)}export const usePathname=()=>useLocation().split('?')[0];export const useSearchParams=()=>new URLSearchParams(useLocation().split('?')[1]);const router={push:href=>window.fixtureNavigate(href),replace:href=>window.fixtureNavigate(href,true),refresh:()=>window.fixtureRefresh(),back:()=>history.back(),prefetch:()=>{}};export const useRouter=()=>router;export const useParams=()=>({});export const redirect=()=>{throw Error('Client redirect outside fixture')};`,
  'next/dynamic':`import React,{lazy,Suspense} from 'react';export default function dynamic(loader,options={}){const Component=lazy(()=>loader().then(value=>({default:value.default??value})));return props=><Suspense fallback={options.loading?React.createElement(options.loading):null}><Component {...props}/></Suspense>}`,
  '@clerk/nextjs':`import React from 'react';export const ClerkProvider=({children})=>children;export const useUser=()=>({isLoaded:true,isSignedIn:true,user:{id:window.routeFixture.actor,firstName:'Fixture',fullName:'Fixture member'}});export const useClerk=()=>({signOut:()=>{throw Error('Provider action outside fixture')}});export const UserButton=({children})=><span aria-label='Synthetic account identity'>{children}</span>;UserButton.MenuItems=()=>null;UserButton.Link=()=>null;UserButton.Action=()=>null;export const SignedIn=({children})=>children;export const SignedOut=()=>null;`,
  '@sentry/nextjs':`export const captureException=()=>{};export const captureMessage=()=>{};`,
};
let server,browser;
try {
  // Discover references through real route executions, including refusal forms
  // and both mounts. The resulting tree is never replaced with a fixture shell.
  for(const v3 of [true,false])for(const surface of surfaces){f.state.v3=v3;f.cookies();await f.render(surface.href);}
  f.state.v3=true;f.cookies();
  const plugin={name:'bounded-request-adapters',setup(build){
    build.onResolve({filter:/^fixture:client-modules$/},()=>({path:'modules',namespace:'fixture-modules'}));
    build.onLoad({filter:/.*/,namespace:'fixture-modules'},()=>({contents:[...f.clientModules].map((file,i)=>`import * as m${i} from './${file}';`).join('\n')+'\nexport const modules={'+[...f.clientModules].map((file,i)=>`${JSON.stringify(file)}:m${i}`).join(',')+'};',resolveDir:root}));
    build.onResolve({filter:/.*/},args=>external[args.path]!==undefined?{path:args.path,namespace:'fixture-external'}:undefined);
    build.onLoad({filter:/.*/,namespace:'fixture-external'},args=>({contents:external[args.path],loader:'jsx',resolveDir:root}));
    build.onLoad({filter:/\.[tj]sx?$/},async args=>{
      if(!args.path.startsWith(path.join(root,'src')))return;
      const source=await fs.readFile(args.path,'utf8'),file=path.relative(root,args.path).replaceAll('\\','/');
      sourceInputs[file]=hash(source);
      if(file==='src/lib/access-mode.ts')return {contents:'export const isDemoMode=()=>false;export const isProductionMode=()=>true;export const getAccessMode=()=>"production";',loader:'js'};
      if(file==='src/lib/projects/flags.ts')return {contents:'export const isActiveProjectV3Enabled=()=>window.routeFixture.v3;',loader:'js'};
      if(!/^\s*["']use server["']/.test(source))return;
      const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),names=[];
      for(const stmt of ast.statements) {
        if(ts.isFunctionDeclaration(stmt)&&stmt.name&&stmt.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))names.push(stmt.name.text);
        if(ts.isExportDeclaration(stmt)&&stmt.exportClause&&ts.isNamedExports(stmt.exportClause))for(const el of stmt.exportClause.elements)if(!el.isTypeOnly&&!stmt.isTypeOnly)names.push(el.name.text);
      }
      actionModules.set(file,new Set(names));
      return {contents:names.map(name=>`export const ${name}=(...args)=>window.fixtureAction(${JSON.stringify(file)},${JSON.stringify(name)},args);`).join('\n'),loader:'js'};
    });
  }};
  const bundle=await esbuild.build({bundle:true,metafile:true,platform:'browser',absWorkingDir:root,alias:{'@':path.join(root,'src')},plugins:[plugin],jsx:'automatic',define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},entryPoints:['experience/recipient-project-work/route-client.jsx'],outfile:path.join(out,'bundle.js'),logLevel:'warning'});
  const css=await postcss([tailwind({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')});
  await fs.writeFile(path.join(out,'app.css'),css.css);
  for(const file of Object.keys(bundle.metafile.inputs))if(file.startsWith('src/'))sourceInputs[file]=hash(await fs.readFile(path.join(root,file),'utf8'));
  sourceInputs['src/app/globals.css']=hash(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'));
  receipt.stylesheetInputs={};
  for(const message of css.messages)if(message.type==='dependency'&&message.file){
    const filename=path.resolve(message.file);
    receipt.stylesheetInputs[path.relative(root,filename).replaceAll('\\','/')]=hash(await fs.readFile(filename,'utf8'));
  }
  const bundleCss=await fs.readFile(path.join(out,'bundle.css'),'utf8');
  // Font generation belongs to the final Next build. Use its local cached
  // @font-face declarations when available; explicitly refuse formal capture
  // without them instead of silently certifying a fallback font.
  const fontFaces=[];
  async function findFonts(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){const file=path.join(dir,entry.name);if(entry.isDirectory())await findFonts(file);else if(file.endsWith('.css')){const source=await fs.readFile(file,'utf8');for(const match of source.matchAll(/@font-face\s*\{[^}]+\}/g))if(/Geist/.test(match[0]))fontFaces.push(match[0]);}}}
  await findFonts(path.join(root,'.next/static'));
  receipt.fonts=fontFaces.length?'Local cached Next Geist assets; source font configuration hashed':'Fallback system sans; NOT visual acceptance';
  receipt.buildWarnings=bundle.warnings.map(w=>({text:w.text,file:w.location?.file,line:w.location?.line}));
  if(capture&&!fontFaces.length)throw Error('Final capture requires cached local Next font assets');
  const fontCss=[...new Set(fontFaces)].join('\n').replaceAll('../media/','/_next/static/media/');
  receipt.fontAssets={};
  for(const match of fontCss.matchAll(/\/_next\/static\/media\/([\w.-]+\.woff2)/g)){
    receipt.fontAssets[match[1]]=createHash('sha256').update(await fs.readFile(path.join(root,'.next/static/media',match[1]))).digest('hex');
  }
  sourceInputs['src/app/layout.tsx']=hash(await fs.readFile(path.join(root,'src/app/layout.tsx'),'utf8'));
  const html=`<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/bundle.css"><style>${fontCss}\n:root{--font-geist-sans:Geist,Arial,sans-serif;--font-geist-mono:'Geist Mono',monospace}body{margin:0}#root{min-height:100vh}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
  if(prepare){receipt.prepared={surfaces,widths:[390,768,1280,1440],clientModules:[...f.clientModules]};console.log('Prepared actual route trees, browser bundle and CSS. No browser capture.');}
  else {
    // Only actions exercised by this matrix: selection POST and detail reads.
    // Imported write/provider actions remain visible UI but fail if invoked.
    const allowedActions=new Set(['openTasksProjectAction','getSubtasksAction','getTaskConversationAction','listTaskResourcesAction','getPersonalityPrefs']);
    const requestErrors=[];
    const json=(res,value,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));};
    function reviveArgs(value){if(!value||typeof value!=='object')return value;if(value.$form){const form=new FormData();for(const [key,entry] of value.$form)form.append(key,entry);return form;}return Array.isArray(value)?value.map(reviveArgs):Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,reviveArgs(entry)]));}
    server=createServer(async(req,res)=>{
      try {
        const url=new URL(req.url,'http://fixture.invalid');
        if(url.pathname==='/fixture/route'){json(res,await f.render(url.searchParams.get('href')));return;}
        if(url.pathname==='/fixture/action'&&req.method==='POST'){
          let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)throw Error('Fixture body limit');}
          const {file,name,args}=JSON.parse(body);
          if(!allowedActions.has(name)||!actionModules.get(file)?.has(name))throw Error('Action outside bounded fixture: '+name);
          try {json(res,{result:await f.load(file)[name](...reviveArgs(args))});}catch(error){if(error.href)json(res,{redirect:error.href});else throw error;}
          return;
        }
        if(url.pathname==='/api/events'){res.statusCode=204;res.end();return;}
        if(url.pathname.startsWith('/api/'))throw Error('API outside bounded fixture: '+url.pathname);
        const asset={'/app.css':css.css,'/bundle.css':bundleCss,'/bundle.js':await fs.readFile(path.join(out,'bundle.js'))}[url.pathname];
        if(asset!==undefined){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(asset);return;}
        if(/^\/_next\/static\/media\/[\w.-]+\.woff2$/.test(url.pathname)){res.setHeader('Content-Type','font/woff2');res.end(await fs.readFile(path.join(root,'.next/static/media',path.basename(url.pathname))));return;}
        if(url.pathname.startsWith('/app/')){res.setHeader('Content-Type','text/html');res.end(html);return;}
        res.statusCode=404;res.end();
      }catch(error){requestErrors.push(error.message);console.error(error);json(res,{error:error.message},500);}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    if(serve){console.log('Isolated fixture '+origin+surfaces[0].href);await new Promise(resolve=>process.once('SIGINT',resolve));}
    else {
      browser=await chromium.launch({headless:true});
      // Smoke is deliberately one desktop pass. --capture is the separately
      // authorized final four-width matrix; neither proves a Next/Clerk session.
      for(const width of capture?[390,768,1280,1440]:[1280]) {
        const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
        page.on('pageerror',error=>{errors.push(error.message);console.error('BROWSER',error.message)});
        page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
        await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        async function evidence(surface,state){
          const name=`${surface}-${state}-${width}`;
          await fs.writeFile(path.join(out,name+'.html'),await page.content());
          await fs.writeFile(path.join(out,name+'.route.json'),JSON.stringify(await page.evaluate(()=>window.routeFixture),null,2));
          await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
          receipt.checks.push({surface,width,state,href:page.url().slice(origin.length),passed:true});
        }
        async function assertB(surface){
          await page.getByText(surface.text,{exact:true}).first().waitFor();
          await page.waitForFunction(()=>window.routeFixture?.version>0);
          const providers=await page.evaluate(()=>{
            const result={};function visit(value){if(!value||typeof value!=='object')return;if(value.$component&&['DomainProvider','RoomBriefProvider','TasksProvider','ProductWorkspaceShell'].includes(value.$component.name))result[value.$component.name]=value.props;for(const child of Object.values(value))visit(child);}
            visit(window.routeFixture.tree);return result;
          });
          assert.equal(providers.DomainProvider.workspaceId,'project-b');
          assert.equal(providers.RoomBriefProvider.value.purpose,'Confirm B arrivals and share the final plan.');
          assert.equal(providers.ProductWorkspaceShell.activeWorkspaceId,'project-b');
          assert.equal(providers.TasksProvider.initialTasks.length,4);
          assert.ok(providers.TasksProvider.initialTasks.every(t=>t.id.endsWith('-b')));
          assert.equal(await page.getByText('ONLY A PURPOSE',{exact:true}).count(),0);
          assert.equal(await page.getByText('ONLY A ARCHIVED TASK',{exact:true}).count(),0);
          assert.equal(await page.getByText('PRIVATE C TASK',{exact:true}).count(),0);
          if(surface.id==='tasks.page.app-tasks')await page.getByText('B arrival board',{exact:true}).first().waitFor({timeout:5000});
          else if(f.state.v3)await page.locator('[data-slot="active-project-trigger"]').filter({hasText:'Arrival project B'}).waitFor({timeout:5000});
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        }
        for(const surface of surfaces){
          f.state.v3=true;f.cookies();
          await page.goto(origin+surface.href);
          await assertB(surface);
          assert.equal(f.state.cookieWrites.length,0);
          if(surface.id==='tasks.page.app-my-tasks'){
            for(const text of ['Without a date','Later','Check the final arrival plan','Confirm the arrival time'])await page.getByText(text,{exact:true}).first().waitFor();
            assert.equal(await page.getByText('Prepare the shared checklist',{exact:true}).count(),0);
          }
          await evidence(surface.id,'stale-a');
          f.state.v3=false;f.cookies();await page.reload();
          const open=page.getByRole('button',{name:'Open Arrival project B',exact:true});await open.waitFor();
          assert.equal(f.state.cookieWrites.length,0);
          assert.equal(await page.getByText(surface.text,{exact:true}).count(),0);
          await evidence(surface.id,'selection-required');
          await open.click();await assertB(surface);
          assert.equal(f.state.cookieWrites.length,2);assert.equal(f.state.cookies.get('tasks_active_ws'),'project-b');
          await page.reload();await assertB(surface);assert.equal(f.state.cookieWrites.length,2);
          await evidence(surface.id,'selected-and-reloaded');
        }
        f.state.v3=true;f.cookies();
        // Object ownership wins a conflicting URL hint; its chrome snapshot
        // still matches that actual URL. Follow the actual archived Link, Back,
        // and direct reload without replacing the page or its shell.
        await page.goto(origin+'/app/task/archive-b?workspaceId=project-a');await assertB(surfaces[2]);
        await page.getByRole('link',{name:'Open archive',exact:true}).click();await assertB(surfaces[3]);
        assert.equal(new URL(page.url()).searchParams.get('workspaceId'),'project-b');
        await page.goBack();await assertB(surfaces[2]);await page.reload();await assertB(surfaces[2]);
        assert.equal(f.state.cookieWrites.length,0);await evidence(surfaces[2].id,'conflicting-query-back-reload');
        // Active object route executes its real redirect, then the real client
        // detail and actual action reads. No detail or successful read is seeded.
        await page.goto(origin+'/app/task/undated-b');
        await page.getByRole('textbox',{name:'Task title',exact:true}).waitFor();
        assert.equal(await page.getByRole('textbox',{name:'Task title',exact:true}).inputValue(),'Confirm the guest access list');
        assert.equal(new URL(page.url()).searchParams.get('workspaceId'),'project-b');
        await page.waitForFunction(()=>['getTaskConversationAction','getSubtasksAction','listTaskResourcesAction'].every(name=>window.routeFixture.requests.some(r=>r.name===name)));
        await evidence(surfaces[2].id,'active-object-canonical-panel');
        f.state.actor='user_creator';await page.goto(origin+surfaces[1].href);
        await page.getByRole('heading',{name:'No tasks assigned to you yet',exact:true}).waitFor();
        assert.equal(await page.getByRole('link',{name:'View project tasks'}).getAttribute('href'),'/app/tasks?workspaceId=project-b');
        await evidence(surfaces[1].id,'unassigned-personal-view');
        f.state.actor='user_recipient';f.cookies();
        await f.client.execute("DELETE FROM workspace_members WHERE workspace_id='project-b' AND user_id='user_recipient'");
        await page.goto(origin+surfaces[3].href);await page.getByRole('heading',{name:'Project unavailable',exact:true}).waitFor();
        assert.equal(await page.getByText('Archived B arrival note',{exact:true}).count(),0);
        await evidence(surfaces[3].id,'removed-membership');
        await f.client.execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('project-b','user_recipient','member')");
        await page.goto(origin+'/app/task/private-c');await page.getByText('Task not found',{exact:true}).waitFor();
        assert.equal(await page.getByText('PRIVATE C TASK',{exact:true}).count(),0);
        assert.equal(f.state.cookieWrites.length,0);await evidence(surfaces[2].id,'neutral-foreign-object');
        assert.deepEqual(errors,[]);await context.close();
      }
      assert.deepEqual(requestErrors,[]);
      console.log(`PASS ${receipt.checks.length} actual route browser checks (${receipt.mode})`);
    }
  }
  receipt.status=prepare?'prepared':serve?'served':'passed';
} catch(error) {
  receipt.status='failed';receipt.failure=error.message;throw error;
} finally {
  Object.assign(sourceInputs,f.sourceInputs);
  receipt.fixtureInputs={};
  for(const file of ['fixture.cjs','route-fixture.cjs','route-client.jsx','route-browser.mjs'])receipt.fixtureInputs[file]=hash(await fs.readFile(path.join(import.meta.dirname,file),'utf8'));
  await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));f.close();
}
