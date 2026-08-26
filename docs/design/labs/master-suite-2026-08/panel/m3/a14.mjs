import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
// BFS over arrow keys from the roving card, recording every element ever focused
const keys = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown"];
const sig = async()=>await p.evaluate(()=>{const a=document.activeElement;return (a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,44)+"|"+String(a.className).split(" ")[0];});
const start = async()=>{ await p.evaluate(()=>{const c=[...document.querySelectorAll("article.card")].find(x=>x.tabIndex===0)||document.querySelector("article.card"); c.focus();}); };
const seen = new Set(); const queue = [[]];
while (queue.length) {
  const path = queue.shift();
  if (path.length > 6) continue;
  await start();
  for (const k of path) { await p.keyboard.press(k); }
  await p.waitForTimeout(40);
  const s = await sig();
  if (seen.has(s)) continue;
  seen.add(s);
  for (const k of keys) queue.push([...path, k]);
}
console.log("reachable by arrows alone from a card ("+seen.size+"):");
for (const s of [...seen].sort()) console.log("  "+s);
console.log("\nAny trayAdd reached?", [...seen].some(s=>s.includes("trayAdd")));
await p.close(); await b.close();
