import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:960} });
await p.goto(url); await p.waitForTimeout(600);
const counts = () => p.evaluate(() => {
  const o={}; document.querySelectorAll(".tray[data-lane]").forEach(t=>o[t.dataset.lane]=t.querySelectorAll(".card").length); return o; });
console.log("before", await counts());
// complete first card in first lane
const first = p.locator('.tray[data-lane]:not([data-lane="done"]) .card').first();
const id = await first.getAttribute("data-id");
console.log("id", id);
await first.locator(".tick").click();
// sample forward flight
let fwd=[];
for(let i=0;i<8;i++){ fwd.push(await p.evaluate(x=>{const n=document.querySelector('.card[data-id="'+x+'"]');return n? (n.hasAttribute("data-flying")?"FLY":"-")+"|"+(n.style.transform||getComputedStyle(n).transform):"none";}, id)); await p.waitForTimeout(40); }
console.log("forward:", fwd.join("\n  "));
await p.waitForTimeout(500);
console.log("after done", await counts(), "say:", await p.evaluate(()=>document.getElementById("say")?.textContent));
// now undo
await p.locator('.carry [data-act="undo"]').click();
let back=[];
for(let i=0;i<8;i++){ back.push(await p.evaluate(x=>{const n=document.querySelector('.card[data-id="'+x+'"]');return n? (n.hasAttribute("data-flying")?"FLY":"-")+"|"+(n.style.transform||getComputedStyle(n).transform)+"|"+(n.hasAttribute("data-just-done")?"JD":""):"none";}, id)); await p.waitForTimeout(40); }
console.log("undo:", back.join("\n  "));
console.log("after undo", await counts(), "say:", await p.evaluate(()=>document.getElementById("say")?.textContent));
// double completion + double ctrl+z
const cards = p.locator('.tray[data-lane]:not([data-lane="done"]) .card');
await cards.nth(0).locator(".tick").click(); await p.waitForTimeout(450);
await cards.nth(0).locator(".tick").click(); await p.waitForTimeout(450);
console.log("after 2 done", await counts());
await p.keyboard.press("Control+z"); await p.waitForTimeout(450);
console.log("after z1", await counts(), "say:", await p.evaluate(()=>document.getElementById("say")?.textContent));
await p.keyboard.press("Control+z"); await p.waitForTimeout(450);
console.log("after z2", await counts(), "say:", await p.evaluate(()=>document.getElementById("say")?.textContent));
// stale offer after 6s
await cards.nth(0).locator(".tick").click(); await p.waitForTimeout(6500);
console.log("carry after 6s:", await p.locator(".carry").count(), "say:", await p.evaluate(()=>document.getElementById("say")?.textContent));
await b.close();
