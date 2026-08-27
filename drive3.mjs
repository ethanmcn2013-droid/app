import { chromium } from "@playwright/test";
const URL = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=tasks.board";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(URL); await p.waitForTimeout(900);
const cols = async ()=>p.evaluate(()=>[...document.querySelectorAll('.col,.column,.board > *')].map(n=>n.className+'|'+(n.querySelectorAll('.card[data-id]').length)));
console.log(JSON.stringify(await cols(),null,1));
const counts = async ()=>p.evaluate(()=>[...document.querySelectorAll('.board [role="list"], .board section, .board > div')].map(n=>n.querySelectorAll('.card[data-id]').length));
console.log('counts', JSON.stringify(await counts()));
// carry strip stacking
const first = await p.$('.card[data-id]'); await first.focus();
await p.keyboard.press('Space'); await p.waitForTimeout(200);
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
console.log('counts after right', JSON.stringify(await counts()));
await p.keyboard.press('Enter'); await p.waitForTimeout(300);
const strip = await p.evaluate(()=>{
  const c=document.querySelector('.carry'); const r=c.getBoundingClientRect();
  const el=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
  const scrim=document.querySelector('.tpScrim'); const cs=scrim?getComputedStyle(scrim):null;
  return {stripHit: el?el.className+'|'+el.tagName:null, stripZ:getComputedStyle(c).zIndex, stripPos:getComputedStyle(c).position,
    scrim: cs?{bg:cs.backgroundColor, z:cs.zIndex, opacity:cs.opacity, backdrop:cs.backdropFilter}:null,
    panelZ: getComputedStyle(document.querySelector('.taskPanel')).zIndex};
});
console.log('strip', JSON.stringify(strip,null,1));
await p.screenshot({path:'shot-enter2.png'});
await p.evaluate(()=>{const c=document.querySelector('.carry');c.scrollIntoView();});
const clip = await p.evaluate(()=>{const r=document.querySelector('.carry').getBoundingClientRect();return {x:r.x-20,y:r.y-20,width:r.width+40,height:r.height+40};});
await p.screenshot({path:'shot-strip.png', clip});
await b.close();
