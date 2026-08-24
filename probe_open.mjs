import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(url);
await p.waitForTimeout(900);
const info = await p.evaluate(() => [...document.querySelectorAll('.card[data-id]')].map(c => ({ id: c.dataset.id, exp: c.getAttribute('aria-expanded'), h: Math.round(c.getBoundingClientRect().height), t: (c.querySelector('.cardTitle')?.textContent||'').slice(0,26) })));
console.log(JSON.stringify(info));
await b.close();
