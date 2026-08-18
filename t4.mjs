import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const S = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";

// capture + undo timing
await p.goto(BASE + "?v=locked&state=notebook"); await p.waitForTimeout(400);
await p.click(".topField");
const t0 = Date.now();
await p.keyboard.type("Marquee sides confirmed with the hire company");
await p.keyboard.press("Control+Enter");
await p.waitForSelector(".undo", {timeout:2000});
console.log("capture->undo bar ms:", Date.now()-t0);
console.log("undo:", await p.evaluate(()=>document.querySelector(".undo").innerText.replace(/\n/g," | ")));
console.log("head count:", await p.evaluate(()=>document.querySelector(".indexHead").innerText.replace(/\n/g," ")));
await p.keyboard.press("Control+z"); await p.waitForTimeout(300);
console.log("after ctrl+z field:", JSON.stringify(await p.inputValue(".topField")));

// index keyboard walk
await p.goto(BASE + "?v=locked&state=notebook"); await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector(".idxRow").focus());
await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(200);
console.log("cursor row:", await p.evaluate(()=>document.querySelector(".idxRow[data-cursor]")?.innerText.replace(/\n/g," | ").slice(0,80)));
await p.keyboard.press("Enter"); await p.waitForTimeout(400);
console.log("opened, readSrc:", await p.evaluate(()=>document.querySelector(".readSrc")?.innerText.replace(/\n/g," | ")));
console.log("readBody first 60:", await p.evaluate(()=>document.querySelector(".readBody")?.innerText.slice(0,60)));
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
console.log("after Esc, focus:", await p.evaluate(()=>document.activeElement.className+" :: "+document.activeElement.innerText?.slice(0,40).replace(/\n/g," ")));

// search
await p.keyboard.press("/"); await p.waitForTimeout(300);
await p.keyboard.type("marquee"); await p.waitForTimeout(400);
console.log("search results:", await p.evaluate(()=>document.querySelectorAll(".idxRow").length));
console.log("search head:", await p.evaluate(()=>document.querySelector(".indexHead")?.innerText.replace(/\n/g," ")));
await p.screenshot({path:S+"search.png"});

// review T / K
await p.goto(BASE + "?v=locked&state=review"); await p.waitForTimeout(400);
const before = await p.evaluate(()=>document.querySelector(".handTitle").innerText + " / " + document.querySelector(".handOf").innerText);
await p.keyboard.press("t"); await p.waitForTimeout(500);
console.log("after T:", await p.evaluate(()=>document.querySelector(".handOf")?.innerText), "| body:", await p.evaluate(()=>document.querySelector(".handBody")?.innerText.slice(0,50)));
console.log("deckNote:", await p.evaluate(()=>document.querySelector(".deckNote")?.innerText.replace(/\n/g," ")));
await p.keyboard.press("k"); await p.waitForTimeout(500);
console.log("after K:", await p.evaluate(()=>document.querySelector(".handOf")?.innerText));
console.log("before was:", before);

// seam typography
await p.goto(BASE + "?v=locked&state=seam"); await p.waitForTimeout(400);
console.log("seam:", await p.evaluate(()=>{
  const g=(s)=>{const e=document.querySelector(s); if(!e)return null; const c=getComputedStyle(e); const r=e.getBoundingClientRect();
    return {t:(e.value??e.innerText).replace(/\n/g," ").slice(0,80), fs:c.fontSize, fw:c.fontWeight, w:Math.round(r.width), maxW:c.maxWidth};};
  return {peelLabel:g(".peelLabel"), peelField:g(".peelField"), peelWhy:g(".peelWhy"), stays:g(".stays"), pick:g(".pick"), readBody:g(".readBody")};
}));
await p.screenshot({path:S+"seam.png"});
await b.close();
