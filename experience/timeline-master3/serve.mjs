import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildUi,fixtureHtml} from './build-ui.mjs';
import {createGuestFixture} from './guest-fixture.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function startFixtureHost({source=process.cwd(),output,expectedHead}){
 if(!output||!expectedHead)throw Error('Explicit fresh output directory and source head required');
 source=path.resolve(source);output=path.resolve(output);
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();if(head!==expectedHead)throw Error('Source head differs from admission');
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'owner.json'),JSON.stringify({pid:process.pid,source,head,scope:'Synthetic component fixture, no auth/DB/provider/publication'},null,2),{flag:'wx'});
 const bytes=await fs.readFile(path.join(here,'fixtures.json')),fixtures=JSON.parse(bytes).fixtures;
 const assets=await buildUi(source,output),guest=await createGuestFixture(source,output,fixtures),journal=[];let server,closing=false,timer,expiry;
 const close=async(reason)=>{if(closing)return;closing=true;clearInterval(timer);clearTimeout(expiry);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await guest.close();await fs.writeFile(path.join(output,'closed.json'),JSON.stringify({pid:process.pid,at:new Date().toISOString(),reason,requests:journal},null,2));};
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');journal.push({at:new Date().toISOString(),path:url.pathname});if(await guest.handle(req,res,url))return;
  if(req.method!=='GET'){res.writeHead(405);res.end('Only isolated product guest API accepts POST');return;}
  if(url.pathname==='/health'){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,synthetic:true,head,followService:'actual-SQLite-product-service-with-injected-test-mail'}));return;}
  const file={'/app.js':'app.js','/app.css':'app.css','/globals.css':'globals.css'}[url.pathname];
  if(file){res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/css');res.end(await fs.readFile(path.join(output,file)));return;}
  if(url.pathname==='/Geist.woff2'){res.setHeader('content-type','font/woff2');res.end(await fs.readFile(assets.font));return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const shared=url.pathname.match(/^\/s\/([A-Za-z0-9_-]{43})$/);if(url.pathname!=='/fixture'&&!shared){res.writeHead(404);res.end('No API or product actions in this fixture');return;}
  const fixture=shared?guest.fixtureForToken(shared[1]):fixtures.find(f=>f.fixtureId===url.searchParams.get('id'));if(!fixture){res.writeHead(404);res.end('Unknown fixture');return;}
  const theme=url.searchParams.get('theme')??(shared?fixture.sourceTheme:null);if(!['light','dark'].includes(theme)){res.writeHead(400);res.end('Explicit theme required');return;}
  res.setHeader('content-type','text/html');res.setHeader('cache-control','no-store');res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'none'");res.end(fixtureHtml(guest.decorate(fixture,res,{guestOnly:!!shared}),theme,url.searchParams.get('spacing')==='1'));
 }catch{res.writeHead(500);res.end('Synthetic fixture render failed');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 guest.bindOrigin(`http://127.0.0.1:${server.address().port}`);
 const ready={pid:process.pid,url:`http://127.0.0.1:${server.address().port}`,source,head,fixtureSha256:createHash('sha256').update(bytes).digest('hex'),fixtureCount:fixtures.length,followService:'actual-SQLite-product-service-with-injected-test-mail',databasePath:guest.databasePath,output,scope:'Actual artifact/model/CSS/TimelineFollow/HTTP/guest-service/store with isolated SQLite; injected synthetic public resolver,owner auth,test-mail transport. No native Next/Clerk/real delivery/production qualification.'};
 await fs.writeFile(path.join(output,'ready.json'),JSON.stringify(ready,null,2),{flag:'wx'});
 timer=setInterval(()=>void fs.access(path.join(output,'STOP')).then(()=>close('owner-stop')).catch(()=>{}),500);expiry=setTimeout(()=>void close('eight-hour-expiry'),8*60*60*1000);expiry.unref();process.on('SIGTERM',()=>void close('sigterm'));process.on('SIGINT',()=>void close('sigint'));return {ready,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startFixtureHost({output:process.argv[2],expectedHead:process.argv[3]}).then(({ready})=>console.log(JSON.stringify(ready))).catch(error=>{console.error(error.message);process.exitCode=1;});

