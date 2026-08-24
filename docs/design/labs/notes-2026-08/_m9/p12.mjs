import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(500);
await p.locator(".topField").click();
await p.keyboard.type("Ring the");
await p.waitForTimeout(400);
console.log("topFoot:", (await p.locator(".topFoot").innerText()).replace(/\n/g," | "));
await p.screenshot({path:"docs/design/labs/notes-2026-08/_m9/desk-typing.png", clip:{x:340,y:100,width:1060,height:280}});
// 4000 enforcement
await p.locator(".topField").fill("x".repeat(4100));
await p.dispatchEvent(".topField","input"); await p.waitForTimeout(400);
console.log("at 4100:", (await p.locator(".topFoot").innerText()).replace(/\n/g," | "));
await p.keyboard.press("Control+Enter"); await p.waitForTimeout(400);
console.log("committed? first row:", (await p.locator(".idxRow").first().innerText()).replace(/\n/g," | ").slice(0,60));
await b.close();
