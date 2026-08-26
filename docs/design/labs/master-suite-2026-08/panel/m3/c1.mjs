import { launch, open } from "./drive.mjs";
const b = await launch();
for (const [st,W,H] of [["tasks.board",1024,900],["notes.notebook",1024,900],["timeline.owner-flight",1024,900],["timeline.desk",1024,900],["notes.seam",1024,900],["tasks.dense",1024,900]]) {
  const p = await open(b, { state: st, width:W, height:H });
  await p.screenshot({path:`panel/m3/e-${st}-${W}.png`});
  await p.close();
}
await b.close();
