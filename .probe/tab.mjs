import { chromium } from "@playwright/test";
import path from "node:path";
const F="file:///"+path.resolve("docs/design/labs/notes-2026-08/notebook.html").split("\\").join("/");
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1440,height:960}});
await p.goto(F); await p.waitForTimeout(300);
await p.locator('.verb[data-act="voice"]').first().click();
await p.waitForTimeout(300);
console.log("inert count:", await p.locator("[inert]").count());
console.log("focus:", await p.evaluate(()=>document.activeElement.tagName+" "+(document.activeElement.dataset?.act||document.activeElement.className)));
for (let i=0;i<4;i++){
  await p.keyboard.press("Tab"); await p.waitForTimeout(80);
  console.log(i, await p.evaluate(()=>{const a=document.activeElement; return a.tagName+" | "+(a.dataset?.act||a.className||"")+" | inDark="+Boolean(a.closest && a.closest(".dark"));}));
}
await b.close();
