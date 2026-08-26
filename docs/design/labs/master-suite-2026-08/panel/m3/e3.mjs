import { launch, open } from "./drive.mjs";

const b = await launch();
const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
await p.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
await p.evaluate(() => {
  window.__seen = [];
  const attach = () => {
    const el = document.querySelector(".b-live");
    if (!el || el.__w) return;
    el.__w = true;
    window.__seen.push("attached to " + (el.__id || (el.__id = "n" + Math.random().toString(36).slice(2, 6))));
    new MutationObserver(() => window.__seen.push("MUTATED " + el.__id + ": \"" + (el.textContent || "").trim().slice(0, 70) + "\"")).observe(el, { childList: true, characterData: true, subtree: true });
  };
  attach();
  new MutationObserver(() => {
    const el = document.querySelector(".b-live");
    if (el && !el.__w) { window.__seen.push("REPLACED — new .b-live already reads \"" + (el.textContent || "").trim().slice(0, 70) + "\""); attach(); }
  }).observe(document.body, { childList: true, subtree: true });
});
const dump = async (t) => console.log(t + "\n   " + (await p.evaluate(() => { const x = window.__seen; window.__seen = []; return x; })).join("\n   "));
await dump("initial");
await p.locator('.b-act:has-text("Get the link")').first().click(); await p.waitForTimeout(800);
await dump("Get the link");
await p.locator('.b-act:has-text("Add a moment")').first().click(); await p.waitForTimeout(800);
await dump("Add a moment");
await p.close();
await b.close();
