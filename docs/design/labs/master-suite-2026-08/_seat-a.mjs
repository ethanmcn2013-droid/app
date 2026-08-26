import { open, browser } from "./_seat-drive.mjs";
const SP = "C:/Users/ethan/AppData/Local/Temp/claude/C--Users-ethan/7c0de329-febd-4a7e-ab6a-74379c009573/scratchpad/";
const p = await open("tasks.board", { w: 1440, h: 960 });
await p.locator("button, [role=button]", { hasText: /^Planning$/ }).first().click();
await p.waitForTimeout(500);
// focus first card
await p.evaluate(() => document.querySelector(".board article, .board .card").focus());
for (let i = 0; i < 6; i++) {
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(120);
  const a = await p.evaluate(() => {
    const el = document.activeElement; const r = el.getBoundingClientRect();
    const dr = [...document.querySelectorAll("aside,section,div")].find(e => /^PLANNING/.test(e.innerText || ""));
    const d = dr.getBoundingClientRect();
    return { txt: (el.innerText||"").split("\n")[0].slice(0,44), x: Math.round(r.x), occluded: r.left < d.right && r.right > d.left };
  });
  console.log("ArrowRight", i, JSON.stringify(a));
}
await p.screenshot({ path: SP + "planning-rover.png" });
await p.close();
await browser.close();
