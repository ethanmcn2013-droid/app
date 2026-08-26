import { launch, open } from "./drive.mjs";
const b = await launch();
for (const v of ["paper","ink"]) {
  const p = await open(b, { state:"timeline.owner-flight", v, width:1440, height:960 });
  await p.screenshot({path:`panel/m3/tl-${v}.png`});
  await p.close();
}
// orientation
for (const layout of ["across","down"]) {
  const p = await open(b, { state:"timeline.owner-flight", layout, width:1440, height:960 });
  await p.screenshot({path:`panel/m3/tl-${layout}.png`});
  await p.close();
}
await b.close();
