import { launch, open } from "./drive.mjs";
const b = await launch();
for (const st of ["tasks.board","tasks.dense"]) {
  const p = await open(b, { state: st, width:1440, height:960 });
  console.log(st, JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll(".tray")].map(t=>({lane:t.getAttribute("aria-label"),cards:t.querySelectorAll("article.card").length,addTi:t.querySelector(".trayAdd")?.tabIndex})))));
  await p.close();
}
await b.close();
