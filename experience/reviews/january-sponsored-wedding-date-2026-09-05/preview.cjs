const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
throw Error('Historical failed development attempt. Do not run: it activated Clerk keyless mode. Use the separate component-fixture.cjs proof with deny-external.cjs. This does not close Next/Clerk validation.');
const app=process.cwd(),scratch=path.resolve(process.argv[2]),fonts=path.resolve(process.argv[3]);
if(!scratch.includes('sponsored-wedding-date-2026-09-05'))throw Error('Expected owned scratch');
const fixture=JSON.parse(fs.readFileSync(path.join(scratch,'fixture.json'),'utf8'));
for(const url of [fixture.tasksUrl,fixture.sharedUrl])if(!url.startsWith('file:'))throw Error('Local fixtures only');
const server=http.createServer((req,res)=>{const name=req.url?.slice(1);if(!['Geist-Variable.woff2','GeistMono-Variable.woff2'].includes(name)){res.writeHead(404);return res.end();}res.setHeader('Content-Type','font/woff2');fs.createReadStream(path.join(fonts,name)).pipe(res);});
server.listen(4488,'127.0.0.1',()=>{
 const mock={};for(const [family,file]of [['Geist','Geist-Variable.woff2'],['Geist Mono','GeistMono-Variable.woff2']])mock[`https://fonts.googleapis.com/css2?family=${family.replace(' ','+')}:wght@100..900&display=swap`]=`@font-face { font-family: '${family}'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(http://127.0.0.1:4488/${file}) format('woff2'); }`;
 const mockFile=path.join(scratch,'fonts-http.cjs');fs.writeFileSync(mockFile,'module.exports = '+JSON.stringify(mock)+';');
 const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATH','PATHEXT','USERPROFILE','LOCALAPPDATA','APPDATA'])if(process.env[key])env[key]=process.env[key];
 Object.assign(env,{TEMP:path.join(scratch,'fixtures'),TMP:path.join(scratch,'fixtures'),NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',SIGNAL_ACCESS_MODE:'development',NEXT_PUBLIC_SIGNAL_ACCESS_MODE:'development',NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV:'preview',SIGNAL_ACTIVE_PROJECT_V3_ENABLED:'true',TASKS_DATABASE_URL:fixture.tasksUrl,ENTITLEMENTS_DATABASE_URL:fixture.sharedUrl,NOTES_DATABASE_URL:pathToFileURL(path.join(scratch,'notes-fixture.db')).href,TIMELINE_DATABASE_URL:pathToFileURL(path.join(scratch,'timeline-fixture.db')).href,NEXT_FONT_GOOGLE_MOCKED_RESPONSES:mockFile});
 const args=['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','4489'];
 const log=fs.openSync(path.join(scratch,'next-dev.log'),'a');
 const child=spawn(process.execPath,args,{cwd:app,env,stdio:['ignore',log,log],windowsHide:true});
 fs.writeFileSync(path.join(scratch,'preview.receipt.json'),JSON.stringify({source:app,exe:process.execPath,args,pid:child.pid,fontServerPid:process.pid,url:'http://127.0.0.1:4489',fontOrigin:'http://127.0.0.1:4488',mechanism:'declared Next dev with cached local Geist font CSS; no normal Google font network validation',environment:env},null,2));
 console.log('Owning Next dev PID '+child.pid+'; fonts PID '+process.pid+'; local ports 4489/4488');
 child.on('exit',code=>{console.log('Next exit '+code);server.close();process.exitCode=code??0});
});
