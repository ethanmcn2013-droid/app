import {chromium} from '@playwright/test';
import {mkdir, readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const lab=dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(await readFile(join(lab,'elevate.config.json'),'utf8'));
const output=join(lab,'shots');
const args=new Map(process.argv.slice(2).map(raw=>{const [key,...value]=raw.replace(/^--/,'').split('=');return [key,value.join('=')||'true']}));
const variants=(args.get('v')||config.variants.join(',')).split(',');
const states=(args.get('states')||config.states.join(',')).split(',');
const viewportFilter=args.get('viewports')?.split(',');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
let count=0;
for(const viewport of config.viewports.filter(item=>!viewportFilter||viewportFilter.includes(item.name))){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:2,isMobile:Boolean(viewport.isMobile),hasTouch:Boolean(viewport.isMobile)});
  const page=await context.newPage();
  for(const variant of variants){
    for(const state of states){
      const url=new URL(pathToFileURL(join(lab,config.master)).href);
      url.searchParams.set('v',variant);url.searchParams.set('state',state);url.searchParams.set('embed','1');
      await page.goto(url.href,{waitUntil:'load'});await page.evaluate(()=>document.fonts?.ready);await page.waitForTimeout(100);
      await page.evaluate(()=>{window.scrollTo(0,0);document.querySelectorAll('.settings-stage,.task-modal').forEach(element=>{element.scrollTop=0})});
      const name=`${variant}-${state}--${viewport.name}.png`;
      await page.screenshot({path:join(output,name)});count+=1;process.stdout.write(`${name}\n`);
    }
  }
  await context.close();
}
await browser.close();
process.stdout.write(`${count} frames captured\n`);
