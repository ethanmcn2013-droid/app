import { launch, open } from "./drive.mjs";

const b = await launch();

async function arm(p) {
  await p.evaluate(() => {
    window.__fired = [];
    window.__regions = [...document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")];
    window.__regions.forEach((el, i) => {
      new MutationObserver(() => window.__fired.push("region#" + i + " (" + String(el.className) + ") -> \"" + (el.textContent || "").trim().slice(0, 70) + "\"")).observe(el, { childList: true, characterData: true, subtree: true });
    });
    window.__stillInDoc = () => window.__regions.map((el, i) => "region#" + i + " " + String(el.className) + ": " + (document.contains(el) ? "alive" : "DESTROYED"));
  });
}
const report = async (p, tag) => {
  const fired = await p.evaluate(() => { const x = window.__fired; window.__fired = []; return x; });
  const alive = await p.evaluate(() => window.__stillInDoc());
  console.log("  " + tag);
  console.log("     announced: " + (fired.length ? fired.join(" ; ") : "NOTHING"));
  console.log("     regions:   " + alive.join(" | "));
};

console.log("=== TIMELINE (owner)");
{
  const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
  await arm(p);
  await p.locator('.b-act:has-text("Preview")').first().click(); await p.waitForTimeout(700);
  await report(p, "press Preview");
  await p.close();
}
{
  const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
  await arm(p);
  await p.locator('.b-act:has-text("Get the link")').first().click(); await p.waitForTimeout(700);
  await report(p, "press Get the link");
  await p.close();
}
{
  const p = await open(b, { state: "timeline.owner-flight", width: 1440, height: 960 });
  await arm(p);
  await p.locator('[data-layout-to="down"]').click(); await p.waitForTimeout(700);
  await report(p, "orientation to down (the one routed through the suite region)");
  await p.close();
}
console.log("=== TASKS");
{
  const p = await open(b, { state: "tasks.board", width: 1440, height: 960 });
  await arm(p);
  await p.locator(".tick").first().click(); await p.waitForTimeout(700);
  await report(p, "tick");
  await p.locator(".undated").click(); await p.waitForTimeout(700);
  await report(p, "open Planning");
  await p.close();
}
console.log("=== NOTES");
{
  const p = await open(b, { state: "notes.seam", width: 1440, height: 960 });
  await arm(p);
  await p.locator('[data-act="send"]').first().click(); await p.waitForTimeout(800);
  await report(p, "send to Tasks");
  await p.close();
}
await b.close();
