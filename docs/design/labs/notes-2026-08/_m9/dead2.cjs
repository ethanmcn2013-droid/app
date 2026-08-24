const fs=require("fs");
const D="C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/";
const css=fs.readFileSync(D+"master.css","utf8");
const js=fs.readFileSync(D+"notebook.js","utf8")+fs.readFileSync(D+"data.js","utf8")+fs.readFileSync(D+"icons.js","utf8");
const stripped=css.replace(/\/\*[\s\S]*?\*\//g,"");
const cls=new Set();
for(const m of stripped.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) cls.add(m[1]);
const dead=[...cls].filter(c=>!js.includes(c));
console.log("never appears in js:", dead.join(" ") || "(none)");
for (const a of ["off","paper","index","radius","indigo","type"]) {
  console.log("data-"+a, "in js:", js.includes("data-"+a), "| css lines:", stripped.split("\n").map((l,i)=>l.includes("[data-"+a)?i+1:0).filter(Boolean).slice(0,6));
}
