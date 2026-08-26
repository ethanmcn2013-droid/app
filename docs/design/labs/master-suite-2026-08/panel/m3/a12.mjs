import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
const cur = async()=>await p.evaluate(()=>{const a=document.activeElement;return (a.tagName.toLowerCase()+"."+String(a.className).split(" ")[0])+" | "+(a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,44);});
// tab to first card
for(let i=0;i<10;i++){await p.keyboard.press("Tab"); if((await cur()).startsWith("article.card")) break;}
console.log("on card", await cur());
await p.keyboard.press("ArrowRight"); await p.waitForTimeout(150);
console.log("right ->", await cur());
for (const k of ["Tab","Tab","Tab"]) { await p.keyboard.press(k); await p.waitForTimeout(150); console.log(k, await cur()); }
console.log("tabindex map:", JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll(".trayAdd")].map(e=>e.getAttribute("aria-label")+":"+e.tabIndex))));
// Now walk to Review then try to reach Waiting
await p.locator(".tray[data-lane] article.card").first().focus();
console.log("\n--- can the rover enter Waiting? ---");
await p.evaluate(()=>{const c=[...document.querySelectorAll("article.card")].find(x=>x.tabIndex===0); c&&c.focus();});
for (const k of ["ArrowRight","ArrowRight","ArrowRight","ArrowRight"]) { await p.keyboard.press(k); await p.waitForTimeout(150); console.log(k, await cur(), "| lane:", await p.evaluate(()=>document.activeElement.closest(".tray")?.getAttribute("aria-label"))); }
console.log("tabindex map:", JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll(".trayAdd")].map(e=>e.getAttribute("aria-label")+":"+e.tabIndex))));
await p.close(); await b.close();
