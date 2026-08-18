import { chromium } from "@playwright/test";
const url = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html";
const out = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/65811ab6-2fee-47bd-9af2-54dc9dff8360/scratchpad/";
const b = await chromium.launch();
for (const [state, name] of [["board","board"],["dense","dense"]]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
  await p.goto(url + "?state=" + state);
  await p.waitForTimeout(600);
  await p.click('[data-act="late"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + "filtered-" + name + ".png" });
  const info = await p.evaluate(() => ({
    headFacts: [...document.querySelectorAll(".headFacts > *")].map(e => e.textContent.trim()),
    trays: [...document.querySelectorAll(".tray")].map(t => ({
      name: t.querySelector(".trayName")?.textContent,
      count: t.querySelector(".trayCount")?.textContent,
      note: t.querySelector(".trayNote")?.textContent,
      empty: t.querySelector(".trayEmpty")?.textContent || null,
      cards: t.querySelectorAll(".card").length,
      ruleVisible: getComputedStyle(t).getPropertyValue("border-left") || getComputedStyle(t).boxShadow,
    })),
    foot: document.querySelector(".carry")?.innerText,
    say: document.querySelector("#say")?.textContent,
  }));
  console.log(state, JSON.stringify(info, null, 1));
  await p.close();
}
await b.close();
