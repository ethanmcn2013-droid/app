import { launch, open } from "./drive.mjs";
const b = await launch();
const states=["tasks.board","tasks.dense","notes.notebook","notes.seam","notes.voice","timeline.owner-flight","timeline.desk","timeline.phone"];
for (const st of states) {
  for (const [W,H] of [[390,844],[768,1024],[1000,900],[1280,900],[1440,960],[1920,1000]]) {
    const p = await open(b, { state: st, width:W, height:H });
    const r = await p.evaluate(()=>{
      const out=[];
      for (const e of document.querySelectorAll("button,a[href],[role=button],[role=checkbox],input,textarea,[tabindex='0']")) {
        if (e.closest("[inert]")||e.closest("[aria-hidden=true]")) continue;
        if (e.tabIndex < 0) continue;
        const cs=getComputedStyle(e); const r=e.getBoundingClientRect();
        if (r.width<1||r.height<1||cs.visibility==="hidden"||+cs.opacity<0.05) continue;
        if (r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth) { out.push({k:"OFFSCREEN", n:(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,40), c:String(e.className).split(" ")[0], box:[r.x|0,r.y|0,r.width|0,r.height|0]}); continue; }
        const cx=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)), cy=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2));
        const hit=document.elementFromPoint(cx,cy);
        if (hit && !e.contains(hit) && hit!==e && !e.parentElement?.contains(hit)) {
          out.push({k:"OCCLUDED", n:(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,40), c:String(e.className).split(" ")[0], by:String(hit.className).split(" ")[0]+"/"+hit.tagName});
        }
      }
      return out;
    });
    if (r.length) console.log(st, W+"x"+H, JSON.stringify(r).slice(0,600));
    await p.close();
  }
}
await b.close();
