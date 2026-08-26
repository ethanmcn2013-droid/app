import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });

await p.evaluate(() => {
  window.__mark = (tag) => {
    const out = {};
    for (const sel of [".b-live", "p.sr", ".b-undo"]) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = "absent"; continue; }
      if (!el.__id) el.__id = "n" + Math.random().toString(36).slice(2, 7);
      out[sel] = el.__id + " :: \"" + (el.textContent || "").trim().slice(0, 60) + "\"";
    }
    return out;
  };
  window.__log = [];
  // observe the *document* so we can see whether the live node itself is replaced
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.removedNodes) if (n.nodeType === 1 && (n.matches?.(".b-live") || n.querySelector?.(".b-live"))) window.__log.push("REMOVED a .b-live");
      for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches?.(".b-live") || n.querySelector?.(".b-live"))) window.__log.push("ADDED a .b-live with text: \"" + (n.matches?.(".b-live") ? n.textContent : n.querySelector(".b-live").textContent).trim().slice(0, 60) + "\"");
    }
  }).observe(document.body, { childList: true, subtree: true });
});

const mark = async (t) => console.log(t, JSON.stringify(await p.evaluate(() => window.__mark()), null, 0));
const log = async (t) => console.log("   " + t + " mutations:", JSON.stringify(await p.evaluate(() => { const x = window.__log; window.__log = []; return x; })));

await mark("start");
await p.locator(".b-grab").first().click(); await p.waitForTimeout(400);
await mark("editor open"); await log("editor open");
await p.locator("#b-edit .b-step").first().click(); await p.waitForTimeout(500);
await mark("stepped"); await log("stepped");
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
await p.locator('[data-layout-to="down"]').click(); await p.waitForTimeout(600);
await mark("orientation"); await log("orientation");
await p.locator('.b-act:has-text("Preview")').first().click(); await p.waitForTimeout(700);
await mark("preview"); await log("preview");
await p.close();
await b.close();
