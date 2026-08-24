import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=readback"); await p.waitForTimeout(600);
console.log("READBACK:", (await p.locator(".desk, .top").first().innerText()).replace(/\n/g," | ").slice(0,600));
await p.close();
const q = await b.newPage({ viewport: { width: 1440, height: 960 } });
await q.goto(BASE + "?state=notebook"); await q.waitForTimeout(500);
// open a note by pointer
await q.locator(".idxRow").nth(1).click(); await q.waitForTimeout(500);
console.log("sent spans:", await q.locator(".sent").count());
console.log("sent rest styles:", await q.evaluate(()=>{const s=document.querySelector(".sent");const c=getComputedStyle(s);return {cursor:c.cursor,bg:c.backgroundColor,box:c.boxShadow,td:c.textDecorationLine};}));
await q.locator(".sent").first().hover(); await q.waitForTimeout(250);
console.log("sent hover:", await q.evaluate(()=>{const s=document.querySelector(".sent");const c=getComputedStyle(s);return {bg:c.backgroundColor,box:c.boxShadow};}));
await q.locator(".sent").first().click(); await q.waitForTimeout(350);
console.log("pickBar:", await q.locator(".pickBar").allInnerTexts());
console.log("hint:", await q.locator(".pickHint").allInnerTexts().catch(()=>[]));
// mid-word drag
const box = await q.locator(".readBody").boundingBox();
await q.mouse.move(box.x+120, box.y+12); await q.mouse.down(); await q.mouse.move(box.x+330, box.y+12,{steps:8}); await q.mouse.up();
await q.waitForTimeout(400);
console.log("after drag pickBar:", await q.locator(".pickBar").allInnerTexts());
console.log("selection:", await q.evaluate(()=>String(getSelection())));
await q.screenshot({path:"docs/design/labs/notes-2026-08/_m9/pick.png"});
await b.close();
