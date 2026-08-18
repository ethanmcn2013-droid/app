/* Drive the console before it is published.
 *
 *   node scripts/design/notes-verify-console.mjs
 *
 * A console is a claim that every control does something real. This checks
 * the claim: it presses every control, watches the deck's attributes change,
 * and drives the notebook inside the console the same way the behaviour gate
 * drives it standalone — because a console that is a picture of a control
 * panel is worse than no console.
 */
import { chromium } from "@playwright/test";
import path from "node:path";

const URL = "file:///" + path.resolve("docs/design/labs/notes-2026-08/console.html").split("\\").join("/");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

let fails = 0;
const ok = (name, pass, detail) => {
  if (!pass) fails += 1;
  process.stdout.write(`${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}\n`);
};

/* The master really is inside it. */
ok("the master renders inside the deck", (await page.locator("#deck .sheet").count()) === 1);
ok("with the real fixture", (await page.locator("#deck .idxRow").count()) === 14);
ok("and the real wordmark", (await page.locator("#deck .word").textContent()) === "notes");

/* Every decision writes the attribute the master reads. */
const DEC = { paper: ["flat", "stacked", "deep"], index: ["airy", "tight"], radius: ["sharp", "soft", "round"], indigo: ["subtle", "forward"], type: ["calm", "expressive"] };
for (const [key, values] of Object.entries(DEC)) {
  for (const value of values) {
    await page.locator(`.opts[data-key="${key}"] .opt[data-value="${value}"]`).click();
    await page.waitForTimeout(50);
    const got = await page.locator("#deck").getAttribute(`data-${key}`);
    ok(`${key} = ${value} reaches the deck`, got === value, got);
  }
}

/* A decision has to change something on screen, not only an attribute. */
await page.locator('.opts[data-key="paper"] .opt[data-value="stacked"]').click();
await page.waitForTimeout(80);
const stacked = await page.locator("#deck .behind").count();
await page.locator('.opts[data-key="paper"] .opt[data-value="flat"]').click();
await page.waitForTimeout(80);
const flat = await page.evaluate(() => [...document.querySelectorAll("#deck .behind")].filter((n) => getComputedStyle(n).display !== "none").length);
ok("flat actually removes the pile", stacked > 0 && flat === 0, `${stacked} -> ${flat}`);

/* The rooms are presets of those decisions and nothing else. */
for (const room of ["quiet", "studio", "press", "locked"]) {
  await page.locator(`.room[data-key="${room}"]`).click();
  await page.waitForTimeout(60);
  const on = await page.locator(`.room[data-key="${room}"]`).getAttribute("data-on");
  ok(`room ${room} selects`, on !== null);
}
ok("the deck names the room it is showing", (await page.locator("#deckName").textContent()).trim() === "Locked");
await page.locator('.opts[data-key="radius"] .opt[data-value="round"]').click();
await page.waitForTimeout(60);
ok("and says so honestly when it is a mix", (await page.locator("#deckName").textContent()).trim() === "Your mix");
await page.locator('.room[data-key="locked"]').click();
await page.waitForTimeout(60);

/* Every state is reachable and repaints the real thing. */
for (const [key] of [["notebook"], ["capture"], ["voice"], ["readback"], ["review"], ["seam"], ["search"], ["pressure"], ["nothing"], ["not-yet"]]) {
  await page.locator(`.stateBtn[data-state="${key}"]`).click();
  await page.waitForTimeout(120);
  const painted = await page.locator("#deck .sheet, #deck .dark").count();
  ok(`state ${key} paints`, painted >= 1);
}

/* The notebook inside the console is live, not a screenshot. */
await page.locator('.stateBtn[data-state="notebook"]').click();
await page.waitForTimeout(140);
const before = await page.locator("#deck .idxRow").count();
await page.locator("#deck .topField").fill("A note written inside the console.");
await page.locator("#deck .topField").press("Control+Enter");
await page.waitForTimeout(320);
ok("the notebook inside the console really captures", (await page.locator("#deck .idxRow").count()) === before + 1);
await page.keyboard.press("Control+z");
await page.waitForTimeout(240);
ok("and really undoes", (await page.locator("#deck .idxRow").count()) === before);

/* The width control drives the master's own responsive rules. */
await page.locator('.stateBtn[data-width="390"]').click();
await page.waitForTimeout(160);
ok("the phone width reaches the deck", (await page.locator("#deck").getAttribute("data-w")) === "390");
ok("and the desk stands down, as it does on a real phone", await page.locator("#deck .desk").isHidden());
ok("and capture moves into the dock", (await page.locator("#deck .phoneField").count()) === 1);
await page.locator('.stateBtn[data-width="1440"]').click();
await page.waitForTimeout(140);

/* The receipt is generated, complete, and cannot show a fourth hue. */
const toks = await page.locator("#receipt .tok").count();
ok("the palette receipt is on the page", toks >= 20, `${toks} tokens`);
const hues = await page.evaluate(() =>
  [...document.querySelectorAll("#receipt .tokOf b")].map((b) => b.textContent));
ok("every token is Ink, Indigo or White", hues.every((h) => ["Ink", "Indigo", "White"].includes(h)), [...new Set(hues)].join(" · "));
ok("and the page says zero other hues", (await page.locator("#badges").textContent()).includes("0 other hues"));

/* The page itself. */
const unnamed = await page.evaluate(() =>
  [...document.querySelectorAll("button")].filter((b) => !(b.getAttribute("aria-label") || b.textContent || "").trim()).length);
ok("every control on the page carries a name", unnamed === 0, `${unnamed} unnamed`);
for (const w of [1500, 1100, 700, 390]) {
  await page.setViewportSize({ width: w, height: 950 });
  await page.waitForTimeout(140);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`no sideways scroll at ${w}`, over <= 1, `${over}px`);
}

ok("no console errors", errors.length === 0, [...new Set(errors)].slice(0, 3).join(" · "));
await browser.close();
process.stdout.write(`\n${fails} failing\n`);
if (fails) process.exitCode = 1;
