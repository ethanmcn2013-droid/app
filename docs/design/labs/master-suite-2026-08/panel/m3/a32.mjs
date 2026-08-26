import { launch, open } from "./drive.mjs";
const b = await launch();
for (const st of ["tasks.board","notes.notebook","timeline.owner-flight","timeline.desk","timeline.phone"]) {
  for (const [W,H] of [[390,844],[720,900],[1440,960]]) {
    const p = await open(b, { state: st, width:W, height:H, touch:W<=480 });
    const r = await p.evaluate(()=>{
      const docks=[...document.querySelectorAll(".dock,[class*=dock]")].filter(e=>!e.closest("[inert]")).map(e=>{const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return {c:String(e.className).split(" ")[0],d:cs.display,box:[r.x|0,r.y|0,r.width|0,r.height|0]};}).filter(x=>x.d!=="none"&&x.box[2]>0);
      return docks.slice(0,6);
    });
    console.log(st, W, JSON.stringify(r));
    await p.close();
  }
}
await b.close();
