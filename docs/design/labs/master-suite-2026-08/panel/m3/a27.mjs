import { launch, open } from "./drive.mjs";
const b = await launch();
const states=["tasks.board","tasks.dense","notes.notebook","notes.seam","notes.voice","timeline.owner-flight","timeline.desk","timeline.phone"];
for (const st of states) {
  const p = await open(b, { state: st, width:1440, height:960 });
  const r = await p.evaluate(()=>{
    const out={nested:[],badRole:[],dupH1:0,noAlt:[],emptyBtn:[],ariaOnPresentational:[]};
    const int="a[href],button,input,select,textarea,[role=button],[role=checkbox],[role=link],[role=tab],[role=menuitem]";
    for (const e of document.querySelectorAll(int)) {
      if (e.closest("[inert]")) continue;
      const anc = e.parentElement?.closest(int);
      if (anc) out.nested.push(String(anc.className).split(" ")[0]+" > "+String(e.className).split(" ")[0]+" ("+(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,24)+")");
    }
    for (const e of document.querySelectorAll("a")) if (!e.hasAttribute("href") && !e.getAttribute("role") && !e.closest("[inert]")) out.badRole.push("a-no-href."+String(e.className).split(" ")[0]);
    out.dupH1 = [...document.querySelectorAll("h1")].filter(h=>!h.closest("[inert]")&&h.getBoundingClientRect().width>0).length;
    for (const e of document.querySelectorAll("img,svg")) { if(e.closest("[inert]"))continue; if(e.tagName==="IMG"&&!e.hasAttribute("alt")) out.noAlt.push("img"); if(e.tagName==="svg"&&!e.hasAttribute("aria-hidden")&&!e.getAttribute("role")&&!e.querySelector("title")) out.noAlt.push("svg-unmarked."+String(e.getAttribute("class")||"")); }
    // list semantics: role=list children
    for (const e of document.querySelectorAll("[role=tablist]")) {
      const kids=[...e.children].map(c=>c.getAttribute("role")||c.tagName);
      out.ariaOnPresentational.push("tablist kids: "+kids.join(","));
    }
    return out;
  });
  const trimmed = {nested:[...new Set(r.nested)].slice(0,6), badRole:[...new Set(r.badRole)].slice(0,4), dupH1:r.dupH1, noAlt:[...new Set(r.noAlt)].slice(0,5), tl:r.ariaOnPresentational};
  console.log(st, JSON.stringify(trimmed));
  await p.close();
}
await b.close();
