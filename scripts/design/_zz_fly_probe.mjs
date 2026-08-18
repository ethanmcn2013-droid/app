import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960} });
await p.goto(url); await p.waitForTimeout(700);
await p.evaluate(() => {
  window.__log = [];
  const root = document.getElementById("root") || document.getElementById("deck");
  new MutationObserver(ms => ms.forEach(m => {
    if (m.type === "attributes" && (m.attributeName === "data-flying" || m.attributeName === "data-just-done" || m.attributeName === "data-changed"))
      window.__log.push(m.attributeName + " " + (m.target.dataset.id||m.target.className) + " " + (m.target.hasAttribute(m.attributeName)?"ON":"OFF"));
  })).observe(root, { attributes:true, subtree:true, attributeFilter:["data-flying","data-just-done","data-changed"] });
  // also patch flyCompleted visibility
});
const first = p.locator('.tray[data-lane]:not([data-lane="done"]) .card').first();
const id = await first.getAttribute("data-id");
await first.locator(".tick").click();
await p.waitForTimeout(900);
console.log("FORWARD log:", await p.evaluate(()=>window.__log.slice()));
await p.evaluate(()=>window.__log=[]);
await p.locator('.carry [data-act="undo"]').click();
await p.waitForTimeout(900);
console.log("UNDO log:", await p.evaluate(()=>window.__log.slice()));
await b.close();
