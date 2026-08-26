import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
// focus first card
await p.locator("article.card").first().focus();
const cur = async()=>await p.evaluate(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return (a.tagName.toLowerCase()+"."+String(a.className).split(" ")[0])+" | "+(a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,48)+" | ["+[r.x,r.y,r.width,r.height].map(Math.round).join(",")+"]"+((r.bottom<0||r.top>innerHeight)?" OFFSCREEN":"");});
console.log("start", await cur());
const seen = new Set();
for (const k of ["ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowRight","ArrowDown","ArrowDown","ArrowDown","ArrowRight","ArrowRight","ArrowRight","ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown"]) {
  await p.keyboard.press(k); await p.waitForTimeout(120);
  console.log(k.padEnd(11), await cur());
}
await p.close(); await b.close();
