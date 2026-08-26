import { chromium } from "@playwright/test";
import path from "node:path"; import { pathToFileURL } from "node:url";
const LAB="C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08";
const M=pathToFileURL(path.join(LAB,"_gate-suite.html")).href;
const b=await chromium.launch();
for (const rm of ["reduce","no-preference"]) {
  const ctx=await b.newContext({viewport:{width:1440,height:960},reducedMotion:rm});
  const p=await ctx.newPage();
  const u=new URL(M); u.searchParams.set("state","tasks.board"); u.searchParams.set("v","paper");
  await p.goto(u.href,{waitUntil:"load"}); await p.evaluate(()=>document.fonts?.ready); await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{
    const out={anim:0,trans:0,samples:[]};
    for(const e of document.querySelectorAll("*")){ if(e.closest("[inert]"))continue; const cs=getComputedStyle(e);
      const d=parseFloat(cs.transitionDuration)||0, ad=parseFloat(cs.animationDuration)||0;
      if(d>0.001){out.trans++; if(out.samples.length<6&&d>0.05)out.samples.push("T "+String(e.className).split(" ")[0]+" "+cs.transitionDuration+" "+cs.transitionProperty.slice(0,40));}
      if(ad>0.001){out.anim++; if(out.samples.length<10)out.samples.push("A "+String(e.className).split(" ")[0]+" "+cs.animationDuration+" "+cs.animationName);}
    }
    return out;
  });
  console.log(rm, JSON.stringify(r).slice(0,900));
  await ctx.close();
}
await b.close();
