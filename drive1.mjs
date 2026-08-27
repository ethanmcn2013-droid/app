import { chromium } from "@playwright/test";
const URL = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=tasks.board";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(URL);
await p.waitForTimeout(900);

const counts = async () => p.$$eval('.laneHead, .lane', ns => ns.map(n=>n.textContent.trim().slice(0,60)));
const say = async () => (await p.$eval('#say', n=>n.textContent)).trim();
const state = async () => p.evaluate(() => {
  const cards=[...document.querySelectorAll('.card[data-id]')];
  const grabbed=cards.filter(c=>c.getAttribute('aria-grabbed')==='true').map(c=>c.dataset.id);
  const lanes=[...document.querySelectorAll('.laneCount, .lane .count')].map(n=>n.textContent.trim());
  const a=document.activeElement;
  return {
    grabbed,
    panel: !!document.querySelector('.taskPanel'),
    carryStrip: (()=>{const c=document.querySelector('.carry'); if(!c) return null; const r=c.getBoundingClientRect(); return {text:c.textContent.trim(), rect:{x:r.x,y:r.y,w:r.width,h:r.height}, opacity:getComputedStyle(c).opacity};})(),
    active: a? (a.className+ '|' + (a.dataset?a.dataset.id||'':'') + '|' + a.tagName) : null,
    say: document.getElementById('say')?.textContent.trim(),
  };
});

// find lane counts a robust way
const laneCounts = async () => p.evaluate(()=>[...document.querySelectorAll('.laneHead')].map(h=>h.textContent.replace(/\s+/g,' ').trim()));
console.log('lanes initial', JSON.stringify(await laneCounts()));

const first = await p.$('.card[data-id]');
await first.focus();
console.log('focused', await p.evaluate(()=>document.activeElement.dataset.id));
await p.keyboard.press('Space');
await p.waitForTimeout(250);
console.log('after Space', JSON.stringify(await state(), null, 1));
console.log('lanes', JSON.stringify(await laneCounts()));
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(250);
console.log('after Right say=', await say(), 'lanes', JSON.stringify(await laneCounts()));
await p.keyboard.press('Enter');
await p.waitForTimeout(350);
console.log('after Enter', JSON.stringify(await state(), null, 1));
console.log('lanes', JSON.stringify(await laneCounts()));
await p.screenshot({path:'C:/Users/ethan/signal-studio-workspace/_wt-master-suite/shot-enter.png'});
await p.keyboard.press('Escape');
await p.waitForTimeout(350);
const s2 = await state();
console.log('after Escape', JSON.stringify(s2, null, 1));
console.log('lanes', JSON.stringify(await laneCounts()));
const hit = await p.evaluate(()=>{
  const a=document.activeElement; const r=a.getBoundingClientRect();
  const el=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
  return {active:a.className+'|'+(a.dataset?a.dataset.id:''), rect:{x:r.x,y:r.y,w:r.width,h:r.height}, hitClass: el? el.className+'|'+el.tagName : null, hitIsActive: el===a || (el&&a.contains(el))};
});
console.log('hit', JSON.stringify(hit));
await p.screenshot({path:'C:/Users/ethan/signal-studio-workspace/_wt-master-suite/shot-escape.png'});
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
console.log('after Escape2', JSON.stringify(await state(), null, 1));
await b.close();
