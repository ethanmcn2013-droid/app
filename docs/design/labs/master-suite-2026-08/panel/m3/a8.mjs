import { launch, open } from "./drive.mjs";
const b = await launch();
const state = process.argv[2] || "tasks.board";
const W = +(process.argv[3]||1440), H = +(process.argv[4]||960);
const p = await open(b, { state, width: W, height: H });
const seq = [];
for (let i=0;i<70;i++){
  await p.keyboard.press("Tab");
  const info = await p.evaluate(()=>{
    const a=document.activeElement; if(!a||a===document.body) return {end:true};
    const r=a.getBoundingClientRect(); const cs=getComputedStyle(a);
    return { tag:a.tagName.toLowerCase(), cls:String(a.className).split(" ").slice(0,2).join("."), name:(a.getAttribute("aria-label")||a.textContent||a.value||"").trim().replace(/\s+/g," ").slice(0,54),
      box:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)],
      offscreen: r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth, outline: cs.outlineWidth+" "+cs.outlineStyle, shadow: cs.boxShadow.slice(0,40) };
  });
  if (info.end) { seq.push("-- body --"); break; }
  seq.push(`${String(i).padStart(2)} ${info.tag}.${info.cls} [${info.box.join(",")}]${info.offscreen?" OFFSCREEN":""} "${info.name}"`);
}
console.log(state, W+"x"+H); console.log(seq.join("\n"));
await p.close(); await b.close();
