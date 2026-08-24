import { chromium } from "@playwright/test";
const FILE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960} });
await p.goto(FILE); await p.waitForTimeout(600);

// full tab order
const order = [];
await p.evaluate(()=>document.body.focus());
for (let i=0;i<18;i++){
  await p.keyboard.press("Tab");
  order.push(await p.evaluate(()=>{ const a=document.activeElement; return (a.className||a.tagName)+" | "+(a.getAttribute("aria-label")||a.innerText||"").replace(/\n/g," ").slice(0,40); }));
}
console.log("TAB ORDER:\n" + order.map((x,i)=>` ${i+1}. ${x}`).join("\n"));

// manual pointer drag mid-flight inspection
const src = p.locator('.tray[data-lane="todo"] .card').first();
const box = await src.boundingBox();
const tgt = await p.locator('.tray[data-lane="review"] .trayBody').boundingBox();
await p.mouse.move(box.x+40, box.y+20);
await p.mouse.down();
await p.mouse.move(box.x+80, box.y+60, {steps:5});
await p.mouse.move(tgt.x+tgt.width/2, tgt.y+200, {steps:10});
await p.waitForTimeout(200);
const mid = await p.evaluate(()=>{
  const g = document.querySelector(".ghost, .cardGhost, [data-dragging]");
  return {
    draggingAttrs: [...document.querySelectorAll("[data-dragging],[aria-grabbed='true'],[data-over],[data-drop]")].map(n=>n.className+"::"+(n.dataset.over||n.dataset.drop||"grab")),
    ghost: g? {c:g.className, r:g.getBoundingClientRect().toJSON()} : null,
    srcCard: (()=>{const c=document.querySelector('.tray[data-lane="todo"] .card'); const s=getComputedStyle(c); return {op:s.opacity, tr:s.transform, vis:s.visibility, h:Math.round(c.getBoundingClientRect().height)};})(),
    placeholder: document.querySelectorAll(".slot, .placeholder, .dropline, .gap").length,
    reviewChildren: [...document.querySelector('.tray[data-lane="review"] .trayBody').children].map(n=>n.className),
    say: document.querySelector("#say").textContent,
    bodyCursor: getComputedStyle(document.body).cursor,
  };
});
console.log("MID-DRAG", JSON.stringify(mid,null,1));
await p.screenshot({path:".probe/middrag.png"});
await p.mouse.up(); await p.waitForTimeout(600);
console.log("AFTER DROP say:", await p.locator("#say").textContent());
await b.close();
