const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const app=process.cwd(),scratch=path.resolve(process.argv[2]),config=JSON.parse(fs.readFileSync(path.join(scratch,'fixture.json'),'utf8'));
if(!scratch.includes('sponsored-wedding-date-2026-09-05')||!config.tasksUrl.startsWith('file:'))throw Error('Local task fixtures only');
process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE='review';process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV='preview';
const esbuild=createRequire(fs.realpathSync(path.join(app,'node_modules/tsx/package.json')))('esbuild');
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{AppRouterContext}from'next/dist/shared/lib/app-router-context.shared-runtime';import{ProjectOverview}from'@/components/app/project/project-overview';import TasksPage from'@/app/app/tasks/page';
const query=new URLSearchParams(location.search),projectId=query.get('workspaceId')||'wedding-date-missing';
const router={back(){},forward(){},push(url){location.href=url},replace(url){location.replace(url)},refresh(){window.__refreshes=(window.__refreshes||0)+1},hmrRefresh(){},async prefetch(){}};
(async()=>{const data=await(await fetch('/fixture/state?projectId='+encodeURIComponent(projectId))).json();
const tree=location.pathname==='/app/tasks'?await TasksPage({searchParams:Promise.resolve({workspaceId:projectId,welcome:query.get('welcome')||undefined})}):<ProjectOverview data={data}/>;
createRoot(document.getElementById('root')).render(<AppRouterContext.Provider value={router}><div style={{fontSize:12,padding:12}}>Synthetic local fixture. Actual date, overview, arrival and welcome components; board body and identity are fixtures.</div><div style={{height:'calc(100vh - 52px)'}}>{tree}</div></AppRouterContext.Provider>);})();`;
const fixtures={
 '@/server/actions/sponsored-wedding-date':`export async function saveSponsoredWeddingDate(input){return(await fetch('/fixture/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json()}`,
 '@/server/actions/project-overview':`export async function setProjectStatusAction(){throw Error('Outside fixture slice')}export async function setProjectTargetDateAction(){throw Error('Outside fixture slice')}`,
 '@/server/db/sponsored-wedding-date':`export async function readSponsoredWeddingDate(db,input){return(await(await fetch('/fixture/state?projectId='+encodeURIComponent(input.projectId))).json()).sponsoredWeddingDate}`,
 '@/server/db':`export const db={}`,
 '@/server/auth':`export async function getCurrentUser(){return 'david'}`,
 '@/server/db/venue-welcome':`export async function detectVenueWelcome(){return{sponsorName:'Synthetic venue',sponsorSlug:'synthetic-venue',code:'SYNTHETIC'}}export async function markVenueEntitlementReached(){}`,
 '@/lib/access-mode':`export function isDemoMode(){return false}`,
 '@/components/app/tasks-project-arrival':`export async function resolveTasksArrival(id){return{kind:'ready',project:{kind:'ready',workspaceId:id}}}export function TasksArrivalRefusal(){return null}`,
 '@/components/hybrid/hybrid-workspace':`export function HybridWorkspace(){return <div style={{padding:24}}>Synthetic board body fixture</div>}`,
 '@/components/app/tasks-runtime-mount':`export function TasksRuntimePageMount({children}){return <>{children}</>}`,
 '@/components/app/templated-toast':`export function TemplatedToast(){return null}`,
 '@/server/demo/tasks-demo':`export const DEMO_SPONSOR_NAME='Synthetic venue';export const DEMO_WORKSPACE_SLUG='synthetic-venue'`,
};
async function main(){
 const {createClient}=require('@libsql/client'),{drizzle}=require('drizzle-orm/libsql'),ts=require('typescript');
 const schema=await import(pathToFileURL(path.join(app,'src/server/db/schema.ts')).href);
 const database=drizzle(createClient({url:config.tasksUrl}),{schema});
 const runtime=await import(pathToFileURL(path.join(app,'src/server/db/sponsored-wedding-date.ts')).href);
 const actionSource=fs.readFileSync(path.join(app,'src/server/actions/sponsored-wedding-date.ts'),'utf8');
 const exports={};const boundaries={'next/cache':{revalidatePath(){}},'@/lib/access-mode':{isDemoMode:()=>false},'@/server/auth':{getCurrentUser:async()=> 'david'},'@/server/db':{db:database},'@/server/db/sponsored-wedding-date':runtime};
 vm.runInNewContext(ts.transpileModule(actionSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{if(!Object.hasOwn(boundaries,id))throw Error('Unexpected action import '+id);return boundaries[id]}});
 const {eq,sql}=require('drizzle-orm');
 const bundle=await esbuild.build({stdin:{contents:entry,resolveDir:app,loader:'tsx',sourcefile:'wedding-date-fixture.tsx'},absWorkingDir:app,bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},alias:{'@':path.join(app,'src')},plugins:[{name:'explicit-fixture-boundaries',setup(b){b.onResolve({filter:/^@\//},args=>Object.hasOwn(fixtures,args.path)?{path:args.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'tsx',resolveDir:app,contents:fixtures[args.path]}));}}]});
 fs.writeFileSync(path.join(scratch,'component-bundle.js'),bundle.outputFiles[0].contents);
 const staticRoot=fs.existsSync(path.join(__dirname,'assets'))?path.join(__dirname,'assets'):path.resolve(app,'.next/dev/static');const cssFiles=fs.readdirSync(path.join(staticRoot,'chunks')).filter(f=>f.endsWith('.css'));
 const fontClasses=cssFiles.flatMap(file=>[...fs.readFileSync(path.join(staticRoot,'chunks',file),'utf8').matchAll(/\.([a-zA-Z0-9_-]+)\s*\{\s*--font-geist-(?:sans|mono):[^}]+}/g)].map(match=>match[1]));
 fs.writeFileSync(path.join(scratch,'component-fixture-boundaries.json'),JSON.stringify({sourceHead:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),client:fixtures,server:['identity fixed david','database injected isolated file','revalidatePath no-op','isDemoMode false in actual action only'],actual:['ProjectOverview','WeddingDateForm','TasksPage','VenueWelcomeCard','saveSponsoredWeddingDate action body','updateSponsoredWeddingDate','readSponsoredWeddingDate','authorizeStoredProject with actual fixture membership','venue term arithmetic'],cssFiles},null,2));
 const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1:4490');
  if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return res.end(bundle.outputFiles[0].contents)}
  if(url.pathname==='/fixture/fault'&&req.method==='POST'){await database.run(sql.raw(url.searchParams.get('mode')==='block'?"CREATE TRIGGER fixture_date_failure BEFORE UPDATE ON entitlements BEGIN SELECT RAISE(ABORT,'synthetic fixture date failure'); END":"DROP TRIGGER IF EXISTS fixture_date_failure"));return res.end('fixture fault updated')}
  if(url.pathname.startsWith('/_next/static/')){const file=path.resolve(staticRoot,decodeURIComponent(url.pathname.slice('/_next/static/'.length)));const relative=path.relative(staticRoot,file);if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.woff2')?'font/woff2':'application/octet-stream');return fs.createReadStream(file).pipe(res)}
  if(url.pathname==='/fixture/state'){
   const projectId=url.searchParams.get('projectId');const [project]=await database.select().from(schema.workspaces).where(eq(schema.workspaces.id,projectId));if(!project){res.writeHead(404);return res.end()}
   const date=await runtime.readSponsoredWeddingDate(database,{projectId,actorUserId:'david'});const [target]=await database.select().from(schema.meta).where(eq(schema.meta.key,'project-target-date:'+projectId));
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({workspaceId:projectId,slug:project.slug,displayName:project.name,purpose:null,createdAt:null,ownerUserId:project.ownerUserId,isOwner:project.ownerUserId==='david',members:[],taskStats:{total:18,complete:0,overdue:0,undated:18,progressPct:0},milestones:[],recentEvents:[],declaredStatus:null,targetDate:target?.value??null,program:null,sponsoredWeddingDate:date}));
  }
  if(url.pathname==='/fixture/save'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Fixture request too large')}const result=await exports.saveSponsoredWeddingDate(JSON.parse(body));res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result))}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+cssFiles.map(file=>'<link rel="stylesheet" href="/_next/static/chunks/'+file+'">').join('')+'</head><body class="'+fontClasses.join(' ')+'" style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>');
 }catch(error){console.error(error);res.writeHead(500);res.end('Fixture failure')}});
 server.listen(4490,'127.0.0.1',()=>console.log('Actual components + actual action/helper; isolated fixture on http://127.0.0.1:4490 PID '+process.pid));
}
main().catch(error=>{console.error(error);process.exitCode=1});
