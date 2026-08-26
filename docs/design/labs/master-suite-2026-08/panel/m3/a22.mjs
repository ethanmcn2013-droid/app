import { launch, open } from "./drive.mjs";
const b = await launch();
for (const [W,H] of [[1440,960],[720,900],[390,844]]) {
const p = await open(b, { state: "tasks.board", width:W, height:H, touch:W<=480 });
const cur = async()=>await p.evaluate(()=>{const a=document.activeElement;return String(a.className).split(" ")[0]+" | "+(a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,40);});
await p.locator(".rail [tabindex='0'], .rail .railTile[tabindex='0']").first().focus();
console.log("=== "+W+" start", await cur());
const keys = W<=720 ? ["ArrowRight","ArrowRight","ArrowRight","ArrowRight","ArrowRight","ArrowRight","ArrowRight","ArrowRight"] : ["ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown"];
for (const k of keys) { await p.keyboard.press(k); await p.waitForTimeout(120); console.log(" "+k, await cur()); }
await p.close();
}
await b.close();
