import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b = await chromium.launch();

async function probe(state, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(base + "?v=paper&state=" + state);
  await p.waitForTimeout(700);
  const out = {};
  out.state = state; out.w = w;
  // measure railAdd
  out.addBox = await p.evaluate(() => {
    const a = document.querySelector('.rail [data-rail="add"]');
    if (!a) return "no add";
    const r = a.getBoundingClientRect();
    return { w: r.width, h: r.height, disp: getComputedStyle(a).display, tabindex: a.getAttribute("tabindex") };
  });
  // focus help tile
  await p.evaluate(() => {
    const h = document.querySelector('.rail [data-rail="help"]');
    h.setAttribute("tabindex","0"); h.focus();
  });
  out.before = await p.evaluate(() => document.activeElement.dataset.rail || document.activeElement.className);
  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(300);
  out.afterDown = await p.evaluate(() => {
    const ae = document.activeElement;
    return { rail: ae.dataset.rail, cls: ae.className, tag: ae.tagName,
      stops: [...document.querySelectorAll('.rail [data-rail]')].map(n=>n.dataset.rail+":"+n.getAttribute("tabindex")).join(" ") };
  });
  // Tab from top of document
  const tabTrail = [];
  await p.evaluate(() => { document.body.setAttribute("tabindex","-1"); document.body.focus(); });
  for (let i=0;i<6;i++){
    await p.keyboard.press("Tab");
    await p.waitForTimeout(60);
    tabTrail.push(await p.evaluate(() => {
      const ae=document.activeElement;
      return (ae.dataset&&ae.dataset.rail?("rail:"+ae.dataset.rail):(ae.getAttribute&&ae.getAttribute("aria-label"))||ae.className||ae.tagName);
    }));
  }
  out.tabAfter = tabTrail;
  await p.close();
  return out;
}

for (const st of ["timeline.owner-flight","notes.notebook","tasks.board"]) {
  console.log(JSON.stringify(await probe(st, 1440, 960), null, 1));
}
await b.close();
