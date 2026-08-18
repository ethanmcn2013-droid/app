// The console must drive the real master, not a copy of it.
//
//   node verify-console.mjs --lab=<dir>
//
// Asserts the compiled console.html: renders content in the deck, never
// scrolls sideways, every control genuinely writes an attribute the deck
// carries, every room preset and state and width selects, and the page
// loads with zero console errors. Engagement-specific action checks (the
// primary gesture working INSIDE the console) belong in the lab's own
// interaction-check.mjs; this file guards the compilation.
import { chromium } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, loadLab, launch } from "./lib.mjs";

const args = parseArgs();
const { lab } = await loadLab(args);
const URL = pathToFileURL(path.join(lab, "console.html")).href;

let failures = 0;
const ok = (name, pass, detail = "") => {
  process.stdout.write(`  ${pass ? "pass" : "FAIL"}  ${name}${pass || !detail ? "" : "  — " + detail}\n`);
  if (!pass) failures += 1;
};

const browser = await launch(chromium);
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL);
await page.waitForTimeout(700);

ok("deck renders content", (await page.locator("#deck *").count()) > 0);
ok("page does not scroll sideways",
  !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));

/* Every choice control writes the attribute it claims. */
const choices = await page.locator("[data-choice]").all();
let wired = 0, dead = [];
const seen = new Set();
for (const choice of choices) {
  const key = await choice.getAttribute("data-choice");
  const value = await choice.getAttribute("data-value");
  if (seen.has(key + ":" + value)) continue;
  seen.add(key + ":" + value);
  await choice.click();
  await page.waitForTimeout(80);
  const applied = await page.evaluate(
    ([k, v]) => document.getElementById("deck").getAttribute("data-" + k) === v,
    [key, value],
  );
  if (applied) wired += 1; else dead.push(`${key}=${value}`);
}
ok(`every control writes the deck (${wired}/${seen.size})`, dead.length === 0, dead.slice(0, 5).join(", "));

/* Every preset, state and width selects. */
for (const kind of ["preset", "state", "width"]) {
  const buttons = await page.locator(`button[data-${kind}]`).all();
  let selects = 0;
  for (const b of buttons) {
    await b.click();
    await page.waitForTimeout(60);
    if ((await b.getAttribute("aria-pressed")) === "true") selects += 1;
  }
  ok(`every ${kind} selects (${selects}/${buttons.length})`, buttons.length > 0 && selects === buttons.length);
}

ok("zero console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
process.stdout.write(failures ? `\n${failures} failing\n` : "\nconsole verified\n");
process.exit(failures ? 1 : 0);
