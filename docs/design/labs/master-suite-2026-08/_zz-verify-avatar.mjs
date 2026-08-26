import { chromium } from "@playwright/test";
const U = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b = await chromium.launch();
for (const [w,h] of [[1440,960],[1920,1000],[1280,900],[768,1024],[390,844]]) {
for (const st of ["notes.notebook","tasks.board","timeline.owner-flight"]) {
  const p = await b.newPage({ viewport:{width:w,height:h} });
  await p.goto(U + "?v=paper&state=" + st);
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const vis = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&e.offsetParent!==null; };
    const all = [...document.querySelectorAll(".railAvatar, .dockAvatar")];
    return all.map(e=>{ const r=e.getBoundingClientRect(); return {
      cls: e.className, tag: e.tagName, txt: e.textContent.trim(),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      vis: vis(e), hiddenAncestor: !!e.closest("[hidden]"),
      app: (e.closest(".app")||{}).dataset ? e.closest(".app").dataset.app : (e.closest("#deck")?"deck":"?"),
      label: e.getAttribute("aria-label"), title: e.getAttribute("title"), dis: e.getAttribute("aria-disabled"), ti: e.getAttribute("tabindex"),
    };});
  });
  console.log(w+"x"+h, st, JSON.stringify(r,null,0));
  await p.close();
}}
await b.close();
