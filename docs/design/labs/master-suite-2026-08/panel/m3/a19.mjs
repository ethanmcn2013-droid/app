import { launch, open } from "./drive.mjs";
const b = await launch();
for (const [W,H] of [[390,844],[1440,960]]) {
const p = await open(b, { state: "notes.voice", width:W, height:H });
console.log(W, JSON.stringify(await p.evaluate(()=>{
  const out=[];
  for (const e of document.querySelectorAll("button,a[href],[role=button],input,textarea,[tabindex]")) {
    if (e.closest(".dark")) continue;
    if (e.closest("[inert]")) continue;
    if (e.tabIndex<0) continue;
    const cs=getComputedStyle(e); if (cs.display==="none"||cs.visibility==="hidden") continue;
    const r=e.getBoundingClientRect();
    out.push({n:(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,36),c:String(e.className).split(" ")[0],box:[r.x|0,r.y|0,r.width|0,r.height|0],op:cs.opacity});
  }
  return out;
}),null,0));
// try clicking the rail tasks tile while dictating (mouse)
const r = await p.evaluate(()=>{const t=[...document.querySelectorAll(".railTile")].find(x=>/^Tasks/.test(x.getAttribute("aria-label")||"")); if(!t)return null; const b=t.getBoundingClientRect(); const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2); return {box:[b.x|0,b.y|0,b.width|0,b.height|0], hit:String(hit?.className)+"/"+hit?.tagName};});
console.log("  tasks tile:", JSON.stringify(r));
await p.close();
}
await b.close();
