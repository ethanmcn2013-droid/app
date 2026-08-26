import { chromium } from "@playwright/test";
const U = "file:///C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html";
const b = await chromium.launch();
for (const st of ["notes.notebook","tasks.board"]) {
  const p = await b.newPage({ viewport:{width:1440,height:960} });
  await p.goto(U + "?v=paper&state=" + st);
  await p.waitForTimeout(500);
  await p.evaluate(()=>document.body.focus());
  const seen=[];
  for (let i=0;i<80;i++){
    await p.keyboard.press("Tab");
    const d = await p.evaluate(()=>{const a=document.activeElement; if(!a)return null; return {cls:a.className&&a.className.toString().slice(0,40), tag:a.tagName, lab:a.getAttribute&&a.getAttribute("aria-label"), txt:(a.textContent||"").trim().slice(0,25)};});
    if(!d) break;
    seen.push(d);
    if (seen.length>2 && d.cls===seen[0].cls && d.txt===seen[0].txt) break;
  }
  console.log("=== "+st);
  seen.forEach((d,i)=>console.log(i, d.tag, d.cls, "|", d.lab, "|", d.txt));
  // rail arrow reachability of railAvatar
  console.log("railAvatar tabindex:", await p.evaluate(()=>document.querySelector(".railAvatar").tabIndex));
  await p.close();
}
await b.close();
