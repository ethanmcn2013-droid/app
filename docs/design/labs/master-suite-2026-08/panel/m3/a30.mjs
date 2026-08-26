import { chromium } from "@playwright/test";
import path from "node:path"; import { pathToFileURL } from "node:url";
const LAB="C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08";
const M=pathToFileURL(path.join(LAB,"_gate-suite.html")).href;
const b=await chromium.launch();
function lum(c){const [r,g,bb]=c;const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(r)+0.7152*f(g)+0.0722*f(bb);}
for (const v of ["paper","ink"]) for (const st of ["timeline.owner-flight","timeline.desk","timeline.phone"]) {
  const ctx=await b.newContext({viewport:{width:1440,height:960}});
  const p=await ctx.newPage();
  const u=new URL(M); u.searchParams.set("state",st); u.searchParams.set("v",v);
  await p.goto(u.href,{waitUntil:"load"}); await p.evaluate(()=>document.fonts?.ready); await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{
    const palette=["#111111","#4f46e5","#ffffff","#4338ca"];
    const seen={};
    const off=[];
    for(const e of document.querySelectorAll("*")){ if(e.closest("[inert]"))continue; const cs=getComputedStyle(e);
      for (const prop of ["color","backgroundColor","borderTopColor","borderBottomColor","outlineColor","fill","stroke"]) {
        const val=cs[prop]; if(!val||val==="none"||/rgba\(0, 0, 0, 0\)/.test(val))continue;
        const m=val.match(/rgba?\((\d+), (\d+), (\d+)/); if(!m)continue;
        const [r,g,bb]=[+m[1],+m[2],+m[3]];
        // must be a tint of one of the four (grey axis = ink/white; indigo axis)
        const isGrey = r===g&&g===bb;
        const isIndigo = (r===79&&g===70&&bb===229)||(r===67&&g===56&&bb===202);
        if(!isGrey&&!isIndigo){ off.push(prop+":"+val+" @"+String(e.className).split(" ")[0]); }
      }
    }
    return {off:[...new Set(off)].slice(0,8), bodyBg:getComputedStyle(document.body).backgroundColor, floorBg:getComputedStyle(document.querySelector(".floor")||document.body).backgroundColor};
  });
  console.log(v, st, JSON.stringify(r).slice(0,500));
  await ctx.close();
}
await b.close();
