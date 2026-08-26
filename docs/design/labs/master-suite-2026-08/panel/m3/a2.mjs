import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "notes.notebook" });
console.log(JSON.stringify(await p.evaluate(() => {
  const out = {};
  out.products = [...document.querySelectorAll("[data-product],.prod,#tasks,#notes,#tl")].map(el=>({id:el.id,cls:String(el.className).slice(0,40),display:getComputedStyle(el).display,hidden:el.hasAttribute("hidden"),inert:el.hasAttribute("inert"),ah:el.getAttribute("aria-hidden"),vis:getComputedStyle(el).visibility}));
  const t = document.querySelector("main.sheet:not(:first-of-type)");
  out.bedit = !!document.getElementById("b-edit");
  // walk each main
  out.mains = [...document.querySelectorAll("main")].map(el=>{
    let n=el, chain=[];
    while(n && n!==document.documentElement){ const cs=getComputedStyle(n); chain.push(`${n.tagName.toLowerCase()}${n.id?"#"+n.id:""}.${String(n.className).split(" ")[0]}|d:${cs.display}|v:${cs.visibility}|inert:${n.hasAttribute("inert")}|ah:${n.getAttribute("aria-hidden")}`); n=n.parentElement; }
    return chain;
  });
  return out;
}), null, 1));
await p.close();
await b.close();
