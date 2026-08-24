import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(url);
await p.waitForTimeout(900);

const targets = ["demo-t-01","demo-t-04","demo-t-02","demo-t-05"];
for (const id of targets) {
  const before = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.card[data-id]')].map(c=>[c.dataset.id,[Math.round(c.getBoundingClientRect().top),Math.round(c.getBoundingClientRect().height)]])));
  const box = await p.locator(`.card[data-id="${id}"] .cardTitle`).boundingBox();
  // real pointer travel
  await p.mouse.move(box.x+10, box.y+box.height/2);
  await p.mouse.down();
  await p.mouse.move(box.x+12, box.y+box.height/2+1, {steps:3});
  await p.mouse.up();
  await p.waitForTimeout(30);
  const mid = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.card[data-id]')].map(c=>[c.dataset.id,[Math.round(c.getBoundingClientRect().top),Math.round(c.getBoundingClientRect().height), getComputedStyle(c).transform, getComputedStyle(c).transitionProperty]])));
  const open = await p.evaluate(()=>document.querySelector('.card[data-open]')?.dataset.id||null);
  console.log("=== opened", id, "openAttr:", open);
  for (const k of Object.keys(before)) {
    const a=before[k], c=mid[k];
    if (!c) continue;
    if (a[0]!==c[0]||a[1]!==c[1]) console.log("  ",k,"top",a[0],"->",c[0],"h",a[1],"->",c[1],"| transform:",c[2],"| trans:",c[3]);
  }
  // close again
  await p.mouse.move(box.x+10, box.y+8);
  await p.mouse.down(); await p.mouse.move(box.x+11,box.y+9,{steps:2}); await p.mouse.up();
  await p.waitForTimeout(60);
}
await b.close();
