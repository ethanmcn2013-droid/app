import { chromium } from "@playwright/test";
const FILE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
async function open(q="", vp={width:1440,height:960}) {
  const p = await b.newPage({ viewport: vp });
  p.on("console", m => { if (m.type()==="error") console.log("CONSOLE ERR", m.text()); });
  await p.goto(FILE + q);
  await p.waitForTimeout(700);
  return p;
}
// 1. loading frame vs what arrives
{
  const p = await open("?state=loading");
  const sk = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll(".tray[data-lane]").forEach(t => {
      const body = t.querySelector(".trayBody");
      out[t.dataset.lane] = {
        skeletons: body ? body.querySelectorAll(":scope > *").length : -1,
        heights: [...(body?body.querySelectorAll(":scope > *"):[])].map(n=>Math.round(n.getBoundingClientRect().height)),
        headText: t.querySelector(".trayHead")?.innerText.replace(/\n/g," "),
        busy: t.getAttribute("aria-busy"),
      };
    });
    out._root = { busy: document.querySelector(".board")?.getAttribute("aria-busy"), say: document.querySelector("#say")?.textContent };
    out._skelStyle = (()=>{ const n=document.querySelector(".trayBody > *"); if(!n) return null; const s=getComputedStyle(n); return {sh:s.boxShadow.slice(0,40), br:s.borderRadius, anim:s.animationName, bg:s.backgroundColor}; })();
    return out;
  });
  console.log("LOADING", JSON.stringify(sk, null, 1));
  await p.close();
}
// 2. real board head text for comparison
{
  const p = await open();
  const real = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll(".tray[data-lane]").forEach(t => {
      out[t.dataset.lane] = {
        cards: t.querySelectorAll(".card").length,
        heights: [...t.querySelectorAll(".card")].map(n=>Math.round(n.getBoundingClientRect().height)),
        headText: t.querySelector(".trayHead")?.innerText.replace(/\n/g," "),
      };
    });
    return out;
  });
  console.log("REAL", JSON.stringify(real, null, 1));
  await p.close();
}
await b.close();
