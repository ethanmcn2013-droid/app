import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

const output=path.resolve(process.argv[2]);
const ready=JSON.parse(await fs.readFile(path.join(output,'ready.json'),'utf8'));
const root=process.cwd(),browser=await chromium.launch({headless:true});
const evidence={version:'ping.release2.synthetic-avatar-light-dark.v1',startedAt:new Date().toISOString(),ready,colors:[],screenshots:[],errors:[],httpErrors:[],networkFailures:[]};
const sourceFiles=['src/components/app/messages/chat-ui.tsx','src/components/app/messages/chat-view-model.ts','src/components/app/messages/chat.module.css','src/components/app/messages/demo-messages-app.tsx','src/components/app/messages/conversation-workspace.tsx','src/components/app/presence/avatar-stack.tsx','src/components/app/presence/avatar-stack.module.css'];
try{
  evidence.sourceHashesAtCaptureStart={};
  for(const file of sourceFiles){const bytes=await fs.readFile(path.join(root,file));evidence.sourceHashesAtCaptureStart[file]=createHash('sha256').update(bytes).digest('hex');}
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>evidence.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)evidence.httpErrors.push({status:response.status(),url:response.url()});});
  page.on('requestfailed',request=>evidence.networkFailures.push({url:request.url(),method:request.method(),error:request.failure()?.errorText}));
  const params=new URLSearchParams({projectId:'synthetic-ping-project',conversationId:ready.privateConversationId,messageId:ready.privateSourceMessageId,messageSeq:'1'});
  await page.goto(`${ready.url}/app/messages?${params}`);
  await page.getByRole('textbox',{name:'Message bob'}).waitFor();
  await page.getByText('Client review is Friday.').waitFor();
  for(const theme of ['dark','light']){
    const colors=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      const findAvatars=()=>[...document.querySelectorAll('[aria-hidden="true"][data-tone]')].filter(node=>node.textContent?.trim()==='BO'&&node.getBoundingClientRect().width>0);
      let previous='',stableFrames=0,current=[];
      for(let frame=0;frame<120;frame+=1){
        await new Promise(requestAnimationFrame);
        const avatars=findAvatars();if(!avatars.length)throw new Error('The rendered Bob DM has no visible person avatars');
        current=avatars.map(avatar=>{const style=getComputedStyle(avatar),rect=avatar.getBoundingClientRect();return{foreground:style.color,background:style.backgroundColor,boxShadow:style.boxShadow,top:rect.top,left:rect.left};});
        const snapshot=JSON.stringify({theme:document.documentElement.dataset.theme,surface:getComputedStyle(document.documentElement).getPropertyValue('--v3-surface'),text:getComputedStyle(document.documentElement).getPropertyValue('--v3-text'),current});
        stableFrames=snapshot===previous?stableFrames+1:0;previous=snapshot;
        if(stableFrames>=5)break;
      }
      if(stableFrames<5)throw new Error(`Avatar colors did not settle in ${theme} mode: ${JSON.stringify(current)}`);
      const probe=document.createElement('span');probe.style.color='var(--v3-accent)';document.body.append(probe);const accent=getComputedStyle(probe).color;probe.remove();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Color conversion canvas unavailable');
      const toRgb=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3);};
      const luminance=rgb=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
      const ac=toRgb(accent),avatars=current.map(value=>{const fg=toRgb(value.foreground),bg=toRgb(value.background),contrast=(Math.max(luminance(fg),luminance(bg))+.05)/(Math.min(luminance(fg),luminance(bg))+.05);return{...value,foregroundRgb:fg,backgroundRgb:bg,contrast,accentDistance:Math.hypot(bg[0]-ac[0],bg[1]-ac[1],bg[2]-ac[2])};});
      return{theme,accent,accentToken:getComputedStyle(document.documentElement).getPropertyValue('--v3-accent').trim(),avatars,stableFrames};
    },theme);
    assert.ok(colors.avatars.every(avatar=>avatar.accentDistance>80),`${theme} person avatar fills must remain visually distinct from Signal indigo`);
    assert.ok(colors.avatars.every(avatar=>avatar.contrast>=4.5),`${theme} person avatar initials need at least 4.5:1 contrast`);
    evidence.colors.push(colors);
    const screenshotPath=path.join(output,`bob-dm-${theme}.png`);await page.screenshot({path:screenshotPath,fullPage:true});
    const bytes=await fs.readFile(screenshotPath);evidence.screenshots.push({theme,path:screenshotPath,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  assert.deepEqual(evidence.errors,[]);assert.deepEqual(evidence.httpErrors,[]);assert.deepEqual(evidence.networkFailures,[]);
  evidence.sourceHashesAfter={};
  for(const file of sourceFiles){const bytes=await fs.readFile(path.join(root,file));evidence.sourceHashesAfter[file]=createHash('sha256').update(bytes).digest('hex');}
  evidence.changedDuringRun=sourceFiles.filter(file=>evidence.sourceHashesAtCaptureStart[file]!==evidence.sourceHashesAfter[file]);
  assert.deepEqual(evidence.changedDuringRun,[],'avatar source must stay frozen throughout capture');
  evidence.finishedAt=new Date().toISOString();
  const receipt=path.join(output,'avatar-receipt.json');await fs.writeFile(receipt,JSON.stringify(evidence,null,2));
  await context.close();await browser.close();console.log(JSON.stringify({receipt,colors:evidence.colors,screenshots:evidence.screenshots.map(({theme,sha256})=>({theme,sha256}))}));
}catch(error){
  evidence.failure=String(error);evidence.finishedAt=new Date().toISOString();await fs.writeFile(path.join(output,'avatar-failure.json'),JSON.stringify(evidence,null,2));
  await browser.close();throw error;
}
