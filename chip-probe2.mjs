import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const [state, vp] of [["dense",{width:1440,height:960}],["board",{width:1280,height:900}],["board",{width:768,height:1024}],["board",{width:390,height:844}]]) {
  const p = await b.newPage({ viewport: vp });
  await p.goto("file:///C:/Users/ethan/signal-studio-workspace/_wt-design-tasks/docs/design/labs/tasks-2026-08/floor.html?state=" + state);
  await p.waitForTimeout(700);
  const out = await p.evaluate(() => {
    const chips = [...document.querySelectorAll(".when")];
    const m = chips.find(c => c.dataset.t === "milestone");
    const first = chips[0];
    return {
      milestoneHTML: m ? m.innerHTML : null,
      cardW: first ? Math.round(first.closest(".card").getBoundingClientRect().width) : null,
      srStyle: (() => { const s = document.querySelector(".sr"); return s ? getComputedStyle(s).position + "/" + getComputedStyle(s).clip : null; })(),
      anySvgInChip: chips.some(c => c.querySelector("svg")),
    };
  });
  console.log(state, vp.width, JSON.stringify(out));
  await p.close();
}
await b.close();
