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
async function open({ state, variant, viewport, touch, layout } = {}) {
  const vp = viewport ?? { width: 1440, height: 960 };
  const isTouch = touch ?? vp.width <= 480;
  const context = await browser.newContext({ viewport: vp, isMobile: isTouch, hasTouch: isTouch });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));
  const url = new URL(MASTER);
  if (state) url.searchParams.set("state", state);
  if (variant ?? config.defaultVariant) url.searchParams.set("v", variant ?? config.defaultVariant);
  if (layout) url.searchParams.set("layout", layout);
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

/* ══ Tasks · the 2026-09-02 review ledger ══════════════════════════
   One assertion per confirmed finding, written against the unfixed
   build and watched failing. The board, the list and the phone are
   three code paths, so each claim is driven on the path it was found
   on, with real input. */
const T = '[data-app="tasks"]';
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 960 };
const sayNow = (page) => page.evaluate(() => (document.getElementById("say") || {}).textContent || "");
/* Press a view tab if it is not already the one on screen. The travel
   runs for 460ms; the DOM is final a frame after the press. */
async function chooseView(page, name) {
  const tab = page.locator(`${T} .segItem[data-view="${name}"]`).first();
  if (!(await tab.count())) return false;
  if ((await tab.getAttribute("data-active")) !== null) return true;
  await tab.click();
  await page.waitForTimeout(300);
  return true;
}
/* A real tap or click on the FIRST match of a selector, at its centre. */
async function press(page, selector, touch) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`press: no box for ${selector}`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}

/* ── a tick never moves the floor (both-phone-tick-throws-board) ──── */
{
  const page = await open({ state: "tasks.board", viewport: PHONE, touch: true });
  await chooseView(page, "board");
  const before = await page.evaluate(() => {
    const b = document.querySelector('[data-app="tasks"] .board:not(.listBoard)');
    return b ? b.scrollLeft : -1;
  });
  await press(page, `${T} .tray[data-lane="todo"] .card:not([data-draft]) .tick`, true);
  await page.waitForTimeout(1100);
  const after = await page.evaluate(() => {
    const b = document.querySelector('[data-app="tasks"] .board:not(.listBoard)');
    return {
      left: b ? b.scrollLeft : -1,
      done: !!document.querySelector('[data-app="tasks"] .tray[data-lane="done"] .card[data-done]'),
      undo: !!document.querySelector('[data-app="tasks"] .carry [data-act="undo"]'),
      onBody: document.activeElement === document.body,
    };
  });
  ok("phone board · a tick never moves the floor", before >= 0 && Math.abs(after.left - before) < 2,
    `scrollLeft ${before} → ${after.left}`);
  ok("phone board · the tick completes and offers the way back", after.done && after.undo, JSON.stringify(after));
  await page.close();
}

/* ── the list keeps its place and its keyboard through a tick and an undo
      (both-list-tick-resets, grok-390-undo-loses-focus) ──────────────── */
for (const [label, state, vp, touch] of [["desk", "tasks.dense", DESK, false], ["phone", "tasks.board", PHONE, true]]) {
  const page = await open({ state, viewport: vp, touch });
  const has = await chooseView(page, "list");
  ok(`${label} list · the List view opens`, has, "no List tab");
  if (!has) { await page.close(); continue; }
  const placed = await page.evaluate(() => {
    const list = document.querySelector('[data-app="tasks"] .board.listBoard');
    if (!list) return null;
    list.scrollTop = 160;
    const box = list.getBoundingClientRect();
    const rows = [...list.querySelectorAll(".lrow[data-id]:not([data-done])")];
    const row = rows.find((r) => { const b = r.getBoundingClientRect(); return b.top > box.top + 40 && b.bottom < box.bottom - 60; });
    if (!row) return null;
    const b = row.querySelector(".tick").getBoundingClientRect();
    return { id: row.dataset.id, at: rows.indexOf(row), x: b.left + b.width / 2, y: b.top + b.height / 2,
      top: list.scrollTop, overflow: list.scrollHeight - list.clientHeight };
  });
  ok(`${label} list · a row to tick is on screen`, !!placed, placed ? "" : "no candidate row");
  if (placed) {
    if (touch) await page.touchscreen.tap(placed.x, placed.y); else await page.mouse.click(placed.x, placed.y);
    await page.waitForTimeout(700);
    const after = await page.evaluate((id) => {
      const list = document.querySelector('[data-app="tasks"] .board.listBoard');
      const active = document.activeElement;
      const row = active && active.closest && active.closest(".lrow[data-id]");
      const rows = [...document.querySelectorAll('[data-app="tasks"] .lrow[data-id]')].map((r) => r.dataset.id);
      return { top: list ? list.scrollTop : -1, focusRow: row ? row.dataset.id : null, onBody: active === document.body,
        done: !!document.querySelector('.lrow[data-id="' + id + '"][data-done]'), at: rows.indexOf(id) };
    }, placed.id);
    ok(`${label} list · a tick keeps the list where it was`,
      placed.overflow <= 0 || Math.abs(after.top - placed.top) < 4,
      `scrollTop ${placed.top} → ${after.top} (overflow ${placed.overflow})`);
    ok(`${label} list · focus stays on the row that was ticked`, after.focusRow === placed.id && !after.onBody, JSON.stringify(after));
    ok(`${label} list · the tick completed the row`, after.done, "");
    ok(`${label} list · the row stays under the hand for the undo window`, after.at === placed.at,
      `row ${placed.at} → ${after.at}`);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(500);
    const undone = await page.evaluate((id) => {
      const active = document.activeElement;
      const row = active && active.closest && active.closest(".lrow[data-id]");
      return { focusRow: row ? row.dataset.id : null, undone: !document.querySelector('.lrow[data-id="' + id + '"][data-done]') };
    }, placed.id);
    ok(`${label} list · undo puts the row back and the keyboard on it`, undone.undone && undone.focusRow === placed.id, JSON.stringify(undone));
  }
  await page.close();
}

/* ── the phone list wraps on whole words at two weights
      (opus-mid-word-truncation-list, opus-list-third-weight) ─────────── */
{
  const page = await open({ state: "tasks.board", viewport: PHONE, touch: true });
  await chooseView(page, "list");
  const type = await page.evaluate(() => {
    const out = { rows: 0, clipped: [], nowrap: 0, weights: new Set() };
    for (const el of document.querySelectorAll('[data-app="tasks"] .lrow .lrowTitle, [data-app="tasks"] .lrow .lrowNote, [data-app="tasks"] .lrow .lrowWho')) {
      out.rows += 1;
      const cs = getComputedStyle(el);
      if (cs.whiteSpace === "nowrap" && !el.classList.contains("lrowWho")) out.nowrap += 1;
      if (el.scrollWidth > el.clientWidth + 1) out.clipped.push(el.textContent.trim().slice(0, 24));
      out.weights.add(cs.fontWeight);
    }
    return { rows: out.rows, clipped: out.clipped, nowrap: out.nowrap, weights: [...out.weights] };
  });
  ok("phone list · rows exist to judge", type.rows > 0, "");
  ok("phone list · titles and notes wrap on whole words, nothing is cut mid-word",
    type.nowrap === 0 && type.clipped.length === 0, `${type.nowrap} nowrap · clipped: ${type.clipped.join(" | ")}`);
  ok("phone list · two weights, never a third", type.weights.every((w) => w === "400" || w === "600"), type.weights.join(", "));
  await page.close();
}

/* ── a search miss offers the way back, and the way back works
      (opus-dead-show-all-work) ─────────────────────────────────────────── */
{
  const page = await open({ state: "tasks.board" });
  await page.locator(`${T} .dock .dockInput`).fill("zzqx");
  await page.waitForTimeout(600);
  const miss = await page.evaluate(() => ({
    cards: document.querySelectorAll('[data-app="tasks"] .card[data-id]').length,
    clear: !!document.querySelector('[data-app="tasks"] .emptyBoard [data-act="clear"]'),
  }));
  ok("a search that finds nothing offers the way back", miss.cards === 0 && miss.clear, JSON.stringify(miss));
  if (miss.clear) {
    await press(page, `${T} .emptyBoard [data-act="clear"]`, false);
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => ({
      cards: document.querySelectorAll('[data-app="tasks"] .card[data-id]').length,
      query: (document.querySelector('[data-app="tasks"] .dock .dockInput') || {}).value,
      said: (document.getElementById("say") || {}).textContent || "",
      onBody: document.activeElement === document.body,
    }));
    ok("and the way back works: the board, an empty field, a sentence, and focus somewhere",
      back.cards > 0 && !back.query && /showing all work/i.test(back.said) && !back.onBody, JSON.stringify(back));
  }
  await page.close();
}

/* ── an empty project on the phone says what to do first
      (grok-empty-list-says-showing-all-work, the Opus twin) ───────────── */
{
  const page = await open({ state: "tasks.empty", viewport: PHONE, touch: true });
  await chooseView(page, "list");
  const text = await page.evaluate(() => (document.querySelector('[data-app="tasks"] .sheet') || document.body).innerText.replace(/\s+/g, " "));
  ok("phone list · an empty project says what to do first",
    /Nothing on the board yet\./.test(text) && /Add the first task/.test(text), text.slice(0, 160));
  ok("phone list · and never claims a filter that is not on",
    !/Nothing matches|Showing all work/.test(text), text.slice(0, 160));
  await page.close();
}

/* ── the switcher promises only views that exist (opus-stale-view-doors) ── */
{
  const page = await open({ state: "tasks.board" });
  const doors = await page.evaluate(() => ({
    disabled: document.querySelectorAll('[data-app="tasks"] .segItem[aria-disabled="true"]').length,
    stale: [...document.querySelectorAll('[data-app="tasks"] [title]')].filter((n) => /only view/i.test(n.title)).length,
    tabs: [...document.querySelectorAll('[data-app="tasks"] .segItem')].map((n) => n.textContent.trim()),
  }));
  ok("the view switcher promises only views that exist", doors.disabled === 0 && doors.stale === 0, JSON.stringify(doors));
  await page.close();
}

/* ── search exists on the phone and Ctrl K reaches it (opus-no-phone-search) ── */
{
  const page = await open({ state: "tasks.board", viewport: PHONE, touch: true });
  const field = await page.evaluate(() => {
    const f = [...document.querySelectorAll('[data-app="tasks"] input.dockInput')].find((n) => n.offsetParent !== null);
    if (!f) return null;
    const b = (f.closest(".headSearch, .dockField") || f).getBoundingClientRect();
    return { inHead: !!f.closest(".head"), h: Math.round(b.height), w: Math.round(b.width) };
  });
  ok("phone · search is a real field in the head, at a thumb's size",
    !!field && field.inHead && field.h >= 44, field ? JSON.stringify(field) : "no rendered field");
  await page.evaluate(() => {
    const stop = document.querySelector('[data-app="tasks"] .lrow[tabindex="0"], [data-app="tasks"] .card[tabindex="0"], [data-app="tasks"] .segItem[data-active]');
    if (stop) stop.focus();
  });
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(250);
  const chord = await page.evaluate(() => ({
    focused: !!(document.activeElement && document.activeElement.classList.contains("dockInput") && document.activeElement.offsetParent !== null),
    said: (document.getElementById("say") || {}).textContent || "",
  }));
  ok("phone · Ctrl K reaches it", chord.focused, chord.said);
  ok("phone · and nothing apologises for a search that exists", !/foot of the board/i.test(chord.said), chord.said);
  await page.close();
}

/* ── the lane floor yields: five lanes fit from 1200 up, and Planning never
      deletes Done (opus-board-1280-guillotine, both-planning-drawer).
      R7: this loop used to start at 1180 and prove "five lanes fit" across a
      band where every card note was trimmed — a true statement standing in for
      a board that had stopped saying what to do. The board's floor is 1199 now,
      so the fit claim is asserted where the board is the view, and 1180 gets
      the claim that is actually true there (below). ────────────────────── */
for (const w of [1200, 1280, 1366, 1440]) {
  const page = await open({ state: "tasks.board", viewport: { width: w, height: 900 } });
  await chooseView(page, "board");
  const fit = await page.evaluate(() => {
    const b = document.querySelector('[data-app="tasks"] .board:not(.listBoard)');
    return b ? { over: b.scrollWidth - b.clientWidth, lanes: b.querySelectorAll(".tray").length } : null;
  });
  ok(`board @${w} · five lanes fit with nothing sliced`, !!fit && fit.lanes === 5 && fit.over <= 1, fit ? `${fit.over}px over` : "no board");
  await page.close();
}
/* Below its own floor the board is still reachable, and there it is a scroller
   by design: the lane keeps its specimen width rather than yielding to a width
   it was never going to fit, and the list — not the board — is what the sheet
   opens with. */
{
  const page = await open({ state: "tasks.board", viewport: { width: 1180, height: 900 } });
  const dflt = await page.evaluate(() => {
    const seg = document.querySelector('[data-app="tasks"] .segItem[data-active]');
    return seg ? seg.getAttribute("data-view") : null;
  });
  ok("board @1180 · below the board's floor the list is what opens", dflt === "list", `opened on ${dflt}`);
  await chooseView(page, "board");
  const kept = await page.evaluate(() => {
    const b = document.querySelector('[data-app="tasks"] .board:not(.listBoard)');
    if (!b) return null;
    const lanes = [...b.querySelectorAll(".tray")];
    const widths = lanes.map((t) => Math.round(t.getBoundingClientRect().width));
    return { lanes: lanes.length, min: Math.min(...widths), scrolls: b.scrollWidth > b.clientWidth + 1 };
  });
  ok("board @1180 · chosen below its floor it scrolls rather than slicing a lane",
    !!kept && kept.lanes === 5 && kept.min >= 258 && kept.scrolls === true, JSON.stringify(kept));
  await page.close();
}
{
  const page = await open({ state: "tasks.planning" });
  const seen = await page.evaluate(() => {
    const b = document.querySelector('[data-app="tasks"] .board:not(.listBoard)');
    const d = b && b.querySelector('.tray[data-lane="done"]');
    if (!b || !d) return null;
    const bb = b.getBoundingClientRect(), db = d.getBoundingClientRect();
    return { drawer: !!document.querySelector('[data-app="tasks"] .drawer'), doneLeft: Math.round(db.left), edge: Math.round(bb.right),
      shown: Math.round(Math.min(db.right, bb.right) - db.left) };
  });
  ok("planning open @1440 · Done is still on the board, not deleted by the drawer",
    !!seen && seen.drawer && seen.doneLeft < seen.edge - 96, seen ? JSON.stringify(seen) : "no board");
  await page.close();
}

/* ── the card reads in full on a desk (opus-card-body-clamp, T19).
      R7 card-note-unreadable-1100-to-1279: the two board loops straddled the
      band — five lanes were proved to FIT at 1180 and a note proved to READ
      only at 1280, so nothing checked reading between them. 1279 is the width
      the clamp media query used to cut at. ──────────────────────────── */
for (const w of [1200, 1279, 1280, 1440]) {
  const page = await open({ state: "tasks.board", viewport: { width: w, height: 900 } });
  await chooseView(page, "board");
  const cards = await page.evaluate(() => ({
    hiClipped: [...document.querySelectorAll('[data-app="tasks"] .cardFoot > .hi')].filter((n) => n.scrollWidth > n.clientWidth + 1).length,
    notesCut: [...document.querySelectorAll('[data-app="tasks"] .card:not([data-draft]) .cardNote')].filter((n) => /…$/.test(n.textContent)).length,
    notes: document.querySelectorAll('[data-app="tasks"] .cardNote').length,
    titlesCut: [...document.querySelectorAll('[data-app="tasks"] .card:not([data-draft]) .cardTitle')].filter((n) => /…$/.test(n.textContent)).length,
    cutTitles: [...document.querySelectorAll('[data-app="tasks"] .card:not([data-draft]) .cardTitle')].filter((n) => /…$/.test(n.textContent)).map((n) => n.closest(".tray").dataset.lane + ": " + n.textContent),
  }));
  ok(`board @${w} · the priority word is never cut`, cards.hiClipped === 0, `${cards.hiClipped} clipped`);
  ok(`board @${w} · a card's note is read in full on a desk`, cards.notes > 0 && cards.notesCut === 0, `${cards.notesCut} of ${cards.notes} trimmed`);
  ok(`board @${w} · and its title is not trimmed either`, cards.titlesCut === 0, cards.cutTitles.join(" | ") || `${cards.titlesCut} titles trimmed`);
  await page.close();
}

/* ── R7 dense-lane-fold-reads-as-end-of-list: a column that hides ten of its
      thirty-two tasks said so with a hairline drawn in the same --line value
      as every card border, and a numeral 630px away at the far right of the
      lane head. The residue is now a word in the Add row, and the fold is a
      different line from the thirty it sits among. ─────────────────────── */
for (const w of [1920, 1440]) {
  const page = await open({ state: "tasks.dense", viewport: { width: w, height: 1000 } });
  await chooseView(page, "board");
  const lanes = await page.evaluate(() => {
    const out = [];
    for (const tray of document.querySelectorAll('[data-app="tasks"] .tray')) {
      const body = tray.querySelector(".trayBody");
      if (!body) continue;
      const cards = [...body.querySelectorAll(".card:not([data-draft])")];
      const bb = body.getBoundingClientRect();
      const whole = cards.filter((c) => c.getBoundingClientRect().bottom <= bb.bottom + 0.5).length;
      const rest = tray.querySelector(".trayRest");
      out.push({
        lane: tray.getAttribute("data-lane"),
        hidden: cards.length - whole,
        said: rest && rest.offsetParent ? rest.textContent.trim() : null,
      });
    }
    const tray = document.querySelector('[data-app="tasks"] .tray');
    const cs = getComputedStyle(tray, "::after").backgroundColor;
    /* Compare against the line the cards are actually drawn in rather than
       against a token name — the claim is that the fold reads as a different
       line from the thirty it sits among, not that it holds a chosen value. */
    const probe = document.createElement("span");
    probe.style.color = "var(--line)";
    tray.append(probe);
    const line = getComputedStyle(probe).color; probe.remove();
    return { out, cs, resolved: line };
  });
  const folded = lanes.out.filter((l) => l.hidden > 0);
  ok(`dense @${w} · a column that hides cards says how many, in words`,
    folded.length > 0 && folded.every((l) => l.said === l.hidden + " more below"),
    JSON.stringify(lanes.out));
  ok(`dense @${w} · and a column that hides nothing says nothing`,
    lanes.out.filter((l) => l.hidden === 0).every((l) => l.said === null),
    JSON.stringify(lanes.out.filter((l) => l.hidden === 0)));
  ok(`dense @${w} · the fold rule is not the line every card border is drawn in`,
    lanes.cs !== lanes.resolved && lanes.cs !== "rgba(0, 0, 0, 0)",
    `fold ${lanes.cs} · card border ${lanes.resolved}`);
  await page.close();
}

/* ── R7 seam-landing-reported-four-ways: at the one moment that justifies the
      suite existing, the desk answered once-asked four times — the sent
      sentence printed three times, two controls carrying data-act="open-task"
      233px apart, and the reassurance doubled. The phone already rendered the
      right shape (2 printings, 1 control); the desk now matches it. ────── */
{
  const page = await open({ state: "notes.seam", viewport: { width: 1440, height: 960 } });
  await page.click('[data-app="notes"] [data-act="send"]');
  await page.waitForTimeout(220);
  const seen = await page.evaluate(() => {
    const root = document.querySelector('[data-app="notes"]');
    const receipt = root.querySelector(".peelSent");
    const wording = receipt ? receipt.textContent.trim().replace(/[.\u2026]+$/, "") : null;
    const vis = (n) => !!n.offsetParent && getComputedStyle(n).visibility !== "hidden";
    /* The picked words inside the note are the note, not a report of the
       landing — the whole promise is that they are still sitting where they
       were written. Everything else that prints the sentence is reporting. */
    let printed = 0;
    if (wording) {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const host = n.parentElement;
        if (!host || !vis(host)) continue;
        if (host.closest(".pick, .readBody, .handBody, .topField")) continue;
        if (n.nodeValue.includes(wording)) printed++;
      }
    }
    return {
      wording,
      printed,
      openTask: [...root.querySelectorAll('[data-act="open-task"]')].filter(vis).length,
      deskFactLink: [...root.querySelectorAll(".deskFactLink")].filter(vis).length,
      focus: document.activeElement ? document.activeElement.getAttribute("data-act") : null,
    };
  });
  ok("seam @1440 · the landing is reported once, not four ways",
    !!seen.wording && seen.printed <= 2, JSON.stringify(seen));
  ok("seam @1440 · one control opens the task, not two 233px apart",
    seen.openTask === 1, JSON.stringify(seen));
  ok("seam @1440 · and the send leaves the keyboard on the control that survives",
    seen.focus === "open-task", `focus on ${seen.focus}`);
  await page.close();
}

/* ── R7 three-keycaps-for-one-keyboard-model: tasks.css:1566 states the rule
      — "One keycap in the product" — and the suite had re-created the drift
      threefold: two families, two sizes, two weights, four letterfits, three
      radii, and in Timeline no box at all. Three of the hosts are in states no
      gate visits (the carry HUD, the review actions, a moment's editor), so
      this drives to them and censuses every cap it can reach. ────────────── */
{
  const caps = [];
  const census = async (page, where) => {
    const found = await page.evaluate(() => {
      const vis = (n) => !!n.offsetParent && getComputedStyle(n).visibility !== "hidden";
      return [...document.querySelectorAll('[data-app] kbd')].filter(vis).map((k) => {
        const c = getComputedStyle(k);
        return {
          app: k.closest("[data-app]").getAttribute("data-app"),
          text: k.textContent.trim(),
          family: c.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          size: c.fontSize,
          weight: c.fontWeight,
          track: k.dataset.keys === "arrows" ? "exception" : c.letterSpacing,
          radius: c.borderTopLeftRadius,
          ring: c.borderTopWidth !== "0px" || c.boxShadow !== "none",
          height: Math.round(k.getBoundingClientRect().height * 10) / 10,
        };
      });
    });
    for (const f of found) caps.push({ where, ...f });
  };

  let page = await open({ state: "tasks.board", viewport: { width: 1440, height: 960 } });
  await chooseView(page, "board");
  await census(page, "tasks.dock");
  await page.evaluate(() => {
    const card = document.querySelector('[data-app="tasks"] .card:not([data-draft])');
    card.focus();
    card.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(160);
  await census(page, "tasks.carry");
  await page.close();

  page = await open({ state: "notes.seam", viewport: { width: 1440, height: 960 } });
  await census(page, "notes.seam");
  await page.close();
  page = await open({ state: "notes.review", viewport: { width: 1440, height: 960 } });
  await census(page, "notes.review");
  await page.close();
  page = await open({ state: "notes.voice", viewport: { width: 1440, height: 960 } });
  await census(page, "notes.voice");
  await page.close();

  /* Timeline's cap sits on the undo strip, which is empty — and its cap
     hidden — until something is undoable. Add a moment, then move it, so the
     strip has a sentence and the cap is on screen to be measured. */
  page = await open({ state: "timeline.owner-flight", viewport: { width: 1440, height: 960 } });
  await page.evaluate(async () => {
    const add = document.querySelector('[data-app="timeline"] [data-act="add"]');
    if (add) add.click();
    await new Promise((r) => setTimeout(r, 420));
    const later = document.querySelector('[data-app="timeline"] [data-act="later"], [data-app="timeline"] .b-step');
    if (later) later.click();
    await new Promise((r) => setTimeout(r, 420));
  });
  await page.waitForTimeout(240);
  await census(page, "timeline.edit");
  await page.close();

  const spec = (c) => [c.family, c.size, c.weight, c.radius, c.ring].join("|");
  const shapes = [...new Set(caps.map(spec))];
  ok("the suite has one keycap, not three",
    caps.length >= 3 && shapes.length === 1,
    `${caps.length} caps · ${shapes.length} shapes · ${shapes.join("  ///  ")}`);
  const tracks = [...new Set(caps.filter((c) => c.track !== "exception").map((c) => c.track))];
  ok("and one letterfit on it, declared rather than inherited",
    tracks.length === 1, `${tracks.length}: ${tracks.join(", ")}`);
  const heights = caps.map((c) => c.height);
  ok("and every cap is the same box, within a pixel",
    caps.length >= 3 && Math.max(...heights) - Math.min(...heights) <= 1,
    `${Math.min(...heights)}–${Math.max(...heights)}px`);
  const apps = [...new Set(caps.map((c) => c.app))];
  ok("and the census reached all three products",
    apps.length === 3, apps.join(", "));
  const sizes = [...new Set(caps.map((c) => c.size))];
  ok("and the keycap does not invent a ramp step for itself",
    sizes.every((v) => v === "11px"), sizes.join(", "));
}

/* ── R7 lead-tick-off-its-own-date (+ …-in-across, one defect, two seats):
      Direction B's whole claim is that position on the measure is
      daysFromToday x pixels-per-day. On the across axis the one mark the
      design accents as "this one, next" was the only mark plotted at the
      wrong distance — 28px left of its own stem, which is 1.4 days early at
      1920 and 4.7 days early at 768. Both gates passed because neither ever
      compared a tick's centre with its own item's anchor. ──────────────── */
for (const w of [1920, 1440, 1280, 768]) {
  const page = await open({ state: "timeline.owner-flight", viewport: { width: w, height: 1000 }, layout: "across" });
  const ticks = await page.evaluate(() => {
    const m = document.querySelector('[data-app="timeline"] .b-measure[data-across="true"]');
    if (!m) return null;
    return [...m.querySelectorAll(".b-item")].map((it) => {
      const t = it.querySelector(".b-tick");
      if (!t) return null;
      const ib = it.getBoundingClientRect(), tb = t.getBoundingClientRect();
      return { lead: it.getAttribute("data-lead") === "true", dx: Math.round((tb.left + tb.width / 2 - ib.left) * 10) / 10 };
    }).filter(Boolean);
  });
  const worst = ticks ? ticks.reduce((a, b) => (Math.abs(b.dx) > Math.abs(a.dx) ? b : a), ticks[0]) : null;
  ok(`across @${w} · every tick sits on its own date, the accented one included`,
    !!ticks && ticks.length > 1 && ticks.every((t) => Math.abs(t.dx) <= 0.5),
    worst ? `worst ${worst.dx}px${worst.lead ? " (the lead mark)" : ""}` : "no across measure");
  await page.close();
}

/* ── R7 notes-h1-says-all-your-notes-while-filtered: the index head, the scope
      button's accessible name and a filled release pill all told the truth
      while the one sentence that names what is on the sheet kept saying "All
      your notes" with 11 of 14 hidden. ──────────────────────────────────── */
for (const w of [1280, 1920]) {
  const page = await open({ state: "notes.notebook", viewport: { width: w, height: 960 } });
  const before = await page.evaluate(() => {
    const h = document.querySelector('[data-app="notes"] h1.headName');
    return h ? h.textContent.trim() : null;
  });
  await page.click('[data-app="notes"] [data-act="scope"]');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const h = document.querySelector('[data-app="notes"] h1.headName');
    const rows = document.querySelectorAll('[data-app="notes"] .idxRow').length;
    return { name: h ? h.textContent.trim() : null, rows, pressed: document.querySelector('[data-app="notes"] [data-act="scope"]').getAttribute("aria-pressed") };
  });
  ok(`notebook @${w} · the head stops claiming the whole notebook once it is narrowed`,
    after.pressed === "true" && !!after.name && !/all your notes/i.test(after.name),
    `"${after.name}" over ${after.rows} rows`);
  await page.click('[data-app="notes"] [data-act="unscope"]');
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => {
    const h = document.querySelector('[data-app="notes"] h1.headName');
    return h ? h.textContent.trim() : null;
  });
  ok(`notebook @${w} · and says it again when the notebook comes back`,
    back === before && /all your notes/i.test(back || ""), `"${back}" (was "${before}")`);
  await page.close();
}

/* ── R7 card-open-note-state-is-unreachable: openNoteId was assigned null at
      fourteen sites and a task id at none, so every card with a note shipped a
      permanent aria-expanded="false" that role=article does not support
      anyway, and five CSS rules could never match. ─────────────────────── */
{
  const page = await open({ state: "tasks.board", viewport: { width: 1440, height: 960 } });
  await chooseView(page, "board");
  const dead = await page.evaluate(() => ({
    expanded: document.querySelectorAll('[data-app="tasks"] .card[aria-expanded]').length,
    open: document.querySelectorAll('[data-app="tasks"] .card[data-open]').length,
    hoverRule: [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } })
      .filter((r) => r.selectorText && /\.card\[aria-expanded\]|\.card\[data-open\]/.test(r.selectorText)).length,
    notes: document.querySelectorAll('[data-app="tasks"] .cardNote').length,
    darkens: (() => {
      const n = document.querySelector('[data-app="tasks"] .card:not([data-draft]) .cardNote');
      if (!n) return false;
      const card = n.closest(".card");
      return [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } })
        .some((r) => r.selectorText && /:hover .cardNote/.test(r.selectorText) && card.matches(r.selectorText.split(":hover")[0].split(",").pop().trim()));
    })(),
  }));
  ok("board · no card ships a state nothing can ever set",
    dead.expanded === 0 && dead.open === 0 && dead.hoverRule === 0, JSON.stringify(dead));
  ok("board · and the note still darkens under the pointer",
    dead.notes > 0 && dead.darkens === true, JSON.stringify(dead));
  await page.close();
}

/* ── R7 keyboard-drop-has-no-undo: the card advertises aria-keyshortcuts
      "Space ArrowUp ArrowDown ArrowLeft ArrowRight", and the Space branch of
      onKey mutated the lane without ever calling arm(). The identical move by
      mouse, and by the Move menu, was undoable. ───────────────────────── */
{
  const page = await open({ state: "tasks.board", viewport: { width: 1440, height: 960 } });
  await chooseView(page, "board");
  const carried = await page.evaluate(async () => {
    const card = document.querySelector('[data-app="tasks"] .tray[data-lane="todo"] .card:not([data-draft])');
    const id = card.getAttribute("data-id"), title = card.querySelector(".cardTitle").textContent.trim();
    card.focus();
    const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
    key(" "); await new Promise((r) => setTimeout(r, 120));
    key("ArrowRight"); await new Promise((r) => setTimeout(r, 120));
    key("ArrowRight"); await new Promise((r) => setTimeout(r, 120));
    key(" "); await new Promise((r) => setTimeout(r, 260));
    const landed = document.querySelector(`[data-app="tasks"] .card[data-id="${id}"]`);
    const movedTo = landed ? landed.closest(".tray").getAttribute("data-lane") : null;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 320));
    const back = document.querySelector(`[data-app="tasks"] .card[data-id="${id}"]`);
    const live = document.querySelector('[data-app="tasks"] [role="status"], [data-app="tasks"] .sr[aria-live], [aria-live="polite"]');
    return { title, movedTo, backIn: back ? back.closest(".tray").getAttribute("data-lane") : null, said: live ? live.textContent.trim() : "" };
  });
  ok("board · a card carried by keyboard and dropped can be taken back",
    carried.movedTo && carried.movedTo !== "todo" && carried.backIn === "todo",
    JSON.stringify(carried));
  ok("board · and the suite does not answer \"nothing left to undo\" while it can",
    !/nothing left to undo/i.test(carried.said), carried.said);
  await page.close();
}

/* ── R7 seam-undo-denied-in-the-room-it-sent-you-to: three independent undo
      stacks, each answering only for its own product — so the ONE act that by
      definition crosses products was the one act whose reversal the surface
      denied, in a false sentence, inside the 30-second window its own strip
      was advertising. ───────────────────────────────────────────────────── */
{
  const page = await open({ state: "notes.seam", viewport: { width: 1440, height: 960 } });
  await page.click('[data-app="notes"] [data-act="send"]');
  await page.waitForTimeout(240);
  await page.click('[data-app="notes"] [data-act="open-task"]');
  await page.waitForTimeout(420);
  const crossed = await page.evaluate(async () => {
    const inTasks = !!document.querySelector('[data-app="tasks"]');
    const cards = () => document.querySelectorAll('[data-app="tasks"] .card:not([data-draft])').length;
    const was = cards();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 400));
    const live = [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent.trim()).filter(Boolean).join(" | ");
    return { inTasks, was, now: cards(), said: live, focus: document.activeElement ? document.activeElement.className : null };
  });
  ok("seam · the one act that crosses products can be undone from the room it sent you to",
    crossed.inTasks && crossed.now === crossed.was - 1, JSON.stringify(crossed));
  ok("seam · and the suite never says \"nothing left to undo\" while the window is open",
    !/nothing left to undo/i.test(crossed.said), crossed.said);
  ok("seam · and the keyboard is not left on the card that was just removed",
    crossed.focus !== null && !/^card\b/.test(crossed.focus || ""), String(crossed.focus));
  await page.close();
}

/* ── R7 arrival-invisible-to-the-hand: driven by keyboard the seam's payoff
      paints a focus ring; driven by pointer it appended the card fourth in To
      Do with nothing to distinguish it from the other thirteen. The already-
      authored .card[data-settling] hook was dead by the same test that killed
      openNoteId, so the arrival and the drop-settle are now one idea. ───── */
{
  const page = await open({ state: "notes.seam", viewport: { width: 1440, height: 960 } });
  await page.click('[data-app="notes"] [data-act="send"]');
  await page.waitForTimeout(240);
  await page.click('[data-app="notes"] [data-act="open-task"]');
  await page.waitForTimeout(90);
  const seen = await page.evaluate(() => {
    const c = document.querySelector('[data-app="tasks"] .card[data-settling]');
    if (!c) return { settling: false };
    const cs = getComputedStyle(c);
    return { settling: true, dur: cs.animationDuration, ease: cs.animationTimingFunction, name: cs.animationName };
  });
  ok("seam · the arrival is visible to the hand, not only to the keyboard",
    seen.settling === true, JSON.stringify(seen));
  ok("seam · and it is on the declared motion ladder",
    seen.settling && ["0.4s", "0.22s", "0.14s"].includes(seen.dur) &&
      /cubic-bezier\(0.23, 1, 0.32, 1\)|cubic-bezier\(0.77, 0, 0.175, 1\)/.test(seen.ease),
    JSON.stringify(seen));
  await page.close();
}

/* ── R7 the-approach-vanishes-while-you-place-a-moment: Timeline is Direction
      B, The Approach — the organising object is a distance. In the across desk
      layout, opening the editor pushed all eight .b-grab handles off screen, so
      the one act the direction exists for was performed blind. The down layout
      keeps three of eight, because .b-two is a real two-pane grid there. ── */
for (const w of [1280, 1440, 1920]) {
  const page = await open({ state: "timeline.owner-flight", viewport: { width: w, height: 1000 }, layout: "across" });
  const placed = await page.evaluate(async () => {
    const onScreen = () => [...document.querySelectorAll('[data-app="timeline"] .b-grab')]
      .filter((g) => { const b = g.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 0; }).length;
    const add = document.querySelector('[data-app="timeline"] [data-act="add"]');
    if (!add) return null;
    const total = document.querySelectorAll('[data-app="timeline"] .b-grab').length;
    add.click();
    await new Promise((r) => setTimeout(r, 380));
    const withEditor = onScreen();
    const step = document.querySelector('[data-app="timeline"] [data-act="later"], [data-app="timeline"] [data-step="+7"], [data-app="timeline"] .b-step[data-dir="later"]');
    if (step) { step.click(); await new Promise((r) => setTimeout(r, 380)); }
    return { total, withEditor, afterStep: onScreen() };
  });
  ok(`across @${w} · placing a moment is not done blind`,
    !!placed && placed.withEditor >= 1 && placed.afterStep >= 1,
    placed ? `${placed.withEditor} of ${placed.total} on screen with the editor open, ${placed.afterStep} after a step` : "no editor");
  await page.close();
}

/* ── R7 seam-card-repeats-its-own-title / seam-payoff-card-stutters (one
      defect, two seats): the guard at src/app.js:707 exists to stop a note
      repeating its own title and compares raw strings, so a single trailing
      full stop defeated it on the one card the whole suite argument produces.
      Guarded on the normalised comparison, not the literal sentence, so a
      re-worded fixture cannot quietly re-open it. ───────────────────────── */
{
  const page = await open({ state: "notes.seam", viewport: { width: 1440, height: 960 } });
  await page.click('[data-app="notes"] [data-act="send"]');
  await page.waitForTimeout(240);
  await page.evaluate(() => {
    const r = document.querySelector('[data-app="notes"] .peelSent');
    window.__R7_SENT = r ? r.textContent.trim() : "";
  });
  await page.click('[data-app="notes"] [data-act="open-task"]');
  await page.waitForTimeout(420);
  const card = await page.evaluate(() => {
    /* Find the landed card by its own wording. Reaching for the first To Do
       card instead made this pass on a card the seam never produced — the
       absence-reads-as-a-pass trap this lab has now paid for eleven times. */
    const want = (window.__R7_SENT || "").toLowerCase().replace(/[….,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
    const c = [...document.querySelectorAll('[data-app="tasks"] .card:not([data-draft])')].find((n) => {
      const t = n.querySelector(".cardTitle");
      return t && t.textContent.toLowerCase().replace(/[….,;:!?]+$/g, "").replace(/\s+/g, " ").trim() === want;
    });
    if (!c) return null;
    const norm = (v) => (v || "").toLowerCase().replace(/[….,;:!?]+$/g, "").replace(/\s+/g, " ").trim();
    const t = c.querySelector(".cardTitle"), n = c.querySelector(".cardNote");
    return { title: t ? t.textContent.trim() : null, note: n ? n.textContent.trim() : null,
      same: !!t && !!n && norm(t.textContent) === norm(n.textContent),
      spoken: c.getAttribute("aria-describedby") ? [...document.querySelectorAll("#" + c.getAttribute("aria-describedby").split(/\s+/).join(", #"))].map((x) => x.textContent.trim()).join(" ") : "" };
  });
  ok("seam · the card the suite exists to produce is the one that landed",
    !!card && !!card.title, JSON.stringify(card));
  ok("seam · the card the suite exists to produce does not say its title twice",
    !!card && card.same === false, JSON.stringify(card));
  ok("seam · and does not say it twice to a screen reader either",
    !!card && !(card.note && card.spoken.split(card.note).length > 2), JSON.stringify(card));
  await page.close();
}

/* ── R7 one-filing-field-four-names: one control, four visible names and three
      spoken grammars — and "What it is about" is already the name of the index
      head's sort toggle on the same screen. ────────────────────────────── */
{
  const names = { labels: [], aria: [] };
  const census = async (page) => {
    const got = await page.evaluate(() => {
      const out = { labels: [], aria: [] };
      for (const b of document.querySelectorAll('[data-app="notes"] [data-act="refile"], [data-app="notes"] [data-act="repick-destination"]')) {
        if (!b.offsetParent) continue;
        const host = b.closest(".deskFact") || b.parentElement;
        const lab = host ? host.querySelector("b") : b.querySelector("b");
        if (lab) out.labels.push(lab.textContent.trim());
        out.aria.push(b.getAttribute("aria-label") || "");
      }
      return out;
    });
    names.labels.push(...got.labels);
    names.aria.push(...got.aria);
  };
  /* The writing desk carries no filing control until a note is on it, and the
     reading desk is one click away — a census that stops at the index sees
     none of the four names the finding is about. */
  let page = await open({ state: "notes.notebook", viewport: { width: 1440, height: 960 } });
  await page.click('[data-app="notes"] .idxRow');
  await page.waitForTimeout(300);
  await census(page);
  await page.close();
  page = await open({ state: "notes.seam", viewport: { width: 1440, height: 960 } });
  await census(page);
  /* The opening clause is the grammar: "Filing this under", "This note is
     about", "This task is filed under:" — three verbs, one with a colon. */
  const grammars = [...new Set(names.aria.map((a) => a.split(" ").slice(0, 3).join(" ")))];
  ok("notebook · the filing field has one name, not four",
    names.labels.length > 0 && new Set(names.labels.map((l) => l.toLowerCase())).size === 1,
    names.labels.join(" / "));
  ok("notebook · and one spoken grammar, not three",
    names.aria.length > 0 && grammars.length === 1, grammars.join(" / "));
  ok("notebook · and does not borrow the sort toggle's own words",
    !names.labels.some((l) => /what it is about/i.test(l)), names.labels.join(" / "));
  await page.close();
}

/* ── R7 compact-density-is-a-reachable-unaudited-state: Show → Compact is one
      click and sixteen rules key off it, but it was in no gate's state list, so
      a reachable configuration carried a 10.5px type size off the declared
      ramp — on the one piece of card metadata read on every row. ───────── */
for (const w of [1440, 1280]) {
  const page = await open({ state: "tasks.compact", viewport: { width: w, height: 960 } });
  await chooseView(page, "board");
  const dense = await page.evaluate(() => {
    const root = document.querySelector('[data-app="tasks"]');
    const when = root.querySelector(".when");
    return { density: root.getAttribute("data-density"), size: when ? getComputedStyle(when).fontSize : null };
  });
  ok(`compact @${w} · the state the switch can reach is on the type ramp`,
    dense.density === "compact" && dense.size === "11px", JSON.stringify(dense));
  await page.close();
}

/* ── R7 completion-sentence-counts-the-same-notes-twice: the last thing you see
      after clearing the queue counted the same notes twice — "8 notes went
      through. 8 notes stayed here." — on the one screen whose job is relief,
      and Keep is the flow's only one-press outcome, so this is its default
      ending rather than an edge case. ─────────────────────────────────── */
{
  const page = await open({ state: "notes.review", viewport: { width: 1440, height: 960 } });
  const said = await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      const keep = document.querySelector('[data-app="notes"] [data-act="d-keep"]');
      if (!keep || !keep.offsetParent) break;
      keep.click();
      await new Promise((r) => setTimeout(r, 150));
    }
    /* Match on the sentence itself rather than on a guessed class name: a
       selector that finds nothing would otherwise hand this check the whole
       app's text and let it pass on a screen it never reached. */
    const all = [...document.querySelectorAll('[data-app="notes"] *')]
      .map((n) => n.textContent.replace(/\s+/g, " ").trim())
      .filter((t) => /went through\./.test(t));
    return all.length ? all[all.length - 1] : null;
  });
  ok("review · the queue actually empties and says so",
    typeof said === "string" && /went through\./.test(said), String(said));
  const nums = (String(said).match(/\b(\d+) notes?\b/g) || []).map((m) => m.match(/\d+/)[0]);
  ok("review · the completion sentence does not count the same notes twice",
    nums.length < 2 || nums[0] !== nums[1], String(said).slice(0, 200));
  await page.close();
}

/* ── the no-day fact is on the head and it is a door, on both devices
      (grok-planning-has-no-door, kept as the master's rule) ──────────── */
for (const [label, vp, touch] of [["desk", DESK, false], ["phone", PHONE, true]]) {
  const page = await open({ state: "tasks.board", viewport: vp, touch });
  const door = await page.evaluate(() => {
    const doors = [...document.querySelectorAll('[data-app="tasks"] .head [data-act="planning"]')].filter((n) => n.offsetParent !== null);
    return { doors: doors.length, saysNoDay: doors.some((n) => /with no day/.test(n.textContent)), text: doors.map((n) => n.textContent.trim()).join(" · ") };
  });
  ok(`${label} · the no-day fact is on the head and it is a door`, door.doors > 0 && door.saysNoDay, JSON.stringify(door));
  if (door.doors) {
    await press(page, `${T} .head [data-act="planning"]`, touch);
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => ({
      drawer: !!document.querySelector('[data-app="tasks"] .drawer'),
      state: document.querySelector('[data-app="tasks"]').getAttribute("data-state"),
    }));
    ok(`${label} · and it opens Planning`, opened.drawer && opened.state === "planning", JSON.stringify(opened));
  }
  await page.close();
}

/* ── the tools are one Show control with a real menu model ───────────── */
{
  const page = await open({ state: "tasks.board" });
  const btn = `${T} .viewTools [data-act="tool"][data-tool="show"]`;
  const exists = await page.locator(btn).count();
  ok("the tools are one Show control", exists === 1, `${exists} found`);
  if (exists === 1) {
    await press(page, btn, false);
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => {
      const pop = document.querySelector('[data-app="tasks"] .toolPop');
      const a = document.activeElement;
      return { pop: !!pop, role: pop && pop.getAttribute("role"), items: pop ? pop.querySelectorAll('[role="menuitemradio"]').length : 0,
        focusInside: !!(pop && a && pop.contains(a)), first: a && a.textContent.trim().slice(0, 20) };
    });
    ok("Show opens as a menu and the keyboard is in it", opened.pop && opened.role === "menu" && opened.items >= 3 && opened.focusInside, JSON.stringify(opened));
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    const moved = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim().slice(0, 20));
    ok("the arrows walk it", !!moved && moved !== opened.first, `${opened.first} → ${moved}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = await page.evaluate(() => ({
      pop: !!document.querySelector('[data-app="tasks"] .toolPop'),
      back: document.activeElement && document.activeElement.getAttribute("data-tool"),
    }));
    ok("Escape closes it and returns to the word that opened it", !closed.pop && closed.back === "show", JSON.stringify(closed));
  }
  await page.close();
}

/* ── one fact, one place: the filter sentence is said once in the list
      (grok-duplicate-hidden-sentence, checked on the master) ─────────── */
{
  const page = await open({ state: "tasks.board" });
  await chooseView(page, "list");
  await press(page, `${T} .head [data-act="late"]`, false);
  await page.waitForTimeout(500);
  const sites = await page.evaluate(() =>
    [...document.querySelectorAll('[data-app="tasks"] .sheet *')]
      .filter((el) => el.children.length === 0 && /others are hidden|overdue task/.test(el.textContent)
        && !el.closest(".sr") && el.getBoundingClientRect().width > 2)
      .map((el) => el.className + ": " + el.textContent.trim().slice(0, 50)));
  ok("filtered list · the sentence is said once", sites.length === 1, sites.join(" | ") || "not said at all");
  await page.close();
}

/* ══ Notes · the 2026-09-02 review ledger ══════════════════════════ */
const NOTES = '[data-app="notes"]';

/* ── review fits the phone, and every decision is on the sheet
      (both-notes-review-390-sideways) ─────────────────────────────── */
{
  const page = await open({ state: "notes.review", viewport: PHONE, touch: true });
  const r = await page.evaluate(() => {
    const acts = [...document.querySelectorAll('[data-app="notes"] .phoneSheetFoot .act')];
    const primary = document.querySelector('[data-app="notes"] .phoneSheetFoot .act[data-primary]');
    const pb = primary && primary.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      acts: acts.length,
      inside: acts.every((a) => { const b = a.getBoundingClientRect(); return b.width > 0 && b.left >= -1 && b.right <= innerWidth + 1; }),
      primaryWide: !!pb && pb.width >= innerWidth * 0.7,
    };
  });
  ok("phone review · nothing scrolls sideways", r.overflow <= 1, `${r.overflow}px`);
  ok("phone review · every decision is on the sheet and the first move has the line", r.acts >= 3 && r.inside && r.primaryWide, JSON.stringify(r));
  await page.close();
}

/* ── the head is not a count; the way into review is a quiet control in
      the index head, and it works (opus-notes-chip-and-kbd) ─────────── */
{
  const page = await open({ state: "notes.notebook" });
  const h = await page.evaluate(() => {
    const d = document.querySelector('[data-app="notes"] .indexHead [data-act="review"]');
    const cs = d && getComputedStyle(d);
    return {
      pill: !!document.querySelector('[data-app="notes"] .head .chip'),
      kbd: !!document.querySelector('[data-app="notes"] .indexHead kbd'),
      door: d ? { text: d.textContent.trim(), size: cs.fontSize, fill: cs.backgroundColor, weight: cs.fontWeight } : null,
    };
  });
  ok("notes head · no filled count on the capture surface, no keycap on a heading", !h.pill && !h.kbd, JSON.stringify(h));
  ok("notes · the way into review is a quiet 13px text control in the index head",
    !!h.door && /\d+ to decide/.test(h.door.text) && h.door.size === "13px" && h.door.weight === "400" && /rgba\(0, 0, 0, 0\)|transparent/.test(h.door.fill),
    JSON.stringify(h.door));
  if (h.door) {
    await press(page, `${NOTES} .indexHead [data-act="review"]`, false);
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => document.querySelector('[data-app="notes"]').getAttribute("data-state"));
    ok("notes · and it opens review", st === "review", String(st));
  }
  await page.close();
}

/* ── one measure, centred, at the widest desk (both-index-measure-at-wide) ── */
{
  const page = await open({ state: "notes.notebook", viewport: { width: 1920, height: 1000 } });
  const m = await page.evaluate(() => {
    const pile = document.querySelector('[data-app="notes"] .pile');
    const head = document.querySelector('[data-app="notes"] .indexHead');
    const sheet = document.querySelector('[data-app="notes"] .sheet');
    if (!pile || !head || !sheet) return null;
    const p = pile.getBoundingClientRect(), i = head.getBoundingClientRect(), s = sheet.getBoundingClientRect();
    const gutter = parseFloat(getComputedStyle(head).paddingLeft) || 0;
    return { paper: Math.round(p.width), index: Math.round(i.width - gutter * 2),
      left: Math.round(p.left - s.left), right: Math.round(s.right - p.right) };
  });
  ok("notes @1920 · the index and the paper share one measure, and it is a measure",
    !!m && Math.abs(m.paper - m.index) <= 2 && m.index <= 1130, m ? JSON.stringify(m) : "no stack");
  ok("notes @1920 · the stack is centred, not banded to one side",
    !!m && Math.abs(m.left - m.right) <= 4 && m.left >= 60, m ? JSON.stringify(m) : "no stack");
  await page.close();
}

/* ── dictation says the true thing in two sentences (opus-voice-privacy-paragraph) ── */
{
  const page = await open({ state: "notes.voice" });
  const t = await page.evaluate(() => ((document.querySelector('[data-app="notes"] .darkNote') || {}).textContent || "").trim());
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  ok("dictation · the disclosure is two plain sentences, not a policy", sentences.length === 2 && t.length <= 110 && !/speech service|retention|provider/i.test(t), t);
  await page.close();
}

/* ── the seam renders on the phone (opus-seam-state-at-390) ───────── */
{
  const page = await open({ state: "notes.seam", viewport: PHONE, touch: true });
  const s = await page.evaluate(() => {
    const sheet = document.querySelector('[data-app="notes"] .phoneSheet[role="dialog"]');
    const send = sheet && [...sheet.querySelectorAll("button")].find((b) => /send to tasks/i.test(b.textContent));
    const sb = send && send.getBoundingClientRect();
    return { sheet: !!sheet, peel: !!(sheet && sheet.querySelector(".peel")), send: !!send,
      sendH: sb ? Math.round(sb.height) : 0, sendOn: !!sb && sb.top >= 0 && sb.bottom <= innerHeight };
  });
  ok("phone seam · the fixture opens the sheet with the peel out and Send to Tasks in reach",
    s.sheet && s.peel && s.send && s.sendH >= 44 && s.sendOn, JSON.stringify(s));
  await page.close();
}

/* ══ Timeline · the 2026-09-02 review ledger ═══════════════════════ */
const TL = '[data-app="timeline"]';

/* ── the head tells the truth and the moment is the control
      (opus-gap-sentence-lies, opus-publish-is-the-primary, opus-edit-labels-noise) ── */
{
  const page = await open({ state: "timeline.owner-flight" });
  const r = await page.evaluate(() => {
    const gap = document.querySelector('[data-app="timeline"] .b-gapNote');
    const next = [...document.querySelectorAll('[data-app="timeline"] .b-measure:not(.b-back) .b-item')]
      .some((el) => Number(el.getAttribute("data-away")) > 0);
    const primary = [...document.querySelectorAll('[data-app="timeline"] .b-bar .b-act[data-primary="true"]')].map((b) => b.textContent.trim());
    const outline = [...document.querySelectorAll('[data-app="timeline"] .b-bar .b-act:not([data-primary="true"])')].map((b) => b.textContent.trim());
    const grabs = [...document.querySelectorAll('[data-app="timeline"] .b-measure:not(.b-back) .b-grab')];
    const words = grabs.filter((g) => { const w = g.querySelector(".b-grabWord"); if (!w) return false; const b = w.getBoundingClientRect(); return b.width > 2 && b.height > 2; }).length;
    const boxes = grabs.filter((g) => { const b = g.getBoundingClientRect(); return b.width >= 40 && b.height >= 20; }).length;
    const named = grabs.filter((g) => /\d{4}|July|August|September|October/.test(g.getAttribute("aria-label") || "")).length;
    const title = document.querySelector('[data-app="timeline"] .b-measure:not(.b-back) .b-item .b-title');
    const cs = title && getComputedStyle(title);
    return { gapShown: !!gap && !gap.hidden && !!gap.textContent.trim(), gapText: gap ? gap.textContent.trim() : null, next,
      primary, outline, grabs: grabs.length, words, boxes, named, underline: cs ? cs.textDecorationLine : null };
  });
  ok("timeline · no gap sentence names a day that holds a moment", r.next && !r.gapShown, r.gapText || "silent");
  ok("timeline · Add a moment is the filled act, the link and Preview are outline",
    r.primary.length === 1 && r.primary[0] === "Add a moment" && r.outline.length >= 2, JSON.stringify({ primary: r.primary, outline: r.outline }));
  ok("timeline · the moment is its own control: no Edit words, every control a real box with the date in its name",
    r.grabs >= 5 && r.words === 0 && r.boxes === r.grabs && r.named === r.grabs, JSON.stringify(r));
  ok("timeline · the affordance at rest is a hairline under the title", /underline/.test(r.underline || ""), String(r.underline));
  await page.close();
}

/* ── labels never leave the stage, across, on a tablet (both-across-768-clipping) ── */
{
  const page = await open({ state: "timeline.owner-flight", viewport: { width: 768, height: 1024 } });
  await page.evaluate(() => { const b = document.querySelector('[data-layout-to="across"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const m = document.querySelector('[data-app="timeline"] .b-measure[data-across="true"]');
    if (!m) return null;
    const box = m.getBoundingClientRect();
    const out = [];
    for (const el of m.querySelectorAll(".b-copy, .b-away, .b-terminus")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.left < box.left - 1 || b.right > box.right + 1) out.push(el.className + " " + Math.round(b.left) + ".." + Math.round(b.right) + " vs " + Math.round(box.left) + ".." + Math.round(box.right));
    }
    const day = [...m.querySelectorAll('.b-item[data-anchor="true"] .b-title')].map((t) => t.getBoundingClientRect());
    return { out, scrolls: m.getAttribute("data-scrolls"), dayOn: day.length > 0 && day.every((b) => b.right <= innerWidth + 1 && b.left >= -1) };
  });
  ok("timeline across @768 · the composition is offered", !!r, r ? "" : "no across measure");
  ok("timeline across @768 · every label stays on the stage and the day is on screen", !!r && r.out.length === 0 && r.dayOn, r ? (r.out[0] || JSON.stringify(r)) : "");
  await page.close();
}

/* ── the phone: down only, two acts, and the next moment on the first screen
      (both-phone-first-moment-below-fold) ─────────────────────────────── */
{
  const page = await open({ state: "timeline.owner-flight", viewport: PHONE, touch: true });
  const r = await page.evaluate(() => {
    const toggle = document.querySelector('[data-app="timeline"] .b-layout');
    const acts = [...document.querySelectorAll('[data-app="timeline"] .b-bar .b-act')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim());
    const first = document.querySelector('[data-app="timeline"] .b-measure:not(.b-back) .b-item');
    const num = document.querySelector('[data-app="timeline"] .b-num');
    return { toggle: !!toggle && toggle.offsetParent !== null, acts, firstTop: first ? Math.round(first.getBoundingClientRect().top) : null,
      numOn: !!num && num.getBoundingClientRect().bottom <= innerHeight, more: !!document.querySelector('[data-app="timeline"] [data-act="more"]') };
  });
  ok("phone timeline · no layout toggle, one filled act and a door", !r.toggle && r.acts.length === 2 && r.acts[0] === "Add a moment" && r.more, JSON.stringify(r));
  ok("phone timeline · the 79 and the next moment share the first screen", r.numOn && r.firstTop !== null && r.firstTop + 40 <= 844, `first moment top ${r.firstTop}`);
  await press(page, `${TL} [data-act="more"]`, true);
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const menu = document.querySelector('[data-app="timeline"] .b-menu');
    const items = menu ? [...menu.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent.trim()) : [];
    return { open: !!menu && !menu.hidden, items, focusIn: !!(menu && menu.contains(document.activeElement)) };
  });
  ok("phone timeline · the door opens a real menu with Preview and the link", m.open && m.items.length === 2 && m.focusIn, JSON.stringify(m));
  await page.close();
}

/* ── a new moment lands tomorrow with its editor above the line (L21–L26) ── */
{
  const page = await open({ state: "timeline.owner-flight" });
  await press(page, `${TL} .b-bar [data-act="add"]`, false);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const fresh = [...document.querySelectorAll('[data-app="timeline"] .b-measure:not(.b-back) .b-item')].find((el) => /^moment-\d+$/.test(el.getAttribute("data-id")) && el.getAttribute("data-away") === "1");
    const edit = document.querySelector("#b-edit");
    const measure = document.querySelector('[data-app="timeline"] .b-measure:not(.b-back)');
    const undo = document.querySelector('[data-app="timeline"] .b-undo');
    return { fresh: !!fresh, title: fresh ? fresh.querySelector(".b-title").textContent.trim() : null,
      editorOpen: !!edit, above: !!(edit && measure) && edit.getBoundingClientRect().top < measure.getBoundingClientRect().top,
      dateField: !!(edit && edit.querySelector("#b-edit-date")), undo: !!undo && undo.getBoundingClientRect().height > 0,
      layout: document.querySelector('[data-app="timeline"]').getAttribute("data-layout"),
      focusIn: !!(edit && edit.contains(document.activeElement)) };
  });
  ok("timeline · Add a moment lands tomorrow, named as what it is", r.fresh && r.title === "New moment", JSON.stringify(r));
  /* R7 the-approach-vanishes-while-you-place-a-moment: "above the line" is the
     DOWN layout's law, and asserting it on the across desk is what kept the
     defective placement green — there the editor between the horizon band and
     the track pushed all eight grab handles off the bottom of the screen, so
     the one act the direction exists for was performed blind. Each layout is
     now held to its own law: above the line where the plan is a pane beside
     it, after the plan where the plan is the horizontal measure. What both
     share — the date field, the keyboard, undo in view — is asserted once. */
  ok("timeline · its editor opens with the date in it, the keyboard in it and undo in view",
    r.editorOpen && r.dateField && r.undo && r.focusIn, JSON.stringify(r));
  ok("timeline · and on the across desk it opens after the plan, not across it",
    r.layout !== "across" || r.above === false, JSON.stringify(r));
  await page.close();
}
{
  /* The down layout's own law is not "above the line" — there .b-two is a real
     two-pane grid, so the editor sits BESIDE the plan and the moments stay on
     screen. That is what has to hold, and it is what the across desk was
     failing: whichever way the plan is drawn, placing a moment is not done
     blind. */
  const page = await open({ state: "timeline.owner-flight", layout: "down" });
  await press(page, `${TL} .b-bar [data-act="add"]`, false);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const onScreen = [...document.querySelectorAll('[data-app="timeline"] .b-grab')]
      .filter((g) => { const b = g.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 0; }).length;
    return { editorOpen: !!document.querySelector("#b-edit"),
      total: document.querySelectorAll('[data-app="timeline"] .b-grab').length, onScreen };
  });
  ok("timeline · and on the down layout the plan is a pane beside it, so moments stay on screen",
    r.editorOpen && r.onScreen >= 1, JSON.stringify(r));
  await page.close();
}

/* ── the publish page tells one story (grok-live-or-draft, the Opus twin) ── */
{
  const page = await open({ state: "timeline.owner-flight" });
  await press(page, `${TL} [data-act="publish"]`, false);
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const head = (document.querySelector('[data-app="timeline"] .b-pressTitle, [data-app="timeline"] .b-pressHead') || {}).textContent || "";
    const strap = [...document.querySelectorAll('[data-app="timeline"] .b-inert')].map((e) => e.textContent.trim());
    const text = (document.querySelector('[data-app="timeline"] .b-field') || document.body).innerText;
    return { had: /have had this since/i.test(text), next: /sending comes next/i.test(text), strap };
  });
  ok("timeline publish · never 'had this since' beside 'sending comes next'", !(r.had && r.next), JSON.stringify(r));
  await page.close();
}

/* ══ Suite · the 2026-09-02 review ledger ═════════════════════════ */

/* ── every door answers on screen (both-doors-answer-silently) ────── */
for (const [label, vp, touch] of [["desk", DESK, false], ["phone", PHONE, true]]) {
  const page = await open({ state: "tasks.board", viewport: vp, touch });
  await press(page, '.rail [data-rail="me"]', touch);
  await page.waitForTimeout(350);
  const a = await page.evaluate(() => {
    const pop = document.querySelector(".answerPop");
    const b = pop && pop.getBoundingClientRect();
    return { shown: !!pop && !!b && b.width > 40 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth,
      text: pop ? pop.textContent.replace(/\s+/g, " ").trim() : null };
  });
  ok(`${label} · the account tile answers on screen, in the doors' one grammar`, a.shown && /Your account/.test(a.text || "") && /Not here yet/.test(a.text || ""), JSON.stringify(a));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const gone = await page.evaluate(() => !document.querySelector(".answerPop"));
  ok(`${label} · and Escape takes the answer away`, gone, "");
  await page.close();
}

/* ── Settings is a real card, sentence case, with a keyboard model ── */
{
  const page = await open({ state: "tasks.board" });
  await press(page, '.rail [data-rail="settings"]', false);
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const card = document.querySelector('.setCard[role="dialog"]');
    const tabs = card ? [...card.querySelectorAll(".setTab")].map((t) => t.textContent.trim()) : [];
    const heads = card ? [...card.querySelectorAll("h2, h3, .setLabel")].map((t) => t.textContent.trim()) : [];
    return { card: !!card, modal: card && card.getAttribute("aria-modal"), tabs, heads,
      focusIn: !!(card && card.contains(document.activeElement)),
      sentence: [...tabs, ...heads].every((t) => /^[A-Z]/.test(t)) };
  });
  ok("settings · the door opens a modal card and the keyboard is in it", s.card && s.modal === "true" && s.focusIn, JSON.stringify(s));
  ok("settings · three panes, and every label is sentence case", s.tabs.length === 3 && s.sentence, JSON.stringify({ tabs: s.tabs, heads: s.heads }));
  await press(page, '.setTab[data-set-tab="mail"]', false);
  await page.waitForTimeout(300);
  const mail = await page.evaluate(() => ({ rows: document.querySelectorAll(".setRow").length, radios: document.querySelectorAll('.setSegOpt[role="radio"]').length }));
  ok("settings · the Email pane is a grouped list with real choices", mail.rows >= 3 && mail.radios >= 4, JSON.stringify(mail));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({ card: !!document.querySelector(".setCard"), back: document.activeElement && document.activeElement.getAttribute("data-rail") }));
  ok("settings · Escape closes it and hands the cog back", !closed.card && closed.back === "settings", JSON.stringify(closed));
  await page.close();
}
{
  const page = await open({ state: "tasks.board", viewport: PHONE, touch: true });
  await press(page, '.rail [data-rail="more"]', true);
  await page.waitForTimeout(500);
  const door = await page.evaluate(() => { const d = document.querySelector('.moreItem[data-door="settings"]'); return d ? { live: d.getAttribute("aria-disabled") !== "true", text: d.textContent.trim() } : null; });
  ok("phone · Settings is a live door behind More", !!door && door.live, JSON.stringify(door));
  if (door && door.live) {
    await press(page, '.moreItem[data-door="settings"]', true);
    await page.waitForTimeout(500);
    const card = await page.evaluate(() => { const c = document.querySelector(".setCard"); const b = c && c.getBoundingClientRect(); return { card: !!c, onScreen: !!b && b.bottom <= innerHeight + 1 && b.width <= innerWidth }; });
    ok("phone · and it opens the same card, on screen", card.card && card.onScreen, JSON.stringify(card));
  }
  await page.close();
}

/* ── the project switcher lists Orla's world (both-projects-fixture-leak) ── */
{
  const page = await open({ state: "tasks.board" });
  await press(page, `${T} [data-act="projects"]`, false);
  await page.waitForTimeout(500);
  const p = await page.evaluate(() => [...document.querySelectorAll('[data-app="tasks"] .projItem')].map((n) => n.textContent.replace(/\s+/g, " ").trim()));
  ok("projects · three projects from one world, none from another life",
    p.length >= 3 && p.some((t) => /Winter dinner series/.test(t)) && p.some((t) => /Spring trade fair/.test(t)) && !p.some((t) => /Academic|School|BSc|Business Studies/.test(t)),
    p.join(" | "));
  await page.close();
}

/* ── Tasks' own closed door answers on screen too ─────────────────── */
{
  const page = await open({ state: "tasks.board" });
  await press(page, `${T} .headActions [aria-label="Project settings"]`, false);
  await page.waitForTimeout(350);
  const a = await page.evaluate(() => { const pop = document.querySelector(".answerPop"); return pop ? pop.textContent.replace(/\s+/g, " ").trim() : null; });
  ok("tasks · Project settings answers on screen", !!a && /Project settings/.test(a) && /Not here yet/.test(a), String(a));
  await page.close();
}

/* ── the column at a desk width places every moment and stays clean ──
      Written first, against a build whose horizon reader threw
      "gapSentence is not defined" and left seven moments on one line. */
{
  const before = pageErrors.length;
  const page = await open({ state: "timeline.owner-flight", layout: "down" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const host = document.querySelector('[data-app="timeline"]');
    const items = [...document.querySelectorAll('[data-app="timeline"] .b-measure:not(.b-back) .b-item')];
    const tops = items.map((el) => Math.round(el.getBoundingClientRect().top));
    const gap = document.querySelector('[data-app="timeline"] .b-gapNote');
    return { layout: host && host.getAttribute("data-layout"), n: items.length, distinct: new Set(tops).size,
      gapQuiet: !gap || gap.hidden || !gap.textContent.trim() };
  });
  ok("timeline · down at 1440 · every moment on its own line, the gap note quiet, no errors",
    r.layout === "down" && r.n >= 7 && r.distinct === r.n && r.gapQuiet && pageErrors.length === before,
    JSON.stringify(r) + (pageErrors.length > before ? " · " + pageErrors.slice(before).join(" | ") : ""));
  await page.close();
}

/* ── the crossing itself, not the two widths either side of it ──────
      THE TENTH TIME ABSENCE READ AS A PASS. Every loop in this file, and
      every section of verify.mjs, opens a FRESH page at each viewport.
      Nothing had ever narrowed one page across 720, so three media-query
      listeners the 2 September ledger added were never once executed —
      and one of them referenced a binding from a different IIFE and threw
      `C is not defined` on every crossing, in all three products, inside
      a build four green gates had just frozen.

      A handler that only runs on a TRANSITION needs a test that makes the
      transition. Fresh-at-390 and fresh-at-1440 both pass while the
      journey between them is broken. */
for (const [product, state] of [["tasks", "tasks.board"], ["notes", "notes.notebook"], ["timeline", "timeline.owner-flight"]]) {
  const before = pageErrors.length;
  const page = await open({ state, viewport: DESK });
  await page.waitForTimeout(500);
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(700);
  const narrow = await page.evaluate(() => {
    const host = document.querySelector(".app:not([hidden])");
    const doc = document.documentElement;
    return {
      layout: host && host.getAttribute("data-layout"),
      /* Timeline's two orientation controls belong to the desk. */
      toggles: [...document.querySelectorAll("[data-layout-to]")]
        .filter((el) => el.checkVisibility && el.checkVisibility()).length,
      /* Tasks below 1100 is a list, so a visible five-lane board is the
         board that never re-derived. */
      lanes: [...document.querySelectorAll(".board .tray[data-lane]")]
        .filter((el) => el.checkVisibility && el.checkVisibility()).length,
      rows: document.querySelectorAll(".lrow").length,
      sideways: doc.scrollWidth - doc.clientWidth,
    };
  });
  /* And back, because a crossing has two directions and only one of them
     was ever going to be tried by hand. */
  await page.setViewportSize(DESK);
  await page.waitForTimeout(700);
  const wide = await page.evaluate(() => ({
    lanes: [...document.querySelectorAll(".board .tray[data-lane]")]
      .filter((el) => el.checkVisibility && el.checkVisibility()).length,
    rows: document.querySelectorAll(".lrow").length,
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  const noise = pageErrors.slice(before);
  ok(`${product} · crossing 720 both ways throws nothing`,
    noise.length === 0, noise.join(" | "));
  ok(`${product} · and neither side of the crossing scrolls sideways`,
    narrow.sideways <= 0 && wide.sideways <= 0,
    `narrow ${narrow.sideways}px · wide ${wide.sideways}px`);
  if (product === "timeline") {
    ok("timeline · narrowing to a phone drops the desk composition",
      narrow.layout === "down" && narrow.toggles === 0,
      `layout=${narrow.layout} visible toggles=${narrow.toggles}`);
  }
  if (product === "tasks") {
    ok("tasks · narrowing to a phone becomes the list, and widening returns the board",
      narrow.lanes === 0 && narrow.rows > 0 && wide.lanes >= 5,
      `narrow lanes=${narrow.lanes} rows=${narrow.rows} · wide lanes=${wide.lanes}`);
  }
  await page.close();
}

/* ── reflow on a FINE pointer, which no loop in this file had ────────
      THE ELEVENTH TIME ABSENCE READ AS A PASS. `open()` derives isTouch
      from `vp.isMobile`, and every entry in config.viewports below 480
      sets it — so every "no sideways scroll" assertion in this file has
      only ever run on a COARSE pointer. The one relief for the dictation
      floor's action row lives inside `@media (pointer: coarse)`, so a
      narrowed DESKTOP window — which is exactly the WCAG 1.4.10 reflow
      test — never got it and overflowed by 145px at 320.

      320 is included deliberately: 1.4.10 asks for 320 CSS pixels of
      reflow without two-dimensional scrolling, and it is the width the
      guideline names. */
for (const width of [320, 390, 430]) {
  for (const state of config.states) {
    const page = await open({ state, viewport: { width, height: 844 }, touch: false });
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      return { x: doc.scrollWidth - doc.clientWidth, scrolled: (window.scrollTo(9999, 0), Math.round(window.scrollX)) };
    });
    ok(`${state} @${width} fine pointer · reflows without scrolling sideways`,
      over.x <= 0 && over.scrolled === 0,
      `${over.x}px of overflow, scrollX reached ${over.scrolled}`);
    await page.close();
  }
}

/* ── the outline a screen reader walks ───────────────────────────────
      Ink density is presentational; the heading LEVELS are the document.
      Nothing in this file had ever read them, and Notes was shipping five
      orphan h3s at a desk and, at 390, a sheet whose h1 was pruned by
      `display: none` — one state with no headings in the tree at all. */
for (const width of [1440, 390]) {
  for (const state of config.states) {
    const page = await open({ state, viewport: { width, height: width > 720 ? 960 : 844 }, touch: width <= 480 });
    const outline = await page.evaluate(() => {
      const host = document.querySelector(".app:not([hidden])");
      if (!host) return null;
      const seen = [];
      for (const el of host.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")) {
        /* Only what a reader actually reaches. */
        if (el.closest("[hidden], [aria-hidden=true], [inert]")) continue;
        if (el.checkVisibility && !el.checkVisibility()) {
          /* An sr-only heading is IN the tree; a display:none one is not. */
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
        }
        const lvl = el.getAttribute("aria-level");
        seen.push(Number(lvl || el.tagName.slice(1)));
      }
      return seen;
    });
    const levels = outline || [];
    const skips = levels.filter((n, i) => i > 0 && n - levels[i - 1] > 1);
    ok(`${state} @${width} · the outline starts at h1 and skips no level`,
      levels.length > 0 && levels[0] === 1 && skips.length === 0,
      levels.length ? `levels ${levels.join(",")}` : "no headings in the tree");
    await page.close();
  }
}

/* ── a person's words get the first line ─────────────────────────────
      The recorded lesson, inverted: `align-items: center` floated the
      tick, the person and the priority down to the middle of a two-line
      note, so a column of thirteen ticks wobbled between 13px and 46px
      from its row's top and landed level with line TWO of the note rather
      than the title it ticks. Nothing measured cross-axis alignment
      inside a row. */
for (const width of [1050, 768, 390]) {
  const page = await open({ state: "tasks.board", viewport: { width, height: 900 }, touch: width <= 480 });
  const rows = await page.evaluate(() => {
    const out = [];
    for (const row of document.querySelectorAll(".lrow")) {
      const tick = row.querySelector(".tick");
      const title = row.querySelector(".lrowTitle");
      if (!tick || !title) continue;
      const t = tick.getBoundingClientRect();
      /* The FIRST LINE's box, not the whole wrapped title's. */
      const range = document.createRange();
      range.selectNodeContents(title);
      const first = range.getClientRects()[0];
      if (!first) continue;
      out.push(Math.abs((t.top + t.height / 2) - (first.top + first.height / 2)));
    }
    return out;
  });
  const worst = rows.length ? Math.max(...rows) : -1;
  ok(`tasks list @${width} · the tick sits on its title's first line`,
    rows.length > 0 && worst <= 2,
    rows.length ? `worst ${worst.toFixed(1)}px off across ${rows.length} rows` : "no list rows");
  await page.close();
}

/* ── a closed door says the same thing every closed door says ────────
      Eleven strings said the work "happens on another screen", against
      the ratified noun-phrase grammar — and one of them fused two
      sentences with no full stop, so the live region read "Yours until
      you send something on Your privacy settings are on another screen."
      A door that invents a destination is a door that lies about what
      the product is. */
{
  const page = await open({ state: "notes.notebook" });
  const doors = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[aria-disabled="true"][title]')) {
      out.push(el.getAttribute("title"));
    }
    return out;
  });
  const strays = doors.filter((t) => /another screen/i.test(t));
  const unended = doors.filter((t) => !/Not here yet\./.test(t));
  ok("notes · no closed door invents another screen",
    strays.length === 0, strays.join(" | "));
  ok("notes · every closed door says it is not here yet",
    doors.length > 0 && unended.length === 0,
    doors.length ? unended.join(" | ") : "no closed doors found");
  await page.close();
}

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
