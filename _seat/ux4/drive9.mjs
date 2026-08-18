import { chromium } from "@playwright/test";
const base = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const out = "C:/Users/ethan/signal-studio-workspace/_wt-design-notes/_seat/ux4/";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
await p.goto(base + "?state=seam"); await p.waitForTimeout(600);
const peel = await p.$(".peel, .peelPanel, [class*=peel]");
const box = await p.evaluate(()=>{const n=document.querySelector('.peelPanel')||document.querySelector('[class*=peel]');const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cls:n.className}});
console.log(JSON.stringify(box));
await p.screenshot({path:out+"peel-zoom.png", clip:{x:box.x-8,y:box.y-8,width:box.w+16,height:box.h+16}});
// does selecting different words in the note re-seed? and does the peel show what is EXCLUDED?
console.log("peel html:", (await p.evaluate(()=>document.querySelector('.peelPanel')?.outerHTML||'')).replace(/\s+/g,' ').slice(0,1800));
await b.close();
