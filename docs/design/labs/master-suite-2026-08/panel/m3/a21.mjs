import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "tasks.board", width:1440, height:960 });
console.log(JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll(".rail [data-rail], .railTile, .railAvatar, .railAdd")].map(e=>({
  rail:e.dataset.rail, cls:String(e.className).split(" ")[0], label:e.getAttribute("aria-label"), title:e.getAttribute("title"), dis:e.disabled, ad:e.getAttribute("aria-disabled"), cur:e.getAttribute("aria-current"), ti:e.tabIndex, desc:e.getAttribute("aria-describedby"),
  descTxt: (()=>{const d=e.getAttribute("aria-describedby"); return d? d.split(/\s+/).map(i=>document.getElementById(i)?.textContent?.trim()).join(" / ") : null})()
}))),null,1));
await p.close();
// click an honest door
const p2 = await open(b, { state: "tasks.board", width:1440, height:960 });
await p2.evaluate(()=>{window.__ann=[];for(const t of document.querySelectorAll("[aria-live],[role=status]"))new MutationObserver(()=>window.__ann.push((t.textContent||"").trim().slice(0,160))).observe(t,{childList:true,subtree:true,characterData:true});});
for (const sel of ['[data-rail="home"]','[data-rail="inbox"]','[data-rail="help"]','.railAvatar']) {
  const n = await p2.locator(sel).count(); if(!n) { console.log(sel,"absent"); continue; }
  await p2.locator(sel).first().click({force:true}); await p2.waitForTimeout(400);
  console.log(sel, JSON.stringify(await p2.evaluate(()=>{const x=window.__ann;window.__ann=[];return x;})), "| visible dialog:", await p2.evaluate(()=>{const d=document.querySelector("[role=dialog],.doorSheet,.notYet,[class*=door]"); return d?String(d.className)+" :: "+(d.textContent||"").trim().slice(0,160):null;}));
  await p2.keyboard.press("Escape"); await p2.waitForTimeout(200);
}
await p2.close();
await b.close();
