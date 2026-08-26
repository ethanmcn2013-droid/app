import { readFile } from "node:fs/promises";
const LAB="C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08";
const cssFiles=["foundation.css","shell.css","tasks.css","notes.css","timeline.css","across.css"];
const jsFiles=["app.js","tasks.js","notes.js","timeline.js","fixture.js","icons.js"];
let js=""; for(const f of jsFiles) js+=await readFile(LAB+"/src/"+f,"utf8");
let html=await readFile(LAB+"/master.html","utf8");
const hay=js+html;
const pairs=new Map();
for (const f of cssFiles) {
  const css=await readFile(LAB+"/src/"+f,"utf8");
  // strip comments
  const c=css.replace(/\/\*[\s\S]*?\*\//g,"");
  for (const m of c.matchAll(/\[(data-[a-z0-9-]+)(?:([~^$*|]?=)"([^"]*)")?\]/g)) {
    const key=m[1]+(m[3]!==undefined?'="'+m[3]+'"':"");
    if(!pairs.has(key)) pairs.set(key,new Set());
    pairs.get(key).add(f);
  }
}
const camel=(s)=>s.replace(/^data-/,"").replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const dead=[];
for (const [key,files] of pairs) {
  const m=key.match(/^(data-[a-z0-9-]+)(?:="(.*)")?$/);
  const attr=m[1], val=m[2];
  const attrOk = hay.includes(attr) || hay.includes("dataset."+camel(attr)) || hay.includes("."+camel(attr));
  let valOk = true;
  if (val!==undefined && val!=="") {
    valOk = new RegExp('["\'`>\s]'+val.replace(/[.*+?^${}()|[\]\]/g,"\$&")+'["\'`<\s]').test(hay) || hay.includes('"'+val+'"') || hay.includes("'"+val+"'") || hay.includes("`"+val+"`") || hay.includes(val);
  }
  if (!attrOk || !valOk) dead.push(key+"  ("+[...files].join(",")+")  attr:"+attrOk+" val:"+valOk);
}
console.log("data-* selector keys in CSS:", pairs.size);
console.log("never set anywhere in js/html:", dead.length);
dead.forEach(d=>console.log("  "+d));
