import { chromium } from "@playwright/test";
const URL = "file://C:/Users/ethan/signal-studio-workspace/_wt-master-suite/docs/design/labs/master-suite-2026-08/_gate-suite.html?v=paper&state=tasks.board";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto(URL); await p.waitForTimeout(900);
const lanes = async ()=>p.evaluate(()=>[...document.querySelectorAll('.laneName, .laneTitle, [class*=lane] h3, [class*=lane] h2')].map(n=>n.textContent.replace(/\s+/g,' ').trim()).slice(0,12));
console.log('probe', JSON.stringify(await lanes()));
console.log('lane classes', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('[class*=lane], [class*=Lane]')].slice(0,14).map(n=>n.className+' :: '+n.textContent.replace(/\s+/g,' ').trim().slice(0,50)))));
await b.close();
