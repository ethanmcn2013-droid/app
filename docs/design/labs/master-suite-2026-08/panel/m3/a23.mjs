import { launch, open } from "./drive.mjs";
const b = await launch();
const states=["tasks.board","tasks.dense","notes.notebook","notes.seam","timeline.owner-flight","timeline.desk"];
for (const st of states) {
  const p = await open(b, { state: st, width:1440, height:960 });
  // walk tab stops, focus each, measure ring vs clipping ancestors
  const out = [];
  for (let i=0;i<40;i++){
    await p.keyboard.press("Tab");
    const r = await p.evaluate(()=>{
      const a=document.activeElement; if(!a||a===document.body) return null;
      const cs=getComputedStyle(a); const rect=a.getBoundingClientRect();
      const ow=parseFloat(cs.outlineWidth)||0, oo=parseFloat(cs.outlineOffset)||0;
      // ring outer box
      let grow = ow+Math.max(0,oo);
      // also box-shadow spread rings
      const sh=cs.boxShadow;
      const m=[...sh.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map(x=>+x[1]);
      let shGrow=0;
      if (/rgb/.test(sh)) { /* crude: look for 0 0 0 Npx patterns */ const mm=sh.match(/0px 0px 0px (\d+(?:\.\d+)?)px/); if(mm) shGrow=+mm[1]; }
      grow=Math.max(grow, shGrow);
      const outer={l:rect.left-grow,t:rect.top-grow,r:rect.right+grow,b:rect.bottom+grow};
      // nearest clipping ancestor
      let n=a.parentElement, clipped=null;
      while(n){ const c=getComputedStyle(n);
        if(["hidden","auto","scroll","clip"].includes(c.overflow)||["hidden","auto","scroll","clip"].includes(c.overflowX)||["hidden","auto","scroll","clip"].includes(c.overflowY)){
          const cr=n.getBoundingClientRect();
          const cut = Math.max(0, cr.left-outer.l)+Math.max(0,outer.r-cr.right)+Math.max(0,cr.top-outer.t)+Math.max(0,outer.b-cr.bottom);
          if(cut>0.6){ clipped={by:String(n.className).split(" ")[0]||n.tagName, cut:Math.round(cut*10)/10, ov:c.overflow+"/"+c.overflowX+"/"+c.overflowY}; break; }
        }
        n=n.parentElement; }
      return {n:(a.getAttribute("aria-label")||a.textContent||"").trim().replace(/\s+/g," ").slice(0,36), c:String(a.className).split(" ")[0], ow, oo, grow, clipped, outline:cs.outline, shadow: cs.boxShadow.slice(0,60)};
    });
    if (!r) break;
    if (r.clipped) out.push(r);
    if (out.length>6) break;
  }
  console.log("=== "+st); out.forEach(o=>console.log("  ", JSON.stringify(o)));
  await p.close();
}
await b.close();
