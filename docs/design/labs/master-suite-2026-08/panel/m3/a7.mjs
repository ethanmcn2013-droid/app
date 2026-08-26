import { launch, open } from "./drive.mjs";
const b = await launch();
const p = await open(b, { state: "notes.seam" });
await p.evaluate(() => { window.__ann=[]; for (const t of document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")) new MutationObserver(()=>window.__ann.push({s:t.className,t:(t.textContent||"").trim().slice(0,140)})).observe(t,{childList:true,subtree:true,characterData:true}); });
const dump = async(tag)=>{const a=await p.evaluate(()=>{const x=window.__ann;window.__ann=[];return x;}); console.log(tag,"ANN",JSON.stringify(a));};
const act = async(tag)=>console.log(tag,"ACT",await p.evaluate(()=>document.activeElement?document.activeElement.tagName+"."+String(document.activeElement.className).split(" ")[0]+" :: "+(document.activeElement.getAttribute("aria-label")||document.activeElement.textContent||"").trim().slice(0,60):null));
console.log("send btn", await p.locator('[data-act="send"]').count());
await p.locator('[data-act="send"]').first().click();
await p.waitForTimeout(700);
await dump("sent"); await act("sent");
console.log(JSON.stringify(await p.evaluate(()=>({
  visibleProduct: [...document.querySelectorAll("[data-rail]")].map(r=>({r:r.dataset.rail,cur:r.getAttribute("aria-current"),sel:r.getAttribute("aria-selected"),press:r.getAttribute("aria-pressed")})),
  toast: [...document.querySelectorAll(".n-sent,.n-toast,.n-landed,[class*=sent]")].map(e=>({c:e.className,t:(e.textContent||"").trim().slice(0,120),d:getComputedStyle(e).display})),
  bodyTxt: (document.querySelector(".seam,.n-seam")?.textContent||"").trim().slice(0,200)
})),null,1));
await p.screenshot({path:"panel/m3/after-send.png"});
await p.close(); await b.close();
