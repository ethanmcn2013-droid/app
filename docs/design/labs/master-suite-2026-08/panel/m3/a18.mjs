import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "notes.voice", width:1440, height:960 });
console.log(JSON.stringify(await p.evaluate(()=>{
  const dark=document.querySelector(".dark,.darkBody")?.closest("[role],[aria-modal]")||document.querySelector(".dark");
  const rail=document.querySelector(".rail");
  const info=e=>e?({cls:String(e.className).split(" ")[0],role:e.getAttribute("role"),modal:e.getAttribute("aria-modal"),label:e.getAttribute("aria-label"),inert:e.hasAttribute("inert"),ah:e.getAttribute("aria-hidden"),z:getComputedStyle(e).zIndex}):null;
  return {
    darkRoot: info(document.querySelector("[class*=dark]")),
    darks: [...document.querySelectorAll("[class^=dark],[class*=' dark']")].map(e=>String(e.className)).slice(0,10),
    rail: info(rail),
    railTiles: [...document.querySelectorAll(".railTile")].map(e=>({l:(e.getAttribute("aria-label")||"").slice(0,30),ti:e.tabIndex,inert:!!e.closest("[inert]"),ah:!!e.closest("[aria-hidden=true]")})),
    sheet: info(document.querySelector("main.sheet")),
    dock: info(document.querySelector(".dock")),
    bodyOverflow: getComputedStyle(document.body).overflow,
  };
}),null,1));
await p.close(); await b.close();
