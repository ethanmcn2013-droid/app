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
   Direction B · The Approach. The claims this direction makes that a
   screenshot cannot check. Every one of these guards something the
   direction promises in writing; when a panel finding is confirmed and
   fixed, its assertion joins them here while the defect is fresh.
   ═══════════════════════════════════════════════════════════════════ */

/* The fixture, read the same way the master reads it, so the gate cannot
   agree with the page by copying it. */
const FIXTURE = await (async () => {
  const src = await readFile(path.join(LAB, "fixture.js"), "utf8");
  const sandbox = { window: {} };
  new Function("window", src)(sandbox.window);
  return sandbox.window.__TLFIXTURE;
})();

const AHEAD = FIXTURE.milestones
  .filter((m) => m.state !== "cancelled" && m.date && FIXTURE.daysTo(m.date) > 0)
  .sort((a, b) => FIXTURE.daysTo(a.date) - FIXTURE.daysTo(b.date));

/* ── the thesis: a pixel is a real unit of time ────────────────────
   This is the whole direction. If the measure ever stops being strictly
   proportional the page is telling the reader something untrue about how
   far away their wedding is, and no seat would necessarily catch it. */
for (const state of ["phone", "desk", "owner-flight", "print"]) {
  const page = await open({ state });
  const placed = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-measure .b-item")).map((el) => ({
      id: el.getAttribute("data-id"),
      top: el.offsetTop,
      away: Number((el.querySelector(".b-away") || {}).textContent),
    })),
  );
  const known = placed.filter((p) => p.away > 0);
  const scales = known.map((p) => p.top / p.away);
  const spread = Math.max(...scales) - Math.min(...scales);
  ok(`measure is strictly proportional · ${state}`, known.length >= 5 && spread < 0.001,
    `${known.length} items, scale spread ${spread.toFixed(4)}`);

  /* The count column is derived from the date, not typed beside it. */
  const wrong = placed.filter((p) => {
    const item = AHEAD.find((m) => m.id === p.id);
    return !item || p.away !== FIXTURE.daysTo(item.date);
  });
  ok(`every count matches its own date · ${state}`, wrong.length === 0,
    wrong.map((w) => w.id).join(", "));

  /* No two items may touch. The scale is chosen from the tightest real
     gap; if an item ever grows a line, this is what says so. */
  const overlap = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll(".b-measure .b-item"))
      .map((el) => el.getBoundingClientRect())
      .sort((a, b) => a.top - b.top);
    const hits = [];
    for (let i = 1; i < rects.length; i++) {
      if (rects[i].top < rects[i - 1].bottom - 0.5) hits.push(i);
    }
    return hits.length;
  });
  ok(`no two items on the measure collide · ${state}`, overlap === 0, `${overlap} collisions`);
  await page.close();
}

/* The measure must not collide on a phone either, where the scale is
   smaller and the titles wrap. */
{
  const page = await open({ state: "phone", viewport: { width: 390, height: 844 } });
  const overlap = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll(".b-measure .b-item"))
      .map((el) => el.getBoundingClientRect())
      .sort((a, b) => a.top - b.top);
    let hits = 0;
    for (let i = 1; i < rects.length; i++) if (rects[i].top < rects[i - 1].bottom - 0.5) hits += 1;
    return hits;
  });
  ok("no collisions on the measure at 390px", overlap === 0, `${overlap} collisions`);
  await page.close();
}

/* ── one number, one accessor ──────────────────────────────────────
   The horizon count, the last item on the measure and the fixture must
   all agree. A header that disagrees with its own list spends the
   credibility of the whole product. */
{
  const page = await open({ state: "phone" });
  const read = await page.evaluate(() => ({
    horizon: Number(document.querySelector(".b-num").textContent),
    last: Number(
      Array.from(document.querySelectorAll(".b-measure .b-item")).pop().querySelector(".b-away").textContent,
    ),
    anchors: document.querySelectorAll('.b-item[data-anchor="true"]').length,
    leads: document.querySelectorAll('.b-item[data-lead="true"]').length,
  }));
  ok("the horizon count is the fixture count", read.horizon === FIXTURE.toDay(), String(read.horizon));
  ok("the horizon count is the last item on the measure", read.horizon === read.last, `${read.horizon} vs ${read.last}`);
  ok("exactly one item is the day itself", read.anchors === 1, String(read.anchors));
  ok("exactly one item is the next thing", read.leads === 1, String(read.leads));

  /* The next thing must be the nearest future item, not whichever row
     the data happened to mark. */
  const leadId = await page.evaluate(() => document.querySelector('.b-item[data-lead="true"]').getAttribute("data-id"));
  ok("the next thing is the nearest future item", leadId === AHEAD[0].id, leadId);
  await page.close();
}

/* ── unanchored time ───────────────────────────────────────────────
   Every surface that shows a date states today, so "1 Aug" never needs
   arithmetic to feel. */
for (const state of ["phone", "desk", "print", "owner-flight"]) {
  const page = await open({ state });
  const saysToday = await page.evaluate(() => /today/i.test(document.body.innerText));
  ok(`states today on the surface · ${state}`, saysToday);
  await page.close();
}

/* ── words, not position ───────────────────────────────────────────
   Ink density, fill and place on a rail are presentational. The same
   fact has to exist in words for anyone not reading the picture. */
{
  const page = await open({ state: "owner-flight" });
  const names = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-item .b-grab")).map((el) => el.getAttribute("aria-label") || ""),
  );
  ok("every owner row names its own date in words", names.length >= 5 && names.every((n) => /\d/.test(n) && /day|days/i.test(n)),
    names[0] || "none");
  ok("every owner row names what a guest sees", names.every((n) => /shown|private/i.test(n)), names[0] || "none");
  await page.close();
}

/* ── word-safe trimming ────────────────────────────────────────────
   A clamp that cuts at the character produces "dinner 5.30p…". The
   visible string must end on a whole word and the full string must
   survive in the accessible name. */
{
  const page = await open({ state: "phone", viewport: { width: 390, height: 844 } });
  const trims = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-clamp]")).map((el) => ({
      shown: el.textContent,
      full: el.getAttribute("data-full") || el.getAttribute("title") || "",
    })),
  );
  const midWord = trims.filter((t) => t.shown !== t.full && !/\s…$|^\S+…$/.test(t.shown) && t.shown.endsWith("…"));
  ok("no clamp cuts mid-word", midWord.length === 0, midWord.map((t) => t.shown).join(" | "));
  ok("every clamped string keeps its full text", trims.every((t) => t.full.length >= t.shown.length),
    `${trims.length} clamped`);
  await page.close();
}

/* ── the primary gesture ───────────────────────────────────────────
   Changing a date is the thing this direction exists to make feel like
   something: the stepper pulls the item nearer ON the measure. It has to
   move the item, move nothing else, and keep both readouts true. */
{
  const page = await open({ state: "owner-editing" });
  const before = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-measure .b-item")).map((el) => ({
      id: el.getAttribute("data-id"), top: el.offsetTop,
    })),
  );
  const editedId = await page.evaluate(() => document.querySelector('[data-editing="true"]').getAttribute("data-id"));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.locator('.b-step[aria-label="Move a week earlier"]').click();
  await page.waitForTimeout(200);
  const after = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-measure .b-item")).map((el) => ({
      id: el.getAttribute("data-id"), top: el.offsetTop,
      away: Number((el.querySelector(".b-away") || {}).textContent),
    })),
  );
  const moved = after.find((a) => a.id === editedId);
  const start = before.find((b) => b.id === editedId);
  ok("the stepper moves the edited item nearer on the measure", moved.top < start.top,
    `${start.top} → ${moved.top}`);
  const others = after.filter((a) => a.id !== editedId)
    .filter((a) => a.top !== before.find((b) => b.id === a.id).top);
  ok("the stepper moves nothing but the item being edited", others.length === 0,
    others.map((o) => o.id).join(", "));
  const readout = await page.evaluate(() => document.querySelector(".b-stepRead").textContent);
  ok("both readouts agree after a move", readout.includes(String(moved.away)), `${readout} vs ${moved.away}`);
  ok("the page keeps its place through the move",
    (await page.evaluate(() => window.scrollY)) === scrollBefore);
  ok("focus survives the move", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("b-step")));
  await page.close();
}

/* ── one reversibility surface ─────────────────────────────────────
   The most frequent action needs a way back, in one place, with a
   keyboard binding a person can read. */
{
  const page = await open({ state: "owner-editing" });
  const undo = await page.evaluate(() => {
    const el = document.querySelector(".b-undo");
    if (!el) return null;
    return {
      role: el.getAttribute("role"),
      button: !!el.querySelector("button"),
      key: (el.querySelector("kbd") || {}).textContent || "",
      says: el.textContent,
      count: document.querySelectorAll(".b-undo").length,
    };
  });
  ok("a reversibility surface exists", !!undo);
  ok("there is exactly one of it", undo && undo.count === 1, undo && String(undo.count));
  ok("it is a live region", undo && undo.role === "status", undo && undo.role);
  ok("it offers a control and names a key", undo && undo.button && /ctrl|cmd|⌘/i.test(undo.key), undo && undo.key);
  ok("it says what it would undo", undo && /moved|change/i.test(undo.says));
  await page.close();
}

/* ── the ground decision ───────────────────────────────────────────
   Both values are buildable, and print is paper whatever was chosen. */
{
  const ink = await open({ state: "phone" });
  const inkBg = await ink.evaluate(() => getComputedStyle(document.querySelector(".b-field")).backgroundColor);
  await ink.close();
  const paper = await open({ state: "phone", variant: "paper" });
  const paperBg = await paper.evaluate(() => getComputedStyle(document.querySelector(".b-field")).backgroundColor);
  await paper.close();
  ok("the ink ground paints ink", inkBg === "rgb(17, 17, 17)", inkBg);
  ok("the paper ground paints paper", paperBg === "rgb(255, 255, 255)", paperBg);

  const printOnInk = await open({ state: "print" });
  const forced = await printOnInk.evaluate(() => ({
    attr: (document.getElementById("deck") || document.body).getAttribute("data-ground"),
    bg: getComputedStyle(document.querySelector(".b-print")).backgroundColor,
  }));
  ok("print forces the paper ground even when ink is chosen", forced.attr === "paper", forced.attr);
  ok("print actually paints on paper", forced.bg === "rgb(255, 255, 255)", forced.bg);
  await printOnInk.close();
}

/* ── the spacing decision ──────────────────────────────────────────
   Even rhythm has to be a real alternative, not a broken one: the items
   stay in date order and their gutters stay attached to them. */
{
  const page = await open({ state: "phone" });
  await page.evaluate(() => (document.getElementById("deck") || document.body).setAttribute("data-spacing", "even"));
  await page.waitForTimeout(150);
  const even = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-measure .b-item")).map((el) => {
      const tick = el.querySelector(".b-tick").getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return { top: box.top, tickInside: tick.top >= box.top - 12 && tick.top <= box.bottom };
    }),
  );
  const inOrder = even.every((e, i) => i === 0 || e.top > even[i - 1].top);
  ok("even rhythm keeps the items in date order", inOrder);
  ok("even rhythm keeps every tick with its own item", even.every((e) => e.tickInside));
  await page.close();
}

/* ── the link is the real link ─────────────────────────────────────
   Routes and hosts come from the repo, never invented. */
{
  const page = await open({ state: "unfurl" });
  const href = await page.evaluate(() => document.querySelector(".b-unfurl").getAttribute("href"));
  ok("the unfurl card points at the real share origin",
    href === FIXTURE.shareUrlFull && href.startsWith("https://timeline.signalstudio.ie/s/"), href);
  await page.close();
}

/* The card has to be a card on both surfaces it appears on: an inline
   anchor paints no background, no border and no radius, and it looked
   right in the chat only because the chat ground happens to be white. */
for (const state of ["unfurl", "publish"]) {
  const page = await open({ state });
  const card = await page.evaluate(() => {
    const el = document.querySelector(".b-unfurl");
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { display: cs.display, bg: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius), w: r.width, h: r.height };
  });
  ok(`the link card is a block · ${state}`, card.display === "block", card.display);
  ok(`the link card paints its own ground · ${state}`, card.bg === "rgb(255, 255, 255)", card.bg);
  ok(`the link card keeps its corners · ${state}`, card.radius >= 8, String(card.radius));
  ok(`the link card is card-shaped · ${state}`, card.w > 240 && card.w <= 302 && card.h > 180,
    `${Math.round(card.w)}×${Math.round(card.h)}`);
  await page.close();
}

/* ── loading tells the truth ───────────────────────────────────────
   The frame may only promise what will actually arrive. This direction
   refuses to draw a measure whose tick positions are among the things
   still loading, and says so in words. */
{
  const page = await open({ state: "loading" });
  const frame = await page.evaluate(() => ({
    busy: !!document.querySelector('[aria-busy="true"]'),
    ticks: document.querySelectorAll(".b-tick").length,
    shimmer: Array.from(document.querySelectorAll("*")).some((el) => {
      const cs = getComputedStyle(el);
      return cs.animationName !== "none" && /shimmer|pulse|skeleton/i.test(cs.animationName);
    }),
    says: document.body.innerText,
  }));
  ok("the loading frame marks itself busy", frame.busy);
  ok("the loading frame invents no measure", frame.ticks === 0, String(frame.ticks));
  ok("nothing shimmers", !frame.shimmer);
  ok("the loading frame says what is coming", /ahead|loading|bringing/i.test(frame.says));
  await page.close();
}

/* ── the ended link is still a surface ─────────────────────────────  */
{
  const page = await open({ state: "ended" });
  const text = await page.evaluate(() => document.body.innerText);
  ok("the ended link says what happened", /turned off|expired|ended/i.test(text));
  ok("the ended link names who can fix it", text.includes(FIXTURE.workspace.owner));
  ok("the ended link says nothing was deleted", /not been deleted|not public/i.test(text));
  await page.close();
}

/* ── reduced motion is honoured completely ─────────────────────────  */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const url = new URL(MASTER);
  url.searchParams.set("state", "owner-flight");
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForTimeout(200);
  const longest = await page.evaluate(() =>
    Math.max(0, ...Array.from(document.querySelectorAll("*")).flatMap((el) =>
      getComputedStyle(el).transitionDuration.split(",").map((d) => parseFloat(d) || 0))),
  );
  ok("reduced motion removes every transition", longest <= 0.002, `${longest}s`);
  await page.close();
}

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
