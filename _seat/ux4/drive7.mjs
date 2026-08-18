import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
await p.goto(base + "?state=notebook"); await p.waitForTimeout(500);
await p.evaluate(()=>{const r=[...document.querySelectorAll('.idxRow')][2]; r.click();});
await p.waitForTimeout(700);
console.log("PHONE after tap row:", (await p.evaluate(()=>document.body.innerText)).slice(0,600).replace(/\n/g," | "));
await p.screenshot({path:out+"p-read.png"});
// can we reach the peel on phone?
const btns = await p.evaluate(()=>[...document.querySelectorAll('button')].map(x=>x.getAttribute('aria-label')||x.textContent.trim()).filter(Boolean));
console.log("PHONE buttons:", JSON.stringify(btns.slice(0,25)));
// pressure desktop
const p2 = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p2.goto(base+"?state=pressure"); await p2.waitForTimeout(600);
console.log("PRESSURE head:", (await p2.evaluate(()=>document.body.innerText)).slice(0,700).replace(/\n/g," | "));
console.log("scroll containers:", JSON.stringify(await p2.evaluate(()=>[...document.querySelectorAll('*')].filter(n=>n.scrollHeight>n.clientHeight+4 && getComputedStyle(n).overflowY.match(/auto|scroll/)).map(n=>n.className+" "+n.scrollHeight+"/"+n.clientHeight))));
await p2.screenshot({path:out+"pressure.png"});
await b.close();
