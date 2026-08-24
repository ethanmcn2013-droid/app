import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
for (const [st, w, h] of [["board",1440,960],["dense",1440,960],["board",390,844],["cards",1440,960],["planning",1440,960]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(url + "?state=" + st);
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => {
    const all = [...document.querySelectorAll("[title]")].map(e => ({
      cls: e.className && e.className.baseVal !== undefined ? "svg" : (e.className||""),
      tag: e.tagName,
      title: e.getAttribute("title"),
      text: (e.textContent||"").trim().slice(0,60),
      full: e.dataset ? e.dataset.full : undefined,
    }));
    const dup = all.filter(x => x.full && (x.title === x.full));
    return { total: all.length, dup: dup.length,
      byCls: all.reduce((m,x)=>{m[x.cls]=(m[x.cls]||0)+1;return m;},{}),
      samples: dup.slice(0,3) };
  });
  console.log(st, w+"x"+h, JSON.stringify(r, null, 1));
  await p.close();
}
await b.close();
