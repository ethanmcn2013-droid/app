import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
const cur = async()=>await p.evaluate(()=>{const a=document.activeElement;return (a.tagName.toLowerCase()+"."+String(a.className).split(" ")[0])+" | "+(a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,44);});
await p.locator(".trayAdd").first().focus();
console.log("start", await cur());
for (const k of ["ArrowRight","ArrowRight","ArrowRight","ArrowRight","ArrowRight","ArrowUp","ArrowDown","Tab"]) { await p.keyboard.press(k); await p.waitForTimeout(120); console.log(k.padEnd(11), await cur()); }
console.log("--- from last card in To Do, arrow down/tab ---");
await p.locator("article.card").nth(2).focus();
for (const k of ["ArrowDown","Tab","Tab"]) { await p.keyboard.press(k); await p.waitForTimeout(120); console.log(k.padEnd(11), await cur()); }
await p.close(); await b.close();
