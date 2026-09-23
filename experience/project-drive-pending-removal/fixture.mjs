import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
const [mode,root,scratch,label,portText]=process.argv.slice(2);
if(!['data','serve'].includes(mode)||!scratch.includes('drive-permission-removal-2026-09-05')||!/^[a-z0-9-]+$/.test(label))throw Error('Explicit owning paths required');
const principal='C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-final-journeys';
const esbuild=createRequire(fs.realpathSync(path.join(principal,'node_modules/tsx/package.json')))('esbuild');
const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const receipt={source,root,mode,adapters:{},startedAt:new Date().toISOString()};
if(fs.existsSync(path.join(scratch,label+'.receipt.json')))throw Error('Do not overwrite receipt');
const sources=mode==='data'?{
 'server-only':'export {};',
 '@/server/db':'export const db=new Proxy({}, {get(){throw Error("Default DB forbidden")}});',
 '@/server/auth':'export async function getCurrentUser(){throw Error("Clerk forbidden")}',
 '@/server/actions/project-authz':'export async function authorizeStoredProject(){throw Error("Core fixture authorization only")}',
 '@/lib/access-mode':'export function isDemoMode(){return false}',
}:{
 '@/lib/access-mode':'export function isDemoMode(){return false}',
 '@/server/actions/project-drive-status':'export async function getProjectDriveStatusAction(id){window.__removal.reads.push(id);return {kind:"ready",status:window.__removal.states[window.__removal.state]}}',
 '@/server/actions/project-drive-handover-ui':'export async function getProjectDriveHandoverAction(){return {kind:"unavailable"}};export async function changeProjectDriveOwnerAction(){throw Error("Outside fixture scope")}',
 '@/server/actions/connections':'export async function beginGoogleDriveConnectionAction(){throw Error("Provider action forbidden")};export async function enableGoogleDriveForProjectAction(){throw Error("Outside fixture scope")};export async function disconnectGoogleDriveConnectionAction(){throw Error("Token disconnect out of scope")}',
};
receipt.adapters=sources;
const plugin={name:'explicit-removal-ports',setup(b){
 b.onResolve({filter:/.*/},args=>Object.hasOwn(sources,args.path)?{path:args.path,namespace:'ports'}:undefined);
 b.onLoad({filter:/.*/,namespace:'ports'},args=>({contents:sources[args.path],loader:'js'}));
 if(mode==='serve'){
  b.onLoad({filter:/[\\/]project-drive-ui\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI','window.__driveFlag'),loader:'ts'}));
  b.onResolve({filter:/^@\/server\//},args=>{if(!Object.hasOwn(sources,args.path))throw Error('Unexpected browser server import '+args.path)});
 }
}};
let entry=path.join(path.dirname(fileURLToPath(import.meta.url)),'client.jsx');
if(mode==='data'){
 entry=path.join(scratch,label+'.entry.ts');
 fs.writeFileSync(entry,'import fs from "node:fs";import {removalCases,removalScenario} from '+JSON.stringify(path.join(root,'experience/project-drive-pending-removal/scenarios').replaceAll('\\','/'))+';async function run(){const states={};for(const c of removalCases){const f=await removalScenario(c.name);try{states[c.name]=await f.read()}finally{f.cleanup()}}fs.writeFileSync('+JSON.stringify(path.join(scratch,'states.json'))+',JSON.stringify({source:'+JSON.stringify(source)+',cases:removalCases,states},null,2));}run().catch(e=>{console.error(e);process.exitCode=1});');
}
const built=await esbuild.build({entryPoints:[entry],absWorkingDir:root,bundle:true,write:false,platform:mode==='data'?'node':'browser',format:mode==='data'?'cjs':'iife',packages:mode==='data'?'external':undefined,jsx:'automatic',alias:{'@':path.join(root,'src')},nodePaths:[path.join(principal,'node_modules')],metafile:true,plugins:[plugin],define:mode==='serve'?{'process.env.NODE_ENV':'"production"','process.env':'{}'}:undefined});
const bundle=path.join(scratch,label+(mode==='data'?'.cjs':'.js'));fs.writeFileSync(bundle,built.outputFiles[0].contents);
receipt.inputs=Object.keys(built.metafile.inputs).filter(f=>!f.startsWith('ports:')&&!f.startsWith('<')).map(f=>{const p=path.resolve(root,f);return {path:p,sha256:hash(fs.readFileSync(p))}});
receipt.bundleSha256=hash(built.outputFiles[0].contents);
if(mode==='data'){
 const env={};for(const[k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|APPDATA|LOCALAPPDATA|USERPROFILE)$/i.test(k))env[k]=v;
 Object.assign(env,{NODE_PATH:path.join(principal,'node_modules'),NODE_ENV:'test',TEMP:path.join(scratch,'data-db'),TMP:path.join(scratch,'data-db')});fs.mkdirSync(env.TEMP,{recursive:true});
 const result=spawnSync(process.execPath,[bundle],{cwd:root,env,encoding:'utf8'});fs.writeFileSync(path.join(scratch,label+'.log'),(result.stdout||'')+(result.stderr||''));receipt.command=[process.execPath,bundle];receipt.exitCode=result.status;receipt.signal=result.signal;receipt.completedAt=new Date().toISOString();if(result.status===0)receipt.dataSha256=hash(fs.readFileSync(path.join(scratch,'states.json')));fs.writeFileSync(path.join(scratch,label+'.receipt.json'),JSON.stringify(receipt,null,2));process.exitCode=result.status===0?0:1;
}else{
 const port=Number(portText),staticRoot=path.join(scratch,'assets'),data=fs.readFileSync(path.join(scratch,'states.json'));if(JSON.parse(data).source!==source)throw Error('DTO source mismatch');
 const css=fs.readdirSync(path.join(staticRoot,'chunks')).filter(f=>f.endsWith('.css'));
 const fontClasses=css.flatMap(f=>[...fs.readFileSync(path.join(staticRoot,'chunks',f),'utf8').matchAll(/\.([a-zA-Z0-9_-]+)\s*\{\s*--font-geist-(?:sans|mono):[^}]+}/g)].map(m=>m[1]));
 receipt.port=port;receipt.pid=process.pid;receipt.dataSha256=hash(data);receipt.status='Only local fixture server; explicit stop receipt required';fs.writeFileSync(path.join(scratch,label+'.receipt.json'),JSON.stringify(receipt,null,2));
 http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return res.end(built.outputFiles[0].contents)}
  if(url.pathname==='/states.json'){res.setHeader('Content-Type','application/json');return res.end(data)}
  if(url.pathname.startsWith('/_next/static/')){const file=path.resolve(staticRoot,url.pathname.slice(14)),rel=path.relative(staticRoot,file);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'font/woff2');return fs.createReadStream(file).pipe(res)}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en" data-theme="'+(url.searchParams.get('theme')==='dark'?'dark':'light')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+css.map(f=>'<link rel="stylesheet" href="/_next/static/chunks/'+f+'">').join('')+'</head><body class="'+fontClasses.join(' ')+'" style="margin:0;background:var(--bg);color:var(--ink)"><div id="root"></div><script src="/fixture.js"></script></body></html>');
 }).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({ready:true,pid:process.pid,port,source})));
}
