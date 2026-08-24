import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 800 } });
await p.goto(BASE + "?state=pressure"); await p.waitForTimeout(500);
await p.locator(".readBody").focus(); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
await p.screenshot({path:"docs/design/labs/notes-2026-08/_m9/seam800.png"});
console.log(await p.evaluate(()=>{
  const sheet=document.querySelector(".sheet")||document.querySelector(".paper");
  const scr=[...document.querySelectorAll("*")].filter(e=>e.scrollHeight>e.clientHeight+2 && ["auto","scroll"].includes(getComputedStyle(e).overflowY)).map(e=>e.className+" "+e.scrollHeight+"/"+e.clientHeight);
  return {scrollers:scr, bodyScroll:[document.scrollingElement.scrollHeight, innerHeight],
    idxTopText: (document.querySelector(".idxBar,.idxHeader,.idxTitle")||{}).textContent,
    idxAria: document.querySelector("#index")?.getAttribute("aria-label")};
}));
// can we reach index rows by keyboard?
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
console.log("after esc focus:", await p.evaluate(()=>document.activeElement.className));
await b.close();
