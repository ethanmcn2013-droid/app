import { chromium } from "@playwright/test";
const URL = "file:///C:/Users/ethan/signal-studio-workspace/_wt-design-notes/docs/design/labs/notes-2026-08/notebook.html";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });

// ---- desk settle ----
await p.goto(URL + "?state=notebook&v=locked");
await p.waitForTimeout(400);
await p.click(".topField");
await p.type(".topField", "Cake tasting moved to Friday", { delay: 8 });
await p.waitForTimeout(150);

const samples = await p.evaluate(async () => {
  const out = [];
  const t0 = performance.now();
  const tick = () => {
    const el = document.querySelector(".top");
    const cs = el ? getComputedStyle(el) : null;
    out.push({
      t: Math.round(performance.now() - t0),
      op: cs ? cs.opacity : "gone",
      tr: cs ? cs.transform : "gone",
      settling: el ? el.hasAttribute("data-settling") : null,
      transition: cs ? cs.transitionProperty : "",
    });
  };
  // fire ctrl+enter through the real handler
  const field = document.querySelector(".topField");
  field.focus();
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
  tick();
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 30));
    tick();
  }
  return out;
});
console.log("DESK .top samples:");
for (const s of samples) console.log(`  t=${s.t}ms opacity=${s.op} transform=${s.tr} settling=${s.settling}`);
console.log("  transitionProperty:", samples[0].transition);

// typing during the settle?
await p.goto(URL + "?state=notebook&v=locked");
await p.waitForTimeout(300);
await p.click(".topField");
await p.type(".topField", "Second thought", { delay: 8 });
await p.keyboard.press("Control+Enter");
await p.waitForTimeout(60);
await p.keyboard.type("napkins");
const during = await p.evaluate(() => {
  const el = document.querySelector(".top");
  const f = document.querySelector(".topField");
  return { opacity: getComputedStyle(el).opacity, value: f ? f.value : null, focused: document.activeElement === f };
});
console.log("MID-SETTLE typing:", JSON.stringify(during));

// ---- hand settle ----
await p.goto(URL + "?state=review&v=locked");
await p.waitForTimeout(400);
const hand = await p.evaluate(async () => {
  const out = [];
  const t0 = performance.now();
  const tick = () => {
    const el = document.querySelector(".handTop");
    const cs = el ? getComputedStyle(el) : null;
    out.push({ t: Math.round(performance.now() - t0), op: cs ? cs.opacity : "gone", tr: cs ? cs.transform : "gone", tp: cs ? cs.transitionProperty : "" });
  };
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true }));
  tick();
  for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 30)); tick(); }
  return out;
});
console.log("HAND .handTop samples:");
for (const s of hand) console.log(`  t=${s.t}ms opacity=${s.op} transform=${s.tr}`);
console.log("  transitionProperty:", hand[0].tp);

await b.close();
