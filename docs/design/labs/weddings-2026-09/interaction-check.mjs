// The behaviour gate — the measured seat for how the master BEHAVES.
//
//   node interaction-check.mjs            (run from the lab directory)
//
// This file is scaffolded into the lab and then OWNED by the engagement:
// every time a confirmed panel finding is fixed, add an assertion here that
// would have caught it, while the defect is fresh. The proving engagements
// finished with 192 and 216 assertions; every one existed because a seat
// found the defect it guards by driving the real file. Exits 1 on any
// failure, so a regression cannot be talked past.
//
// What ships below is the UNIVERSAL floor — properties any interactive
// surface must hold. The engagement-specific assertions (the keyboard
// model, undo, the primary gesture) are the real gate; grow them fast.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LAB = path.resolve(".");
const config = JSON.parse(await readFile(path.join(LAB, "elevate.config.json"), "utf8"));
const MASTER = pathToFileURL(path.join(LAB, config.master ?? "master.html")).href;

const results = [];
let failures = 0;
function ok(name, pass, detail = "") {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
  process.stdout.write(`  ${pass ? "pass" : "FAIL"}  ${name}${pass || !detail ? "" : "  — " + detail}\n`);
}

const browser = await (async () => {
  try { return await chromium.launch(); }
  catch (error) {
    for (const executablePath of [process.env.ELEVATE_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean)) {
      try { return await chromium.launch({ executablePath }); } catch { /* next */ }
    }
    throw error;
  }
})();
const pageErrors = [];

async function open({ state, variant, viewport } = {}) {
  const vp = viewport ?? { width: 1440, height: 960 };
  const page = await browser.newPage({ viewport: vp });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));
  const url = new URL(MASTER);
  if (state) url.searchParams.set("state", state);
  if (variant ?? config.defaultVariant) url.searchParams.set("v", variant ?? config.defaultVariant);
  await page.goto(url.href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(300);
  return page;
}

/* ══ universal floor ═══════════════════════════════════════════════ */

/* Every state loads clean and never scrolls sideways, at every width. */
for (const state of config.states) {
  for (const vp of config.viewports) {
    const page = await open({ state, viewport: { width: vp.width, height: vp.height } });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    ok(`no sideways scroll · ${state} @ ${vp.name}`, overflow <= 1, `${overflow}px`);
    await page.close();
  }
}
ok("zero console errors across all states", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

/* Focus and names: everything interactive is reachable, visible, and named. */
{
  const page = await open({ state: config.states[0] });
  const audit = await page.evaluate(() => {
    const out = { unnamed: [], invisible: [], noFocusStyle: 0, stops: 0 };
    const interactive = Array.from(
      document.querySelectorAll("button, a[href], [tabindex], input, textarea, select, [role='button'], [role='checkbox']"),
    );
    for (const el of interactive) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.01;
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || (el.labels && el.labels[0]?.textContent) || "").trim();
      const focusable = el.tabIndex >= 0;
      if (focusable) out.stops += 1;
      if (visible && !name) out.unnamed.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
      /* An invisible element that can take focus strands the keyboard. */
      if (!visible && focusable && cs.pointerEvents !== "none") out.invisible.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    }
    return out;
  });
  ok("every visible interactive element has an accessible name", audit.unnamed.length === 0, audit.unnamed.slice(0, 4).join(", "));
  ok("nothing invisible can take focus", audit.invisible.length === 0, audit.invisible.slice(0, 4).join(", "));

  /* A visible focus treatment exists: focus the first interactive element
     and require that SOMETHING painted changes (outline, shadow or ring). */
  const focusVisible = await page.evaluate(() => {
    const el = document.querySelector("button, a[href], [tabindex], input");
    if (!el) return true;
    const before = getComputedStyle(el);
    const prior = before.outlineWidth + before.boxShadow;
    el.focus({ focusVisible: true });
    const after = getComputedStyle(el);
    return after.outlineWidth + after.boxShadow !== prior || parseFloat(after.outlineWidth) > 0;
  });
  ok("focus paints a visible treatment", focusVisible);
  await page.close();
}

/* Word-safe text: no text node may end hard against its box mid-word with
   no ellipsis — that is silent content deletion. */
{
  const page = await open({ state: config.states[0] });
  const clipped = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("*")) {
      if (!el.childNodes.length) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow !== "hidden" && cs.overflowX !== "hidden") continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      if (cs.textOverflow === "ellipsis") continue;
      const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (text) bad.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    }
    return bad.slice(0, 6);
  });
  ok("no silent text clipping (hidden overflow without ellipsis)", clipped.length === 0, clipped.join(", "));
  await page.close();
}

/* ══ engagement assertions ═════════════════════════════════════════
   Grow this section every round. Pattern:

   {
     const page = await open({ state: "resting" });
     await page.locator(".thing .primary-action").click();
     await page.waitForTimeout(250);
     ok("the primary action does what it says", await page.evaluate(...));
     ok("focus survives the repaint", await page.evaluate(
       () => !!document.activeElement.closest(".thing")));
     await page.close();
   }
   ═══════════════════════════════════════════════════════════════════ */

/* ══ engagement assertions · weddings ═══════════════════════════════
   Grown from the defects this surface already owes. */

/* The mode row: six modes on Guests, the landing one current, and a
   switch that keeps the operator's place — focus stays on the control. */
{
  const page = await open({ state: "guests-list" });
  const segs = await page.locator(".segBtn").count();
  ok("guests mode row renders six modes", segs === 6, String(segs));
  const current = ((await page.locator('.segBtn[aria-current="true"]').textContent()) || "").trim();
  ok("the landing mode is marked aria-current", current === "The list", current);
  await page.locator(".segBtn", { hasText: "By household" }).click();
  await page.waitForTimeout(250);
  const after = ((await page.locator('.segBtn[aria-current="true"]').textContent()) || "").trim();
  ok("clicking a mode moves aria-current", after === "By household", after);
  ok("focus survives the mode repaint", await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains("segBtn") && document.activeElement.getAttribute("aria-current") === "true"));
  const h1 = ((await page.locator(".sheetHead h1").textContent()) || "").trim();
  ok("the destination title holds across modes", h1 === "Guests", h1);
  await page.close();
}

/* Check before you print: print stays disabled while the plan is not
   ready, and a check that could not run is drawn as unrun, never passed. */
{
  const page = await open({ state: "seating-check" });
  ok("print place cards is disabled while the plan is not ready", await page.locator("button", { hasText: "Print place cards" }).isDisabled());
  const unrun = await page.locator('.checkRow[data-k="unrun"]').count();
  const passed = await page.locator('.checkRow[data-k="pass"]').count();
  ok("two checks are shown as not run, five as passed", unrun === 2 && passed === 5, passed + " pass / " + unrun + " unrun");
  await page.close();
}

/* The keyboard model: number keys jump between destinations and the rail
   marks where you landed. */
{
  const page = await open({ state: "money-number" });
  await page.keyboard.press("7");
  await page.waitForTimeout(250);
  const h1 = ((await page.locator(".sheetHead h1").textContent()) || "").trim();
  ok("pressing 7 jumps to Seating", h1 === "Seating", h1);
  const railCurrent = (await page.locator('.railItem[aria-current="true"]').textContent()) || "";
  ok("the rail marks Seating current after the jump", /Seating/.test(railCurrent), railCurrent);
  ok("focus lands on the current rail item after a keyboard jump", await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains("railItem")));
  await page.close();
}

/* Seating opens on the list, and each row's one action says what it does. */
{
  const page = await open({ state: "seating-queue" });
  const first = (await page.locator(".pane .gRow .btn").first().textContent()) || "";
  ok("the first unseated row offers to hold a chair for a non-replier", /Hold a chair/.test(first), first);
  const primaries = await page.locator(".pane .gRow .btn[data-primary]").count();
  ok("only people who have replied get a primary Seat action", primaries === 4, String(primaries));
  await page.close();
}

/* Escape leaves the picker and puts the workspace back as it was. */
{
  const page = await open({ state: "guests-list" });
  await page.locator(".railAdd").click();
  await page.waitForTimeout(200);
  ok("the + opens the picker", ((await page.locator(".sheetHead h1").textContent()) || "").trim() === "Add a section");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("Escape returns to Guests", ((await page.locator(".sheetHead h1").textContent()) || "").trim() === "Guests");
  ok("the Wedding section is still in the rail after Escape", (await page.locator(".railSection span", { hasText: "Wedding" }).count()) === 1);
  await page.close();
}

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
