import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'../../..');
const require=createRequire(import.meta.url);
const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
const {chromium}=require('@playwright/test');
const out=path.join(root,'experience/output/ping-voice',new Date().toISOString().replaceAll(/[:.]/g,'-'));
await fs.mkdir(out,{recursive:true});
const receipt={status:'running',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceNormalization:'LF',sourceInputs:{},cases:[],limits:[
  'Actual native Chromium fake-device microphone, AudioContext, worklet, PCM encoder and input runner.',
  'Explicit synthetic application capture and scripted provider events/interpretation; no ASR recognition, real user device, authentication, model request or task dispatch.'
]};
let browser,server;
const errors=[];
try {
  const bundle=await esbuild.build({absWorkingDir:root,entryPoints:['scripts/ping/voice/fixture.tsx'],bundle:true,write:false,metafile:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},outdir:path.join(out,'bundle')});
  const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents;
  const worklet=await fs.readFile(path.join(root,'public/ping/pcm-worklet.js'));
  for(const file of new Set([...Object.keys(bundle.metafile.inputs).filter(file=>file.startsWith('src/')),'scripts/ping/voice/fixture.tsx','scripts/ping/voice/browser.mjs','public/ping/pcm-worklet.js'])) receipt.sourceInputs[file]=createHash('sha256').update((await fs.readFile(path.join(root,file),'utf8')).replaceAll('\r\n','\n')).digest('hex');
  server=createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    if(pathname==='/app.js'){response.setHeader('Content-Type','text/javascript');response.end(js);}
    else if(pathname==='/ping/pcm-worklet.js'){response.setHeader('Content-Type','text/javascript');response.end(worklet);}
    else if(pathname==='/'){response.setHeader('Content-Type','text/html');response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;margin:32px;max-width:700px}button{padding:12px;margin:8px}output{display:block;margin:16px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');}
    else{response.writeHead(pathname==='/favicon.ico'?204:404);response.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  // A labelled synthetic tone supplies reproducible nonzero device samples;
  // no fixture callback fabricates a worklet frame or PCM transport message.
  const sampleCount=24000*5,wav=Buffer.alloc(44+sampleCount*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
  wav.write('data',36);wav.writeUInt32LE(sampleCount*2,40);
  for(let sample=0;sample<sampleCount;sample++)wav.writeInt16LE(Math.round(8192*Math.sin(2*Math.PI*440*sample/24000)),44+sample*2);
  const syntheticAudio=path.join(out,'synthetic-440Hz-mono-24000.wav');await fs.writeFile(syntheticAudio,wav);
  receipt.syntheticAudio={format:'PCM signed16LE mono24000',frequencyHz:440,sha256:createHash('sha256').update(wav).digest('hex')};
  browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+syntheticAudio]});
  const context=await browser.newContext({viewport:{width:1000,height:760},permissions:['microphone']});
  const newPage=async()=>{const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);await page.waitForFunction(()=>Boolean(window.voiceFixture));return page;};
  const report=page=>page.evaluate(()=>window.voiceFixture.report());
  const emit=(page,event)=>page.evaluate(value=>window.voiceFixture.emit(value),event);
  const final=(text='Assign me',item='synthetic-item')=>({type:'conversation.item.input_audio_transcription.completed',item_id:item,content_index:0,transcript:text});
  const ack={type:'input_audio_buffer.committed',item_id:'synthetic-item',previous_item_id:null};
  const start=async page=>{await page.getByTestId('start').click();await page.waitForFunction(()=>window.voiceFixture.report().messages.some(message=>message.type==='input_audio_buffer.append'));};
  const finish=async page=>{
    await page.waitForTimeout(73); // Real worklet continues collecting a labelled partial tail.
    await page.getByTestId('finish').evaluate(button=>{button.click();button.click();});
    await page.waitForFunction(()=>window.voiceFixture.report().snapshot?.phase==='awaiting_finals');
    const observed=await report(page),append=observed.messages.filter(message=>message.type==='input_audio_buffer.append');
    assert.equal(observed.messages.filter(message=>message.type==='input_audio_buffer.commit').length,1);
    assert.equal(observed.messages.at(-1).type,'input_audio_buffer.commit');
    assert.equal(observed.modelCalls.length,0);
    assert.ok(append.length>0);assert.ok(append.some(message=>message.nonzero),'Native fake device must supply real nonzero PCM');
    assert.ok(append.at(-1).byteLength>0&&append.at(-1).byteLength<9600,'A nonempty partial tail must precede commit');
    assert.equal(append.reduce((sum,message)=>sum+message.byteLength,0),observed.snapshot.totalSamples*2);
    assert.equal(observed.snapshot.encodedBytes,observed.snapshot.totalSamples*2);
    assert.equal(observed.snapshot.counters.appendedBytes,observed.snapshot.encodedBytes);
    assert.ok(observed.contexts.every(audio=>audio.rate===24000));
    return observed;
  };
  const ended=async page=>{await page.waitForFunction(()=>{const observed=window.voiceFixture.report();return observed.tracks.every(state=>state==='ended')&&observed.contexts.every(audio=>audio.state==='closed');});};
  const checked=async(name,run)=>{const page=await newPage();try{const detail=await run(page);receipt.cases.push({name,passed:true,...detail});}catch(error){receipt.cases.push({name,passed:false,observation:await report(page),pageErrors:[...errors]});throw error;}finally{await page.close();}};

  await checked('actual PCM and partial tail precede sole commit; double Finish and final-before-ACK interpret once',async page=>{
    assert.equal((await report(page)).gumCalls,0);await start(page);const drained=await finish(page);
    await emit(page,final());assert.equal((await report(page)).modelCalls.length,0);
    await emit(page,ack);await page.waitForFunction(()=>window.voiceFixture.report().snapshot?.phase==='ready');
    await emit(page,ack);await emit(page,final());
    const completed=await report(page);assert.equal(completed.modelCalls.length,1);assert.equal(completed.snapshot.counters.interpretationCalls,1);
    assert.deepEqual(completed.modelCalls[0].keys,['referenceInstant','selectedTaskCount','systemColumnKeys','timeZone','transcript','version']);
    assert.equal(completed.modelCalls[0].transcript,'Assign me');assert.equal(completed.proposal.outcome,'plan');
    await ended(page);await page.screenshot({path:path.join(out,'native-voice-ready.png')});
    return {samples:drained.snapshot.totalSamples,bytes:drained.snapshot.encodedBytes,appendMessages:drained.messages.length-1,partialTailBytes:drained.messages.filter(message=>message.type==='input_audio_buffer.append').at(-1).byteLength,sourceDeviceSettings:drained.trackSettings,graphContexts:drained.contexts,commitCalls:completed.snapshot.counters.commitCalls,interpretationCalls:completed.modelCalls.length};
  });
  await checked('conflicting complete items before ACK refuse without interpretation',async page=>{
    await start(page);await finish(page);await emit(page,final());await emit(page,final('Conflicting final','other-item'));
    await page.waitForFunction(()=>window.voiceFixture.report().snapshot?.phase==='closed');assert.equal((await report(page)).modelCalls.length,0);await ended(page);return {};
  });
  await checked('missing ACK after native cut reaches the bounded deadline without interpretation',async page=>{
    await start(page);await finish(page);
    await page.waitForFunction(()=>window.voiceFixture.report().snapshot?.phase==='closed',null,{timeout:6500});
    const observed=await report(page);assert.equal(observed.modelCalls.length,0);assert.equal(observed.snapshot.counters.commitCalls,1);assert.equal(observed.snapshot.reason,'ack_deadline');await ended(page);return {reason:observed.snapshot.reason};
  });
  await checked('Cancel during capture closes every acquired resource with zero commit',async page=>{
    await start(page);await page.getByTestId('cancel').click();await ended(page);const observed=await report(page);assert.equal(observed.modelCalls.length,0);assert.equal(observed.messages.filter(message=>message.type==='input_audio_buffer.commit').length,0);return {};
  });
  await checked('synthetically delayed native stream delivery after Cancel stops acquired tracks',async page=>{
    await page.evaluate(()=>window.voiceFixture.permission('delayed'));await page.getByTestId('start').click();await page.waitForFunction(()=>window.voiceFixture.report().awaitingPermission);
    await page.getByTestId('cancel').click();await page.evaluate(()=>window.voiceFixture.releasePermission());await ended(page);
    const observed=await report(page);assert.equal(observed.gumCalls,1);assert.equal(observed.modelCalls.length,0);assert.equal(observed.messages.length,0);assert.ok(observed.tracks.length>0);return {};
  });
  await checked('synthetic permission denial never commits or interprets',async page=>{
    await page.evaluate(()=>window.voiceFixture.permission('denied'));await page.getByTestId('start').click();await page.waitForFunction(()=>['closed','unavailable'].includes(document.querySelector('[data-testid=phase]').textContent));
    const observed=await report(page);assert.equal(observed.gumCalls,1);assert.equal(observed.messages.length,0);assert.equal(observed.modelCalls.length,0);return {};
  });
  await checked('context change after Finish prevents stale ACK/final from reviving capture',async page=>{
    await start(page);await finish(page);await page.evaluate(()=>window.voiceFixture.changeContext());await ended(page);await emit(page,ack);await emit(page,final());assert.equal((await report(page)).modelCalls.length,0);return {};
  });
  await checked('unmount during capture closes native stream and context',async page=>{
    await start(page);await page.evaluate(()=>window.voiceFixture.unmount());await ended(page);assert.equal((await report(page)).modelCalls.length,0);return {};
  });
  assert.deepEqual(errors,[]);receipt.status='passed';
}catch(error){receipt.status='failed';receipt.error=error.stack;throw error;}
finally{
  await fs.writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));
  await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
