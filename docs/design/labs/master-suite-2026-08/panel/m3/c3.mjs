import { launch, open } from "./drive.mjs";
const b = await launch();
for (const st of ["tasks.board","notes.notebook","notes.seam","timeline.phone","timeline.owner-flight"]) {
  const p = await open(b, { state: st, width:390, height:844, touch:true });
  await p.screenshot({path:`panel/m3/p-${st}.png`, fullPage:false});
  await p.close();
}
await b.close();
