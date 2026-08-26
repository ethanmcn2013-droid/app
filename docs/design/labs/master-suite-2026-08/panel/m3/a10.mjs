import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
console.log(JSON.stringify(await p.evaluate(()=>{
  return {
    trayAdds: [...document.querySelectorAll(".trayAdd")].map(e=>({label:(e.getAttribute("aria-label")||e.textContent).trim(),ti:e.tabIndex})),
    cards: [...document.querySelectorAll("article.card")].map(e=>({t:(e.querySelector(".cardTitle,h3,.title")?.textContent||e.textContent).trim().slice(0,32),ti:e.tabIndex,role:e.getAttribute("role"),grab:e.getAttribute("aria-grabbed"),rd:e.getAttribute("aria-roledescription"),km:e.getAttribute("aria-keyshortcuts")})),
    ticks: [...document.querySelectorAll(".tick")].map(e=>({l:(e.getAttribute("aria-label")||"").slice(0,40),ti:e.tabIndex,role:e.getAttribute("role"),ck:e.getAttribute("aria-checked")})).slice(0,3),
    trays: [...document.querySelectorAll(".tray")].map(e=>({l:e.getAttribute("aria-label"),ti:e.tabIndex}))
  };
}),null,1));
await p.close(); await b.close();
