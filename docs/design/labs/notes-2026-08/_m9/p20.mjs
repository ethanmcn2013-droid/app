import { chromium } from "@playwright/test";
const BASE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
for (const vp of [{width:1280,height:800},{width:1440,height:900},{width:1920,height:1080}]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto(BASE + "?state=notebook"); await p.waitForTimeout(500);
  // open a medium note then peel
  await p.locator(".idxRow").nth(4).click(); await p.waitForTimeout(400);
  await p.locator(".sent").first().click(); await p.waitForTimeout(200);
  await p.locator('[data-act="peel"]').click().catch(()=>p.keyboard.press("Enter")); await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    const i=document.querySelector("#index"); const d=document.querySelector(".dock");
    const rows=[...document.querySelectorAll(".idxRow")];
    const dr=d.getBoundingClientRect(); const ir=i.getBoundingClientRect();
    const vis=rows.filter(e=>{const bb=e.getBoundingClientRect(); return bb.top<dr.top-2 && bb.bottom>ir.top+2;}).length;
    return {idxTop:Math.round(ir.top), idxH:Math.round(ir.height), content:Math.round(ir.height-parseFloat(getComputedStyle(i).paddingBottom)), visRows:vis, rows:rows.length, peel:!!document.querySelector(".peel")};
  });
  console.log(vp.width+"x"+vp.height, JSON.stringify(r));
  await p.close();
}
await b.close();
