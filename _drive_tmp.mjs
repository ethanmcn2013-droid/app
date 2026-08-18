import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto("file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html?state=dense");
await p.waitForTimeout(900);
const chips = await p.$$eval(".when", ns => ns.map(n => ({ t: n.dataset.t, text: n.textContent, title: n.getAttribute("title"),
  css: (c=>({bg:c.background||c.backgroundColor, shadow:c.boxShadow, color:c.color, w:c.fontWeight}))(getComputedStyle(n)) })));
console.log(JSON.stringify(chips.filter(c=>c.t==="waiting"||c.t==="done"), null, 1));
await b.close();
