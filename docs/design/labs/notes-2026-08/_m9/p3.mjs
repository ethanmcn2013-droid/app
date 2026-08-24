import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
const act = async () => p.evaluate(() => { const a=document.activeElement; return a? a.className+" :: "+(a.getAttribute('aria-label')||a.textContent||'').trim().slice(0,60):"none"; });
await p.goto(BASE + "?state=pressure"); await p.waitForTimeout(600);
// long note on desk
const info = await p.evaluate(() => {
  const rb = document.querySelector(".readBody");
  const win = rb && rb.parentElement;
  const idx = document.querySelector("#index");
  return {
    readBodyCls: rb.className,
    scrollH: rb.scrollHeight, clientH: rb.clientHeight,
    winCls: win.className, winScroll: win.scrollHeight, winClient: win.clientHeight,
    idxH: idx ? idx.getBoundingClientRect().height : null,
    idxScrollH: idx ? idx.scrollHeight : null,
    fade: getComputedStyle(rb).getPropertyValue("--fade") || "",
    below: [...document.querySelectorAll(".readMore, .moreBelow, .deskMore")].map(e=>e.textContent.trim())
  };
});
console.log("PRESSURE", info);
// pick a sentence by keyboard
await p.locator(".readBody").focus();
await p.keyboard.press("ArrowDown"); await p.waitForTimeout(200);
console.log("after ArrowDown pick:", await p.evaluate(()=>{const s=document.querySelector(".sent[data-picked], .sent[aria-current], .pickOn, .sentOn"); return s? s.className+" | "+s.textContent.trim().slice(0,60):"none";}));
console.log("pickBar:", await p.locator(".pickBar").allInnerTexts().catch(()=>[]));
console.log("live:", await p.evaluate(()=>[...document.querySelectorAll('[aria-live],[role=status]')].map(e=>e.className+"="+e.textContent.trim().slice(0,90))));
await p.keyboard.press("Enter"); await p.waitForTimeout(400);
console.log("after Enter, seam open?", await p.locator(".peel").count(), await act());
const seam = await p.evaluate(()=>{
  const pe=document.querySelector(".peel"); if(!pe) return null;
  const r=pe.getBoundingClientRect();
  const note=document.querySelector(".desk").getBoundingClientRect();
  const commit=pe.querySelector(".peelCommit, .peelRow, .peelFoot");
  return {peelRect:[r.x|0,r.y|0,r.width|0,r.height|0], deskRect:[note.x|0,note.y|0,note.width|0,note.height|0], commitCls: commit?commit.className:null, commitSticky: commit?getComputedStyle(commit).position:null, field: pe.querySelector(".peelField")?.value};
});
console.log("SEAM", seam);
console.log("ERR",errs);
await p.screenshot({path:"docs/design/labs/notes-2026-08/_m9/pressure-seam.png"});
await b.close();
