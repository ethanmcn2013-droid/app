import { chromium } from "@playwright/test";
const FILE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
{ // loading animation + does it ever resolve
  const p = await b.newPage({ viewport:{width:1440,height:960} });
  await p.goto(FILE + "?state=loading"); await p.waitForTimeout(600);
  const anim = await p.evaluate(()=>{
    const c = document.querySelector(".loadCard");
    return [c, ...c.querySelectorAll("*")].map(n=>({c:n.className, an:getComputedStyle(n).animationName, dur:getComputedStyle(n).animationDuration, op:getComputedStyle(n).opacity}));
  });
  console.log("LOAD ANIM", JSON.stringify(anim));
  await p.waitForTimeout(4000);
  const still = await p.evaluate(()=>({load:document.querySelectorAll(".loadCard").length, cards:document.querySelectorAll(".board .card").length}));
  console.log("AFTER 5s", JSON.stringify(still));
  await p.close();
}
{ // hover reveal: dots at rest vs hover, reflow
  const p = await b.newPage({ viewport:{width:1440,height:960} });
  await p.goto(FILE); await p.waitForTimeout(600);
  const card = p.locator('.tray[data-lane="todo"] .card').first();
  const measure = async (label) => await p.evaluate(()=>{
    const c = document.querySelector('.tray[data-lane="todo"] .card');
    const d = c.querySelector(".cardDots"); const t = c.querySelector(".cardTitle");
    const w = c.querySelector(".when");
    return { dotsOp: d?getComputedStyle(d).opacity:null, dotsVis: d?getComputedStyle(d).visibility:null,
      dotsRect: d?JSON.stringify(d.getBoundingClientRect().toJSON()):null,
      titleRect: JSON.stringify(t.getBoundingClientRect().toJSON()),
      cardRect: JSON.stringify(c.getBoundingClientRect().toJSON()),
      whenOp: w?getComputedStyle(w).opacity:null };
  });
  console.log("REST", JSON.stringify(await measure(), null, 1));
  await card.hover(); await p.waitForTimeout(350);
  console.log("HOVER", JSON.stringify(await measure(), null, 1));
  await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
  // focus the card via JS
  await p.evaluate(()=>document.querySelector('.tray[data-lane="todo"] .card').focus());
  await p.mouse.move(10,10); await p.waitForTimeout(300);
  console.log("FOCUS-NO-POINTER", JSON.stringify(await measure(), null, 1));
  await p.close();
}
await b.close();
