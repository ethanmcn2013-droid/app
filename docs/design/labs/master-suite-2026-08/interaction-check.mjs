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

/* touch is set from the viewport, not left to chance. A context with a
   viewport and no hasTouch never evaluates the coarse-pointer branch, so
   every "phone" assertion written against one is proving the desk. One
   engagement carried a 16px touch target and a broken primary gesture
   behind 232 passing assertions for exactly this reason.
   ../references/gates.md, ../references/lessons.md L-07. */
async function open({ state, variant, viewport, touch } = {}) {
  const vp = viewport ?? { width: 1440, height: 960 };
  const isTouch = touch ?? vp.width <= 480;
  const context = await browser.newContext({ viewport: vp, isMobile: isTouch, hasTouch: isTouch });
  const page = await context.newPage();
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
    const page = await open({ state, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
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
      /* checkVisibility walks ANCESTORS. The hand-rolled test below it read
         `display` off the element itself, so every control inside the two
         products that are mounted-but-hidden — `.app[hidden]`, `display:
         none` — reported its own `flex` and was called an invisible focus
         stop. Four false positives, in a gate whose whole job is to be
         believed. */
      const shown = el.checkVisibility
        ? el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
        : cs.visibility !== "hidden" && cs.display !== "none";
      const visible = shown && !el.closest("[inert]") && !el.closest("[hidden]");
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || (el.labels && el.labels[0]?.textContent) || "").trim();
      const focusable = el.tabIndex >= 0;
      if (focusable) out.stops += 1;
      if (visible && !name) out.unnamed.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
      /* An invisible element that can take focus strands the keyboard — but
         "can take focus" is a question for the browser, not for a stylesheet.
         Ask it: focus the thing and see whether focus actually lands. A
         control inside a `display: none` subtree cannot be focused at all,
         which is exactly why it was never a stranding risk. */
      if (!visible && focusable && cs.pointerEvents !== "none") {
        const was = document.activeElement;
        try { el.focus(); } catch (e) { /* refused, which is the answer */ }
        const took = document.activeElement === el;
        if (was && was.focus) { try { was.focus(); } catch (e) {} }
        /* VISIBLE WHILE FOCUSED, which is the question that matters. The
           rule read visibility BEFORE focusing, which condemns the common
           and correct pattern of a control hidden at rest and revealed by
           `:focus` — the card's move menu is exactly that. A keyboard user
           needs to see where focus IS, not where it was before it arrived. */
        const seenNow = took && el.checkVisibility
          ? el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
          : took;
        if (took && !seenNow) out.invisible.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
      }
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
      /* The visually-hidden signature: a 1x1 box clipped to nothing, holding
         text meant for a screen reader and never for the eye. Its scrollWidth
         is 830 against a clientWidth of 1, which reads as catastrophic
         clipping to a rule looking for a cut word. It is the opposite — text
         deliberately delivered in full to the one reader who wants it. Six
         false positives, all of them `span.sr`. */
      if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
      if (/inset\(50%\)/.test(cs.clipPath || "")) continue;
      const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (text) bad.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    }
    return bad.slice(0, 6);
  });
  ok("no silent text clipping (hidden overflow without ellipsis)", clipped.length === 0, clipped.join(", "));
  await page.close();
}

/* ══ driving with real input ═══════════════════════════════════════
   A gesture proved with a scripted Selection, or a click that teleports,
   is not proved. One behaviour gate passed while the product's primary
   pick gesture was completely broken, because it proved the drag with a
   synthetic Selection object. Another swallowed the board's primary
   gesture on ordinary trackpad hardware behind 232 assertions, because
   every one of them clicked with a teleport instead of real travel.
   Use these two helpers; do not reach for .click() on a gesture. */

/* Real pointer travel, in steps, so a movement threshold actually fires. */
async function drag(page, from, to, { steps = 24 } = {}) {
  const a = await page.locator(from).boundingBox();
  const b = typeof to === "string" ? await page.locator(to).boundingBox() : to;
  if (!a || !b) throw new Error(`drag: no box for ${from} or ${to}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move((b.x ?? 0) + (b.width ?? 0) / 2, (b.y ?? 0) + (b.height ?? 0) / 2, { steps });
  await page.mouse.up();
}

/* A real touch, on a page opened with touch: true. */
async function tap(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`tap: no box for ${selector}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/* ══ engagement assertions ═════════════════════════════════════════
   Grow this section every round: one assertion per confirmed finding,
   WRITTEN FIRST and watched failing against the unfixed code. A rule
   that has never fired is not a rule. Pattern:

   {
     const page = await open({ state: "resting" });
     await drag(page, ".thing .handle", ".target-column");
     await page.waitForTimeout(250);
     ok("the primary gesture lands the card", await page.evaluate(...));
     ok("focus survives the repaint", await page.evaluate(
       () => !!document.activeElement.closest(".thing")));
     await page.close();
   }

   And the same claim on a phone, which is a different code path:

   {
     const page = await open({ state: "resting", viewport: { width: 390, height: 844 }, touch: true });
     await tap(page, ".thing .primary-action");
     ok("the primary action works under a coarse pointer", await page.evaluate(...));
     await page.close();
   }
   ═══════════════════════════════════════════════════════════════════ */

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
