import { launch, open } from "./drive.mjs";
const b = await launch();
for (const [W,H] of [[390,844],[768,1024],[1280,900],[1440,960],[1920,1000]]) {
  const p = await open(b, { state: "tasks.board", width:W, height:H });
  const hit = new Set();
  for (let i=0;i<120;i++){ await p.keyboard.press("Tab");
    const s = await p.evaluate(()=>{const a=document.activeElement; if(!a||a===document.body) return null; return (a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,48)+" @"+String(a.className).split(" ")[0];});
    if(!s) break; if(hit.has(s)) break; hit.add(s); }
  const waiting = [...hit].some(s=>/Add a task to Waiting/.test(s));
  console.log(W+"x"+H, "stops:"+hit.size, "reaches Waiting Add:", waiting);
  console.log("  ", [...hit].filter(s=>/Add a task/.test(s)).join(" ;; "));
  await p.close();
}
await b.close();
