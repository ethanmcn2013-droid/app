import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:true});
const results=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function child(args){const p=spawn(process.execPath,args,{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],windowsHide:true});let stdout='',stderr='';p.stdout.on('data',b=>stdout=(stdout+b).slice(-65536));p.stderr.on('data',b=>stderr=(stderr+b).slice(-65536));const done=new Promise(resolve=>p.on('exit',(code,signal)=>resolve({code,signal,stdout,stderr})));return {p,done};}
for(const viewport of ['390x844','768x1024','1280x900','1440x960']){
 const directory=path.join(output,viewport),host=child(['--import','tsx','--import','./src/test/register-server-only.mjs','experience/ping-assistant/serve.ts',directory]);
 let receiving;
 try{
  let ready=false;for(let attempt=0;attempt<1200;attempt++){try{await fs.access(path.join(directory,'ready.json'));ready=true;break;}catch{}if(host.p.exitCode!==null)break;await wait(100);}
  if(!ready)throw Error(`Server did not become ready: ${viewport}`);
  const browser=child(['experience/ping-assistant/receive.mjs',directory,viewport]);receiving=await browser.done;
  await fs.writeFile(path.join(directory,'browser-process.json'),JSON.stringify(receiving,null,2));
  if(receiving.code!==0)throw Error(`Receiving failed: ${viewport}`);
 }finally{
  await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'STOP'),'Owned matrix viewport complete');
  let closed=await Promise.race([host.done,wait(15000).then(()=>null)]);
  if(!closed){host.p.kill();closed=await host.done;}
  await fs.writeFile(path.join(directory,'host-process.json'),JSON.stringify(closed,null,2));
 }
 const receipt=JSON.parse(await fs.readFile(path.join(directory,'receiving.json'),'utf8'));
 results.push({viewport,receipt:path.join(directory,'receiving.json'),screenshots:receipt.screenshots.length,status:'passed'});
 await fs.writeFile(path.join(output,'matrix.json'),JSON.stringify({scope:'Independent synthetic server process and SQLite per viewport',results},null,2));
 console.log(JSON.stringify(results.at(-1)));
}
