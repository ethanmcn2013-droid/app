import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const S="C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960}, deviceScaleFactor:2 });
const live = async ()=>p.evaluate(()=>document.getElementById('say')?.textContent);
const strip = async ()=>p.evaluate(()=>{const n=[...document.querySelectorAll('.undo')][0]; return n?n.innerText.replace(/\n/g,' | '):null;});

// REVIEW
await p.goto(BASE+"?state=review&v=locked"); await p.waitForTimeout(400);
console.log("focus at load:", await p.evaluate(()=>document.activeElement.tagName+" "+(document.activeElement.innerText||'').slice(0,30)));
await p.keyboard.press("T"); await p.waitForTimeout(350);
console.log("after T -> live:", await live(), "|| strip:", await strip());
await p.screenshot({path:S+"review-afterT.png"});
await p.keyboard.press("K"); await p.waitForTimeout(350);
console.log("after K -> live:", await live(), "|| strip:", await strip());
// is T discoverable without keyboard? are the buttons still clickable
console.log("hand buttons:", await p.evaluate(()=>[...document.querySelectorAll('.handTop button')].map(x=>x.innerText.replace(/\n/g,' '))));
await p.keyboard.press("Control+Z"); await p.waitForTimeout(300);
console.log("after ctrl+z -> live:", await live());

// SEARCH
await p.goto(BASE+"?state=notebook&v=locked"); await p.waitForTimeout(400);
await p.keyboard.press("/"); await p.waitForTimeout(250);
console.log("search focus:", await p.evaluate(()=>document.activeElement.className+" / "+document.activeElement.placeholder));
await p.keyboard.type("marquee", {delay:40}); await p.waitForTimeout(300);
console.log("after 'marquee' rows:", await p.evaluate(()=>document.querySelectorAll('.idxRow').length), "live:", await live());
await p.screenshot({path:S+"search-marquee.png"});
await p.keyboard.type("zzzz", {delay:40}); await p.waitForTimeout(300);
console.log("no-result live:", await live());
await p.screenshot({path:S+"search-none.png"});

// INDEX WALK
await p.goto(BASE+"?state=notebook&v=locked"); await p.waitForTimeout(400);
for(let i=0;i<12;i++){ await p.keyboard.press("Tab"); const a=await p.evaluate(()=>document.activeElement.className+" | "+(document.activeElement.getAttribute('aria-label')||document.activeElement.innerText||'').slice(0,50)); if(/idxRow|index/.test(a)){console.log("tab",i+1,"->",a);break;} if(i>9)console.log("tab",i+1,"->",a); }
await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.waitForTimeout(200);
console.log("after 2 arrows live:", await live());
await p.keyboard.press("Enter"); await p.waitForTimeout(400);
console.log("after Enter live:", await live(), "focus:", await p.evaluate(()=>document.activeElement.className));
await p.screenshot({path:S+"row-open.png"});
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
console.log("after Esc live:", await live(), "focus:", await p.evaluate(()=>document.activeElement.className+" | "+(document.activeElement.getAttribute('aria-label')||'').slice(0,40)));

// SEAM
await p.goto(BASE+"?state=seam&v=locked"); await p.waitForTimeout(400);
console.log("seam focus:", await p.evaluate(()=>document.activeElement.tagName+" "+document.activeElement.className));
console.log("seam editable?:", await p.evaluate(()=>{const n=[...document.querySelectorAll('*')].find(e=>/Switch the orchard room heating/.test(e.textContent||'')&&e.children.length===0); return n? {tag:n.tagName, editable:n.isContentEditable, cls:n.className}:null;}));
await b.close();
