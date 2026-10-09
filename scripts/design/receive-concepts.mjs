import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const failedOnly=process.env.CONCEPT_RECEIVING_FAILED_ONLY==='1';
const affected=new Set(['list/4','calendar/4','analytics/5','apps/2','apps/3','shared-timeline/1','shared-timeline/3','shared-timeline/4','shared-timeline/5','shared-timeline/6'].map(p=>'/app/concepts/'+p));
const canonical={mobile:{width:390,height:844},tablet:{width:768,height:1024},desktop:{width:1280,height:900},wide:{width:1440,height:960}};
const prefix=failedOnly?'repair-':'';
const output = path.resolve('docs/design/concept-sprint/receiving-20261009');
mkdirSync(output, { recursive:true });
const browser = await chromium.launch({ channel:'chrome' });
const issues=[]; const results=[];
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}, reducedMotion:'reduce'});
  page.on('pageerror', e=>issues.push({url:page.url(),kind:'pageerror',message:e.message}));
  page.on('console', m=>{if(m.type()==='error') issues.push({url:page.url(),kind:'console',message:m.text()});});
  const base='http://127.0.0.1:4397';
  let concepts=[];
  for(const [name,viewport] of Object.entries(canonical)){
    await page.setViewportSize(viewport);
    const response=await page.goto(`${base}/app/concepts`,{waitUntil:'networkidle',timeout:180000});
    const links=await page.locator('a[href^="/app/concepts/"]').evaluateAll(elements=>elements.map(e=>({href:e.getAttribute('href'),label:e.textContent})));
    if(response.status()!==200||links.length!==48) throw Error(`gallery ${name}: ${response.status()}, ${links.length} links`);
    concepts=links;
    await page.screenshot({path:path.join(output,`${prefix}gallery-${name}.jpg`),fullPage:true,type:"jpeg",quality:70});
    results.push({kind:'gallery',viewport:name,status:response.status(),links:links.length});
  }
  for(const concept of concepts.filter(c=>!failedOnly||affected.has(c.href))){
    for(const viewport of failedOnly?Object.entries(canonical).map(([name,size])=>({name,...size})):[{name:'desktop',width:1280,height:900},...( /\/(board|list|calendar|analytics|apps|shared-timeline)\//.test(concept.href)?[{name:'mobile',width:390,height:844}]:[])]){
      await page.setViewportSize(viewport);
      const response=await page.goto(base+concept.href,{waitUntil:'networkidle',timeout:180000});
      const isNew=/\/(board|list|calendar|analytics|apps|shared-timeline)\//.test(concept.href);
      const heading=await page.getByRole('heading').first().textContent({timeout:1000}).catch(()=>null);
      const retainedPlaceholder=await page.getByText('This concept is being designed.',{exact:true}).count();
      if(response.status()!==200 || (isNew && !heading?.trim()) || (!isNew && !retainedPlaceholder && !heading?.trim())) throw Error(`${concept.href}: ${response.status()} or missing prototype content`);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      const screenshot=prefix+concept.href.replace('/app/concepts/','').replaceAll('/','-')+'-'+viewport.name+'.jpg';
      await page.screenshot({path:path.join(output,screenshot),type:'jpeg',quality:70});
      results.push({kind:'concept',path:concept.href,viewport:viewport.name,status:response.status(),heading,retainedPlaceholder:!!retainedPlaceholder,documentOverflow:overflow,screenshot});
      console.log(concept.href,viewport.name,'rendered',overflow?'overflow':'');
    }
  }
  const sourceFiles=['src/app/app/concepts/page.tsx','src/components/concepts/registry.ts','next.config.ts','src/components/concepts/use-review-reduced-motion.ts','docs/design/concept-sprint/receiving-20261009/source-lineage.json'];
  const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(f,'utf8').replace(/\r\n?/g,'\n')).digest('hex')]));
  writeFileSync(path.join(output,failedOnly?'browser-receipt-repaired.json':'browser-receipt.json'),JSON.stringify({scope:'Local review-mode render evidence; no visual direction approval, hosted or production proof.',sourceHashes,results,issues},null,2)+'\n');
  if(issues.length) throw Error(`${issues.length} browser runtime errors; receipt retained`);
}finally {await browser.close();}
