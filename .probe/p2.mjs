import { chromium } from "@playwright/test";
const FILE = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: {width:1440,height:960} });
await p.goto(FILE + "?state=loading");
await p.waitForTimeout(800);
const d = await p.evaluate(() => {
  const trays = [...document.querySelectorAll(".tray")];
  return {
    trayCount: trays.length,
    trays: trays.map(t => ({ lane: t.dataset.lane, cls: t.className, head: (t.querySelector(".trayHead")||{}).innerText, kids: t.querySelector(".trayBody") ? [...t.querySelector(".trayBody").children].map(n=>n.className) : null })),
    skel: [...document.querySelectorAll(".skel, .skelCard, [class*=skel], [class*=Skel]")].slice(0,4).map(n=>({c:n.className, an:getComputedStyle(n).animationName, h:Math.round(n.getBoundingClientRect().height), y:Math.round(n.getBoundingClientRect().y)})),
    aria: [...document.querySelectorAll("[aria-busy]")].map(n=>n.className+":"+n.getAttribute("aria-busy")),
    say: document.querySelector("#say").textContent,
    caption: [...document.querySelectorAll("*")].filter(n=>n.children.length===0 && /Opening the board/.test(n.textContent)).map(n=>({c:n.className, r:n.getBoundingClientRect()})),
  };
});
console.log(JSON.stringify(d,null,1));
await b.close();
