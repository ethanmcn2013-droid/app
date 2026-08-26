import { launch, open } from "./drive.mjs";
const b = await launch();
for (const st of ["tasks.board","notes.notebook","notes.seam","timeline.owner-flight","timeline.phone"]) {
  for (const W of [320,360]) {
    const p = await open(b, { state: st, width:W, height:800, touch:true });
    const r = await p.evaluate(()=>({ovf:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      wide:[...document.querySelectorAll("*")].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2&&r.width>0&&getComputedStyle(e).position!=="fixed";}).slice(0,4).map(e=>String(e.className).split(" ")[0]+":"+Math.round(e.getBoundingClientRect().right))}));
    console.log(st, W, JSON.stringify(r));
    await p.close();
  }
}
await b.close();
