import { chromium, devices } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch:true, isMobile:true });
const errs=[]; p.on("pageerror",e=>errs.push(e.message));
await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(600);
// index bottom clearance under the dock
const m0 = await p.evaluate(()=>{ const i=document.querySelector("#index"); i.scrollTop=i.scrollHeight; return 1;});
await p.waitForTimeout(200);
console.log(await p.evaluate(()=>{
  const i=document.querySelector("#index"); const d=document.querySelector(".dock");
  const rows=[...document.querySelectorAll(".idxRow")];
  const last=rows[rows.length-1].getBoundingClientRect(); const dr=d.getBoundingClientRect();
  return {lastRowBottom:Math.round(last.bottom), dockTop:Math.round(dr.top), padB:getComputedStyle(i).paddingBottom, overlap: Math.round(last.bottom-dr.top)};
}));
await p.screenshot({path:"docs/design/labs/notes-2026-08/_m9/phone-bottom.png"});
// capture from the dock
await p.locator(".dockGlyph[aria-label='Write a note']").click().catch(async()=>{ await p.locator(".phoneField").click(); });
await p.waitForTimeout(400);
console.log("phoneField?", await p.locator(".phoneField").count(), "focused:", await p.evaluate(()=>document.activeElement.className));
await p.keyboard.type("Ask the band to arrive by five");
await p.waitForTimeout(200);
await p.screenshot({path:"docs/design/labs/notes-2026-08/_m9/phone-capture.png"});
console.log("dock state:", (await p.locator(".dock").innerText()).replace(/\n/g," | "));
// commit: is there a visible save control?
const saveBtn = await p.locator("[aria-label='Save it']").count();
console.log("save control count:", saveBtn);
await p.keyboard.press("Control+Enter"); await p.waitForTimeout(400);
console.log("after ctrl+enter first row:", (await p.locator(".idxRow").first().innerText()).replace(/\n/g," | ").slice(0,80));
console.log("undo:", await p.locator(".undo").allInnerTexts());
console.log("index scrollTop after capture:", await p.evaluate(()=>document.querySelector("#index").scrollTop));
console.log("ERR", errs);
await b.close();
