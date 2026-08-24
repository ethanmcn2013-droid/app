import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto("file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html");
await p.waitForTimeout(600);
// open specimen sheet
const btns = await p.$$eval("[data-act]", els => els.map(e => e.dataset.act + " | " + (e.textContent||"").trim().slice(0,30)));
console.log([...new Set(btns)].join("\n"));
await b.close();
