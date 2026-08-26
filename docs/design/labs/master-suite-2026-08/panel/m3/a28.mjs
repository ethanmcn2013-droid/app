import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
console.log(JSON.stringify(await p.evaluate(()=>({
  tabs: [...document.querySelectorAll("[role=tab]")].map(e=>({n:(e.getAttribute("aria-label")||e.textContent).trim().slice(0,30),sel:e.getAttribute("aria-selected"),ctrl:e.getAttribute("aria-controls"),ctrlExists:!!document.getElementById(e.getAttribute("aria-controls")||"__"),ti:e.tabIndex,ad:e.getAttribute("aria-disabled"),title:e.getAttribute("title")})),
  panels: [...document.querySelectorAll("[role=tabpanel]")].map(e=>({id:e.id,lab:e.getAttribute("aria-labelledby")})),
  tablist: (()=>{const t=document.querySelector("[role=tablist]");return {label:t.getAttribute("aria-label"),orient:t.getAttribute("aria-orientation")};})()
})),null,1));
// arrow keys within tablist
await p.locator("[role=tab][aria-selected='true']").focus();
for (const k of ["ArrowRight","ArrowRight","ArrowRight","ArrowRight"]) { await p.keyboard.press(k); await p.waitForTimeout(120);
  console.log(k, await p.evaluate(()=>String(document.activeElement.className).split(" ")[0]+"|"+(document.activeElement.textContent||"").trim().slice(0,20)+"|sel="+document.activeElement.getAttribute("aria-selected"))); }
await p.close(); await b.close();
