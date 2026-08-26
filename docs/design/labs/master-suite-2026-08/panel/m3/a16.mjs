import { launch, open } from "./drive.mjs";
const b = await launch();
const states=["tasks.board","tasks.dense","notes.notebook","notes.seam","notes.voice","timeline.owner-flight","timeline.desk","timeline.phone"];
for (const st of states) {
  for (const [W,H] of [[390,844],[720,900],[768,1024],[1000,900],[1100,900],[1279,900],[1280,900],[1440,960],[1920,1000]]) {
    const p = await open(b, { state: st, width:W, height:H });
    const r = await p.evaluate(()=>{
      const bad=[];
      // interactive elements overlapping each other
      const els=[...document.querySelectorAll("button,a[href],[role=button],[role=checkbox],input,textarea,[tabindex='0']")].filter(e=>{const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&cs.visibility!=="hidden"&&+cs.opacity>0.05;});
      for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
        const a=els[i].getBoundingClientRect(),c=els[j].getBoundingClientRect();
        if(els[i].contains(els[j])||els[j].contains(els[i]))continue;
        const ox=Math.min(a.right,c.right)-Math.max(a.left,c.left), oy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
        if(ox>4&&oy>4){
          // is the top one actually covering?
          const cx=Math.max(a.left,c.left)+ox/2, cy=Math.max(a.top,c.top)+oy/2;
          const hitEl=document.elementFromPoint(cx,cy);
          if(hitEl && !els[i].contains(hitEl) && !els[j].contains(hitEl)) continue;
          bad.push("OVERLAP "+String(els[i].className).split(" ")[0]+" x "+String(els[j].className).split(" ")[0]+" "+Math.round(ox)+"x"+Math.round(oy));
        }
      }
      // element boxes extending past the visible sheet
      const out=[];
      for(const e of document.querySelectorAll(".sheet, .floor")){ }
      return {bad:[...new Set(bad)].slice(0,6)};
    });
    if (r.bad.length) console.log(st, W+"x"+H, JSON.stringify(r.bad));
    await p.close();
  }
}
await b.close();
