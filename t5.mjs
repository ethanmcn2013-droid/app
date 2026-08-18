import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(BASE + "?v=locked&state=search"); await p.waitForTimeout(500);
console.log("initial value:", JSON.stringify(await p.inputValue(".searchBar input")));
console.log("initial head:", await p.evaluate(()=>document.querySelector(".indexHead")?.innerText.replace(/\n/g," ")));
await p.click(".searchBar input");
await p.evaluate(()=>{const i=document.querySelector(".searchBar input"); i.setSelectionRange(i.value.length,i.value.length);});
await p.keyboard.type("xyz", {delay:120});
await p.waitForTimeout(300);
console.log("after typing xyz at end:", JSON.stringify(await p.inputValue(".searchBar input")));
console.log("selectionStart:", await p.evaluate(()=>document.querySelector(".searchBar input").selectionStart));
console.log("head:", await p.evaluate(()=>document.querySelector(".indexHead")?.innerText.replace(/\n/g," ")));

// fresh: clear and type a real word
await p.evaluate(()=>{const i=document.querySelector(".searchBar input"); i.value=""; i.dispatchEvent(new Event("input",{bubbles:true}));});
await p.waitForTimeout(300);
await p.click(".searchBar input");
await p.keyboard.type("marquee", {delay:120});
await p.waitForTimeout(400);
console.log("typed 'marquee' ->", JSON.stringify(await p.inputValue(".searchBar input")));
console.log("head:", await p.evaluate(()=>document.querySelector(".indexHead")?.innerText.replace(/\n/g," ")));
console.log("rows:", await p.evaluate(()=>document.querySelectorAll(".idxRow").length));
console.log("marks:", await p.evaluate(()=>[...document.querySelectorAll("mark")].map(m=>m.innerText).slice(0,5)));
await p.screenshot({path:"C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/879d6f09-b885-456b-8a06-2fa54d8950b5/scratchpad/search2.png"});
await b.close();
