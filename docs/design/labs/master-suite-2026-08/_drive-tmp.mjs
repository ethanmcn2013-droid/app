import { chromium } from "@playwright/test";
const URLB = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const sizes = [[390,844],[768,1024],[1280,900],[1440,960],[1920,1000]];
const b = await chromium.launch();
for (const [w,h] of sizes) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto(URLB + "?v=paper&state=tasks.board");
  await p.waitForTimeout(600);
  const dots = await p.$$('[data-app="tasks"] .cardDots');
  const out = [];
  for (const idx of [0, Math.floor(dots.length/2), dots.length-1]) {
    const d = dots[idx];
    if (!d) continue;
    await d.evaluate(e=>e.scrollIntoView({block:"center"}));
    await d.click({force:true});
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const m = document.querySelector('[data-app="tasks"] .cardMenu');
      if (!m) return null;
      const b = m.getBoundingClientRect();
      const op = m.offsetParent;
      const host = document.querySelector('[data-app="tasks"]');
      const hr = host.getBoundingClientRect();
      const cs = getComputedStyle(m);
      return {rect:[b.left,b.top,b.right,b.bottom].map(Math.round), style:m.getAttribute("style"),
        offsetParent: op? (op.tagName+"."+op.className) : null,
        hostRect:[hr.left,hr.top,hr.width,hr.height].map(Math.round),
        vis: cs.visibility, disp: cs.display,
        inView: b.top >= 0 && b.bottom <= innerHeight && b.left>=0 && b.right<=innerWidth};
    });
    out.push({idx, r});
    await p.keyboard.press("Escape").catch(()=>{});
    await p.evaluate(()=>{const v=document.querySelector('.menuVeil'); if(v) v.click();});
    await p.waitForTimeout(150);
  }
  console.log(w+"x"+h, JSON.stringify(out,null,1));
  await p.close();
}
await b.close();
