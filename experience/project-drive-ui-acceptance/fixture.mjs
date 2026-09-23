import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const [root, scratch, label, portText] = process.argv.slice(2);
if (!root || !scratch.includes('drive-ui-acceptance-2026-09-05') || !/^[a-z0-9-]+$/.test(label)) throw Error('Explicit isolated paths required');
const principal = 'C:/Users/ethan/signal-studio-workspace/worktrees/app/feat-january-final-journeys';
const esbuild = createRequire(fs.realpathSync(path.join(principal, 'node_modules/tsx/package.json')))('esbuild');
const port = Number(portText), staticRoot = path.join(scratch, 'assets');
const sources = {
  '@/lib/access-mode': 'export function isDemoMode(){return false}',
  '@/server/actions/project-drive-status': 'export const getProjectDriveStatusAction=(...args)=>window.__drive.readStatus(...args)',
  '@/server/actions/project-drive-handover-ui': 'export const getProjectDriveHandoverAction=(...args)=>window.__drive.readHandover(...args);export const changeProjectDriveOwnerAction=(...args)=>window.__drive.changeOwner(...args)',
  '@/server/actions/connections': 'export async function beginGoogleDriveConnectionAction(id){window.__drive.record("connect",[id]);return {url:"/fixture-consent"}};export async function enableGoogleDriveForProjectAction(id){window.__drive.record("enable",[id]);window.__drive.status.setup="setting_up";return {status:"setting_up"}};export const disconnectGoogleDriveConnectionAction=(...args)=>window.__drive.disconnect(...args)',
  '@/server/actions/resources': 'export const listTaskResourcesAction=(...args)=>window.__drive.list(...args);export async function addLinkResourceAction(){throw Error("Outside acceptance slice")};export async function removeResourceAction(id){window.__drive.record("remove",[id]);window.__drive.rows=window.__drive.rows.filter(r=>r.id!==id)}',
  '@/server/actions/drive-resource-uploads': 'export const createDriveUploadSessionAction=(...args)=>window.__drive.create(...args);export const finalizeDriveUploadAction=(...args)=>window.__drive.finalize(...args)',
  '@/lib/drive-resumable-upload': 'export const uploadToGoogleDriveResumableSession=(...args)=>window.__drive.upload(...args)',
  '@/server/actions/drive-upload-recovery': 'export const recoverDriveUploadAction=(...args)=>window.__drive.recover(...args)',
  '@/server/actions/attachments': 'export const uploadAttachmentAction=(...args)=>window.__drive.native(...args)',
  '@/server/actions/attachment-uploads': 'export async function abandonStaleUploads(id){window.__drive.record("native-abandon",[id])};export async function finalizeUpload(){throw Error("Outside fixture native path")}',
};
const headerSource = fs.readFileSync(path.join(root, 'src/components/app/settings/settings-app.tsx'), 'utf8');
const header = headerSource.slice(headerSource.indexOf('export function SectionHeader('));
if (!header.startsWith('export function SectionHeader(')) throw Error('Actual SectionHeader unavailable');
const boundaryPlugin = { name: 'explicit-drive-fixture-boundaries', setup(build) {
  build.onResolve({ filter: /^@\// }, args => Object.hasOwn(sources, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
  build.onResolve({ filter: /^\.\.\/settings-app$/ }, () => ({ path: 'actual-section-header', namespace: 'fixture' }));
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'actual-section-header' ? header : sources[args.path], loader: 'tsx', resolveDir: root }));
  build.onLoad({ filter: /[\\/]project-drive-ui\.ts$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8').replace('process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI', 'window.__driveFlag'), loader: 'ts' }));
  build.onResolve({ filter: /^@\/server\// }, args => { if (!Object.hasOwn(sources,args.path)) throw Error('Unexpected server import '+args.path); });
} };
const client = path.join(path.dirname(fileURLToPath(import.meta.url)), 'client.jsx');
const result = await esbuild.build({ entryPoints: [client], absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root,'src') }, nodePaths: [path.join(principal,'node_modules')], define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, plugins: [boundaryPlugin] });
fs.writeFileSync(path.join(scratch,label+'.bundle.js'),result.outputFiles[0].contents);
fs.writeFileSync(path.join(scratch,label+'.adapters.json'),JSON.stringify({root,source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),port,sources,other:['Actual SectionHeader extracted verbatim to avoid importing unrelated Settings tree.','Actual flag function uses window fixture value in place of build environment.','Actual CurrentUserProvider with synthetic david; actual ToastRoot and upload controller/hooks.','Byte transfer and all action results are local injected ports; no provider/service/DB lifecycle claimed.','Normal frozen CSS/fonts copied from completed principal build.']},null,2));
const css=fs.readdirSync(path.join(staticRoot,'chunks')).filter(file=>file.endsWith('.css'));
const fontClasses=css.flatMap(file=>[...fs.readFileSync(path.join(staticRoot,'chunks',file),'utf8').matchAll(/\.([a-zA-Z0-9_-]+)\s*\{\s*--font-geist-(?:sans|mono):[^}]+}/g)].map(m=>m[1]));
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+port);
 if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return res.end(result.outputFiles[0].contents)}
 if(url.pathname.startsWith('/_next/static/')){const file=path.resolve(staticRoot,url.pathname.slice(14));const rel=path.relative(staticRoot,file);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'font/woff2');return fs.createReadStream(file).pipe(res)}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en" data-theme="'+(url.searchParams.get('theme')==='dark'?'dark':'light')+'"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+css.map(file=>'<link rel="stylesheet" href="/_next/static/chunks/'+file+'">').join('')+'</head><body class="'+fontClasses.join(' ')+'" style="margin:0;background:var(--bg);color:var(--ink)"><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(JSON.stringify({ready:true,port,pid:process.pid,sourceRoot:root})+'\n'));
