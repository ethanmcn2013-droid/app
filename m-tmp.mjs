import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(url);
await p.waitForTimeout(900);
// find route to spec sheet
const links = await p.$$eval("a,button", ns => ns.map(n => (n.textContent||"").trim() + " :: " + (n.getAttribute("href")||"") + " :: " + n.className).slice(0,60));
console.log(JSON.stringify(links, null, 1));
await b.close();
