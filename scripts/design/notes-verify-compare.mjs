/* Drive the comparison surface before it is published.
 *
 *   node scripts/design/notes-verify-compare.mjs
 *
 * A surface that ships with a dead control or a missing frame is worse than
 * no surface, so this opens the real file, counts what it painted, presses
 * the things that are meant to be pressable, and exits 1 if any of it lies.
 */
import { chromium } from "@playwright/test";
import path from "node:path";

const URL = "file:///" + path.resolve("docs/design/labs/notes-2026-08/compare.html").split("\\").join("/");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL);
await page.waitForTimeout(500);

let fails = 0;
const ok = (name, pass, detail) => {
  if (!pass) fails += 1;
  process.stdout.write(`${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}\n`);
};

const STATES = ["notebook", "capture", "voice", "readback", "review", "seam", "search", "pressure", "nothing", "not-yet"];
const VIEWS = ["1440x960", "1280x900", "768x1024", "390x844"];

/* Every state at every viewport must paint four real frames. */
let broken = [];
for (const s of STATES) {
  await page.locator(`[data-state="${s}"]`).click();
  for (const v of VIEWS) {
    await page.locator(`[data-view="${v}"]`).click();
    await page.waitForTimeout(60);
    const shots = await page.locator("#strip .shot").count();
    const miss = await page.locator("#strip .shot.miss").count();
    const loaded = await page.evaluate(() =>
      [...document.querySelectorAll("#strip img")].filter((i) => i.naturalWidth > 0).length);
    if (shots !== 4 || miss || loaded !== 4) broken.push(`${s}@${v} shots=${shots} miss=${miss} loaded=${loaded}`);
  }
}
ok(`all ${STATES.length} states paint 4 loaded frames at all ${VIEWS.length} viewports`, broken.length === 0, broken.slice(0, 4).join(" · "));

/* The zone controls, and the digest they feed. */
await page.locator('[data-vote="yes"][data-z="2"][data-d="a"]').click();
await page.locator('[data-vote="no"][data-z="5"][data-d="c"]').click();
await page.locator('.noteField[data-z="2"][data-d="a"]').fill("the dock is the whole idea");
await page.waitForTimeout(80);
const digest = await page.locator("#digestOut").textContent();
ok("a vote reaches the digest", digest.includes("works"), "");
ok("a dissent reaches the digest", digest.includes("does not work"));
ok("a written note reaches the digest", digest.includes("the dock is the whole idea"));
ok("the digest names the zone", digest.includes("2 · Composer") && digest.includes("5 · Review & seam"));

/* A second press of the same vote clears it, so nothing is unsayable. */
await page.locator('[data-vote="yes"][data-z="2"][data-d="a"]').click();
await page.waitForTimeout(60);
ok("a vote can be taken back", !(await page.locator('[data-vote="yes"][data-z="2"][data-d="a"]').getAttribute("data-on")));

await page.locator("#clearBtn").click();
await page.waitForTimeout(60);
ok("clear empties the digest", (await page.locator("#digestCount").textContent()).includes("nothing marked"));

/* Zoom, and the way back out of it. */
await page.locator("#strip .shot").first().click();
await page.waitForTimeout(120);
ok("a frame opens full size", (await page.locator("#zoom").getAttribute("data-on")) !== null);
await page.keyboard.press("Escape");
await page.waitForTimeout(120);
ok("escape closes it", (await page.locator("#zoom").getAttribute("data-on")) === null);

/* Every control answers the keyboard. */
const unnamed = await page.evaluate(() =>
  [...document.querySelectorAll("button, textarea")].filter((b) => {
    const name = (b.getAttribute("aria-label") || b.textContent || "").trim();
    return !name;
  }).length);
ok("every control carries a name", unnamed === 0, `${unnamed} unnamed`);

/* The page must never scroll sideways. */
for (const w of [1440, 1100, 640, 390]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(120);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`no sideways scroll at ${w}`, over <= 1, `overflow ${over}px`);
}

ok("no console errors", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" · "));

await browser.close();
process.stdout.write(`\n${fails} failing\n`);
if (fails) process.exitCode = 1;
