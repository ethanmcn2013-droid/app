import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
const read = async (tag) => {
  const r = await p.evaluate(() => [...document.querySelectorAll(".late, .undated")].map((e) => {
    const cs = getComputedStyle(e);
    return {
      txt: (e.textContent || "").replace(/\s+/g, " ").trim(),
      pressed: e.getAttribute("aria-pressed"),
      label: e.getAttribute("aria-label"),
      bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight,
      border: cs.borderTopWidth + " " + cs.borderTopColor,
      shadow: cs.boxShadow.slice(0, 50),
      hasX: !!e.querySelector("svg,i,span[class*=x]"),
      w: Math.round(e.getBoundingClientRect().width),
    };
  }));
  console.log(tag);
  for (const x of r) console.log("   " + JSON.stringify(x));
};
await read("UNFILTERED");
await p.locator(".late").nth(0).click();
await p.waitForTimeout(500);
await read("AFTER pressing '1 today'");
await p.locator(".late").nth(0).click();
await p.waitForTimeout(500);
await p.locator(".late").nth(1).click();
await p.waitForTimeout(500);
await read("AFTER pressing '1 overdue'");
await p.close();
await b.close();
