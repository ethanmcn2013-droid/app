import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
for (const vp of [{width:1440,height:960},{width:390,height:844}]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto(url);
  await p.waitForTimeout(400);
  const info = await p.evaluate(() => {
    const lanes = [...document.querySelectorAll('.tray[data-lane]')].map(t=>({lane:t.dataset.lane, box:t.getBoundingClientRect().toJSON()}));
    const board = document.querySelector('.board');
    const cards = [...document.querySelectorAll('.tray[data-lane="todo"] .card')].map(c=>({id:c.dataset.id, box:c.getBoundingClientRect().toJSON()}));
    return {lanes, cards, boardScroll:{sw:board.scrollWidth, cw:board.clientWidth, left:board.scrollLeft}};
  });
  console.log("VP", vp.width, JSON.stringify(info.boardScroll));
  info.lanes.forEach(l=>console.log("  lane", l.lane, "x=", Math.round(l.box.x), "w=", Math.round(l.box.width)));
  const first = info.cards[0];
  console.log("  first todo card", first.id, "x=", Math.round(first.box.x), "y=", Math.round(first.box.y));
  // click its tick
  const tick = p.locator(`.card[data-id="${first.id}"] [data-act="tick"]`);
  await tick.click();
  await p.waitForTimeout(30);
  const after = await p.evaluate((id)=>{
    const n = document.querySelector(`.card[data-id="${id}"]`);
    if(!n) return {gone:true, say:document.getElementById('say')?.textContent};
    const board=document.querySelector('.board');
    return {box:n.getBoundingClientRect().toJSON(), settling:n.hasAttribute('data-settling'), inView: n.getBoundingClientRect().x < board.getBoundingClientRect().right && n.getBoundingClientRect().right>board.getBoundingClientRect().left, say:document.getElementById('say')?.textContent, scrollLeft:board.scrollLeft, active:document.activeElement.className};
  }, first.id);
  console.log("  AFTER tick:", JSON.stringify(after));
  await p.waitForTimeout(400);
  const later = await p.evaluate((id)=>{const n=document.querySelector(`.card[data-id="${id}"]`); return {settling:n?.hasAttribute('data-settling')};}, first.id);
  console.log("  400ms later:", JSON.stringify(later));
  await p.close();
}
await b.close();
