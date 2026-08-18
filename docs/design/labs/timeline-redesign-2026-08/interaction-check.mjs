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
      /* A visually-hidden span is clipped on purpose and is still read
         aloud; it is the opposite of silent deletion. */
      if (cs.clipPath && cs.clipPath !== "none") continue;
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
   screenshot cannot check. Every assertion below exists because a seat
   found the defect it guards by driving the real file; the round it was
   paid for is noted where it is not obvious.
   ═══════════════════════════════════════════════════════════════════ */

const FIXTURE = await (async () => {
  const src = await readFile(path.join(LAB, "fixture.js"), "utf8");
  const sandbox = { window: {} };
  new Function("window", src)(sandbox.window);
  return sandbox.window.__TLFIXTURE;
})();

const AHEAD = FIXTURE.milestones
  .filter((m) => m.state !== "cancelled" && m.date && FIXTURE.daysTo(m.date) > 0)
  .sort((a, b) => FIXTURE.daysTo(a.date) - FIXTURE.daysTo(b.date));

const collisions = (page) => page.evaluate(() => {
  /* The tick and the count sit on the true pixel; the words are what
     must not overlap. So the copy blocks are what get measured. */
  /* Two moments on the same day are one mark with two rows under it —
     a designed adjacency, not an overlap. Everything else must clear. */
  const rects = Array.from(document.querySelectorAll(".b-measure .b-item"))
    .filter((el) => el.getAttribute("data-stack") !== "follow")
    .map((el) => el.querySelector(".b-copy").getBoundingClientRect())
    .sort((a, b) => a.top - b.top);
  let hits = 0;
  for (let i = 1; i < rects.length; i++) if (rects[i].top < rects[i - 1].bottom - 0.5) hits += 1;
  return hits;
});

/* ── the thesis: a pixel is a real unit of time ────────────────────
   If the measure ever stops being strictly proportional the page is
   telling the reader something untrue about how far away their wedding
   is, and no seat would necessarily catch it. */
for (const state of ["phone", "desk", "owner-flight", "print"]) {
  const page = await open({ state });
  const placed = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-measure .b-item")).map((el) => ({
      id: el.getAttribute("data-id"),
      top: el.offsetTop,
      away: Number(el.getAttribute("data-away")),
      shown: Number(el.querySelector(".b-away").textContent),
    })),
  );
  const scales = placed.map((p) => p.top / p.away);
  const spread = Math.max(...scales) - Math.min(...scales);
  ok(`measure is strictly proportional · ${state}`, placed.length >= 5 && spread < 0.001,
    `${placed.length} items, scale spread ${spread.toFixed(4)}`);

  const wrong = placed.filter((p) => {
    const item = AHEAD.find((m) => m.id === p.id);
    return !item || p.away !== FIXTURE.daysTo(item.date) || p.shown !== p.away;
  });
  ok(`every count matches its own date · ${state}`, wrong.length === 0, wrong.map((w) => w.id).join(", "));
  ok(`no two items on the measure collide · ${state}`, (await collisions(page)) === 0);
  await page.close();
}

/* Collisions are measured at every width the two-column band crosses:
   901 was a band the gate never looked at, and it had three. */
for (const width of [320, 390, 768, 901, 1024, 1280, 1440]) {
  for (const state of ["phone", "desk", "owner-flight", "owner-editing"]) {
    const page = await open({ state, viewport: { width, height: 900 } });
    ok(`no collisions · ${state} @ ${width}`, (await collisions(page)) === 0);
    await page.close();
  }
}

/* Side padding written for a phone has to actually apply on a phone. */
for (const state of ["owner-flight", "owner-editing", "desk", "publish", "owner-empty", "print"]) {
  const page = await open({ state, viewport: { width: 390, height: 844 } });
  const pad = await page.evaluate(() => {
    const el = document.querySelector(".b-field");
    const cs = getComputedStyle(el);
    return Math.max(parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight));
  });
  ok(`phone padding applies · ${state}`, pad <= 24, `${pad}px`);
  await page.close();
}

/* ── one number, one accessor ────────────────────────────────────── */
{
  const page = await open({ state: "phone" });
  const read = await page.evaluate(() => ({
    horizon: Number(document.querySelector(".b-num").textContent),
    last: Number(
      Array.from(document.querySelectorAll(".b-measure .b-item")).pop().querySelector(".b-away").textContent,
    ),
    anchors: document.querySelectorAll('.b-item[data-anchor="true"]').length,
    leads: document.querySelectorAll('.b-item[data-lead="true"]').length,
    leadId: document.querySelector('.b-item[data-lead="true"]').getAttribute("data-id"),
    gap: document.querySelector(".b-gapNote").textContent,
  }));
  ok("the horizon count is the fixture count", read.horizon === FIXTURE.toDay(), String(read.horizon));
  ok("the horizon count is the last item on the measure", read.horizon === read.last);
  ok("exactly one item is the day itself", read.anchors === 1);
  ok("exactly one item is the next thing", read.leads === 1);
  ok("the next thing is the nearest future item", read.leadId === AHEAD[0].id, read.leadId);
  /* Stated as a boundary. "The next 16 days" swallowed the day the menu
     tasting falls on, so the sentence was false by one. */
  ok("the gap note names the boundary, not a count",
    read.gap === `Nothing is planned until ${FIXTURE.fmt.medium(AHEAD[0].date)}.`, read.gap);
  await page.close();
}

/* ── unanchored time ─────────────────────────────────────────────── */
for (const state of ["phone", "desk", "print", "owner-flight", "day"]) {
  const page = await open({ state });
  ok(`states today on the surface · ${state}`,
    await page.evaluate(() => /today/i.test(document.body.innerText)));
  await page.close();
}

/* ── the accessibility spine ─────────────────────────────────────── */
for (const state of ["phone", "desk", "print", "owner-flight", "day"]) {
  const page = await open({ state });
  const tree = await page.evaluate(() => {
    const stage = document.querySelector(".tl-stage");
    const h1s = Array.from(stage.querySelectorAll("h1")).map((el) => el.textContent);
    const list = stage.querySelector('[role="list"]');
    const orphans = Array.from(stage.querySelectorAll("[aria-label]")).filter((el) => {
      const role = el.getAttribute("role");
      const native = /^(a|button|input|section|nav|main|img|table)$/i.test(el.tagName);
      return !role && !native;
    }).map((el) => el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    return {
      h1s,
      items: list ? list.querySelectorAll(".b-item").length : 0,
      listitems: list ? list.querySelectorAll('[role="listitem"]').length : 0,
      strayChildren: list
        ? Array.from(list.children).filter((el) => el.getAttribute("role") !== "listitem" && !el.hasAttribute("aria-hidden")).length
        : 0,
      region: !!stage.querySelector('section[aria-label]'),
      orphans,
    };
  });
  ok(`exactly one h1 · ${state}`, tree.h1s.length === 1, tree.h1s.join(" | "));
  ok(`the h1 names the project · ${state}`,
    /Mara|Aisling|Signal Timeline/.test(tree.h1s[0] || ""), tree.h1s[0]);
  ok(`the plan is a region · ${state}`, tree.region);
  ok(`every row is a list item · ${state}`, tree.items === tree.listitems, `${tree.listitems}/${tree.items}`);
  ok(`nothing but rows is a child of the list · ${state}`, tree.strayChildren === 0, String(tree.strayChildren));
  ok(`no label without a role to carry it · ${state}`, tree.orphans.length === 0, tree.orphans.join(", "));
  await page.close();
}

/* Every row says its own distance in words, not only in a column. */
{
  const page = await open({ state: "phone" });
  const spoken = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-measure .b-item")).map((el) => el.textContent),
  );
  ok("every row speaks its unit", spoken.every((t) => /days away/.test(t)), spoken[0]);
  await page.close();
}

/* ── word-safe trimming ──────────────────────────────────────────── */
for (const width of [320, 360, 390, 432, 768, 1280]) {
  const page = await open({ state: "owner-flight", viewport: { width, height: 900 } });
  const trims = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-clamp]")).map((el) => ({
      shown: el.textContent,
      full: el.getAttribute("data-full") || "",
      hidden: el.getAttribute("aria-hidden") === "true",
      twin: (el.nextElementSibling && el.nextElementSibling.getAttribute("data-clamp-full") === "true")
        ? el.nextElementSibling.textContent : null,
      overX: el.scrollWidth - el.clientWidth,
      overY: el.scrollHeight - el.clientHeight,
    })),
  );
  ok(`no clamped text overflows its box @ ${width}`,
    trims.every((t) => t.overX <= 1 && t.overY <= 1),
    trims.filter((t) => t.overX > 1 || t.overY > 1).map((t) => t.shown).join(" | "));
  /* The cut must land on a word boundary, not merely be a prefix: a
     mid-word slice passes a prefix test just as happily. */
  ok(`every trim ends on a whole word @ ${width}`,
    trims.filter((t) => t.shown !== t.full).every((t) => {
      const stem = t.shown.replace(/…$/, "");
      return t.full.startsWith(stem) && (t.full === stem || t.full[stem.length] === " ");
    }),
    trims.filter((t) => t.shown !== t.full).map((t) => t.shown).join(" | "));
  ok(`a trimmed string keeps its whole self in the accessibility tree @ ${width}`,
    trims.filter((t) => t.shown !== t.full).every((t) => t.hidden && t.twin === t.full),
    trims.filter((t) => t.shown !== t.full && t.twin !== t.full).map((t) => t.shown).join(" | "));
  await page.close();
}

/* ── the primary gesture ─────────────────────────────────────────── */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  const editedId = await page.evaluate(() =>
    document.querySelector('.b-item[data-editing="true"]').getAttribute("data-id"));

  const readRow = () => page.evaluate((id) => {
    const item = document.querySelector(`.b-item[data-id="${id}"]`);
    return {
      away: Number(item.getAttribute("data-away")),
      date: item.getAttribute("data-date"),
      shown: item.querySelector(".b-away").textContent,
      dateLine: item.querySelector(".b-date").textContent,
      label: item.querySelector(".b-grab").getAttribute("aria-label"),
      read: document.querySelector(".b-stepRead").textContent,
      top: item.offsetTop,
      gap: document.querySelector(".b-gapNote").textContent,
      body: document.body.innerText,
    };
  }, editedId);

  const boxes = () => page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-step")).map((el) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.x)},${Math.round(r.y)}`;
    }).join(" "));

  const before = await readRow();
  const boxesBefore = await boxes();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.locator('.b-step[aria-label="Move a week earlier"]').click();
  await page.waitForTimeout(320);
  const after = await readRow();

  ok("the stepper moves the edited item nearer", after.top < before.top, `${before.top} → ${after.top}`);
  ok("the count follows the move", after.away === before.away - 7 && after.shown === String(after.away));
  /* Round 1: the row kept printing its old date beside its new count,
     and the readout dropped the date entirely on first touch. */
  ok("the date line follows the move",
    after.dateLine === `${FIXTURE.fmt.weekdayShort(after.date)} ${FIXTURE.fmt.short(after.date)}`, after.dateLine);
  ok("the accessible name follows the move",
    after.label.includes(FIXTURE.fmt.long(after.date)) && after.label.includes(`in ${after.away} days`), after.label);
  ok("the readout never stops naming the date",
    after.read.startsWith(FIXTURE.fmt.longYear(after.date)) && after.read.includes(`in ${after.away} days`), after.read);
  ok("the gap note follows the move",
    after.gap === `Nothing is planned until ${FIXTURE.fmt.medium(after.date)}.`, after.gap);
  ok("no surface ever reads a plural of one", !/\b1 days\b/.test(after.body));
  ok("the steppers do not move under the pointer", (await boxes()) === boxesBefore);
  ok("the page keeps its place through the move",
    (await page.evaluate(() => window.scrollY)) === scrollBefore);
  ok("focus survives the move",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("b-step")));
  ok("one press does not collide the measure", (await collisions(page)) === 0);
  ok("the nearest item is still the one marked",
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(".b-item"))
        .sort((a, b) => Number(a.getAttribute("data-away")) - Number(b.getAttribute("data-away")));
      return items[0].getAttribute("data-lead") === "true"
        && document.querySelectorAll('[data-lead="true"]').length === 1;
    }));

  /* Twenty presses the other way used to place an item seventy days past
     the horizon and hundreds of pixels outside the measure, silently. */
  for (let i = 0; i < 20; i++) {
    const blocked = await page.evaluate(() =>
      document.querySelector('.b-step[data-delta="7"]').getAttribute("aria-disabled") === "true");
    if (blocked) break;
    await page.locator('.b-step[aria-label="Move a week later"]').click({ force: true });
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(320);
  const ceiling = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".b-item"));
    const measure = document.querySelector(".b-measure");
    const box = measure.getBoundingClientRect();
    return {
      max: Math.max(...items.map((el) => Number(el.getAttribute("data-away")))),
      outside: items.filter((el) => el.getBoundingClientRect().bottom > box.bottom + 1).length,
      blocked: document.querySelector('.b-step[data-delta="7"]').getAttribute("aria-disabled"),
      note: document.querySelector(".b-ceiling").textContent,
    };
  });
  ok("nothing can be placed past the day itself", ceiling.max <= FIXTURE.toDay(), String(ceiling.max));
  ok("nothing is placed outside the measure", ceiling.outside === 0, String(ceiling.outside));
  ok("the ceiling states itself rather than absorbing the press",
    ceiling.blocked === "true" && /as far as it goes/.test(ceiling.note), ceiling.note);
  ok("twenty presses do not collide the measure", (await collisions(page)) === 0);
  await page.close();
}

/* ── one reversibility surface, and it works ─────────────────────── */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  const bar = () => page.evaluate(() => {
    const el = document.querySelector(".b-undo");
    return {
      exists: !!el,
      count: document.querySelectorAll(".b-undo").length,
      role: el && el.getAttribute("role"),
      empty: el && el.getAttribute("data-empty"),
      text: el ? el.querySelector(".b-undoText").textContent.trim() : "",
      key: el ? (el.querySelector("kbd") || {}).textContent : "",
      disabled: el ? el.querySelector(".b-undoAct").disabled : true,
    };
  });

  const atRest = await bar();
  ok("a reversibility surface exists", atRest.exists);
  ok("there is exactly one of it", atRest.count === 1);
  ok("it is a live region", atRest.role === "status");
  ok("it names a key", /ctrl|cmd|⌘/i.test(atRest.key), atRest.key);
  /* Round 1: it announced "the invitations moved seven days closer" on
     arrival, before anything had been touched, and its button was dead. */
  ok("it says nothing before anything has happened", atRest.empty === "true" && atRest.text === "", atRest.text);
  ok("its control is disabled before anything has happened", atRest.disabled === true);

  const readAway = () => page.evaluate(() =>
    Number(document.querySelector('.b-item[data-editing="true"]').getAttribute("data-away")));
  const startAway = await readAway();
  await page.locator('.b-step[aria-label="Move a week earlier"]').click();
  await page.waitForTimeout(300);
  const afterMove = await bar();
  ok("it names the change that actually happened",
    /Send the invitations moved 7 days earlier\./.test(afterMove.text), afterMove.text);
  ok("its control is live once there is something to undo", afterMove.disabled === false);

  await page.locator(".b-undoAct").click();
  await page.waitForTimeout(300);
  ok("the control restores the item", (await readAway()) === startAway);
  ok("it falls silent again once there is nothing left to undo",
    (await bar()).empty === "true");

  await page.locator('.b-step[aria-label="Move a day later"]').click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  ok("the advertised key restores the item", (await readAway()) === startAway);
  ok("undo returns focus to the control that made the change",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("b-step")));

  /* Native undo inside a text field is a different promise the browser
     already keeps; hijacking it would trade one defect for another. */
  await page.locator('.b-step[aria-label="Move a day later"]').click();
  await page.waitForTimeout(250);
  const moved = await readAway();
  await page.locator("#b-edit-title").focus();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  ok("undo stays out of the way inside a text field", (await readAway()) === moved);
  await page.close();
}

/* ── the row is the control ──────────────────────────────────────── */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  ok("no editor is open at rest",
    (await page.locator(".b-edit").count()) === 0);
  const overTitle = await page.evaluate(() => {
    const t = document.querySelector(".b-item .b-title").getBoundingClientRect();
    const el = document.elementFromPoint(t.x + 10, t.y + t.height / 2);
    return !!(el && el.closest(".b-grab"));
  });
  ok("the whole row is the target, not the badge alone", overTitle);

  await page.locator(".b-item .b-grab").first().click();
  await page.waitForTimeout(250);
  ok("clicking the row opens the editor", (await page.locator(".b-edit").count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("escape closes it", (await page.locator(".b-edit").count()) === 0);
  ok("escape returns focus to the row that opened it",
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("b-grab")));

  await page.locator(".b-item .b-grab").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  ok("enter opens the editor", (await page.locator(".b-edit").count()) === 1);
  await page.locator('[data-act="done"]').click();
  await page.waitForTimeout(250);
  ok("done closes the editor", (await page.locator(".b-edit").count()) === 0);
  await page.close();
}

/* Visibility is one fact. It was four names, and the toggle did nothing. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  const readVis = () => page.evaluate(() => {
    const item = document.querySelector('.b-item[data-editing="true"]');
    const seg = document.querySelectorAll(".b-seg button");
    return {
      attr: item.getAttribute("data-visibility"),
      chip: item.querySelector(".b-grabWord").textContent,
      mark: item.querySelector(".b-hiddenMark"),
      markSaid: (() => {
        const m = item.querySelector(".b-hiddenMark");
        return m && m.checkVisibility({ contentVisibilityAuto: true }) ? m.textContent : "";
      })(),
      label: item.querySelector(".b-grab").getAttribute("aria-label"),
      pressed: Array.from(seg).map((b) => b.getAttribute("aria-pressed")).join(","),
      words: Array.from(seg).map((b) => b.textContent).join(","),
    };
  });
  const shown = await readVis();
  ok("visibility uses one vocabulary", shown.words === "Shown,Hidden", shown.words);
  /* The control names the ACTION and the row carries the STATE. The
     same word cannot be a status noun on the row and a verb in the
     panel: the obvious guess, press SHOWN to hide it, was wrong in the
     first place a planner would try it. */
  ok("the row control names its own action",
    shown.chip === "Edit", shown.chip);
  ok("a shown moment says nothing about being shown",
    shown.attr === "shown" && shown.markSaid === "" && shown.pressed === "true,false", shown.markSaid);
  await page.locator(".b-seg button", { hasText: "Hidden" }).click();
  await page.waitForTimeout(200);
  const hidden = await readVis();
  ok("the toggle presses", hidden.pressed === "false,true", hidden.pressed);
  ok("the row follows the toggle in ink and in words",
    hidden.attr === "hidden" && /Hidden from guests/.test(hidden.markSaid)
    && /Hidden from guests/.test(hidden.label), hidden.markSaid + " | " + hidden.label);
  ok("the control does not change its own name",
    hidden.chip === "Edit", hidden.chip);

  /* "Take it off the plan" sat under a toggle reading "On the plan". */
  const destructive = await page.evaluate(() =>
    document.querySelector('[data-act="delete"]').textContent);
  ok("the destructive control says what it destroys", destructive === "Delete this moment", destructive);
  const beforeCount = await page.locator(".b-item").count();
  await page.locator('[data-act="delete"]').click();
  await page.waitForTimeout(250);
  ok("delete removes the moment", (await page.locator(".b-item").count()) === beforeCount - 1);
  ok("the measure reflows after a delete", (await collisions(page)) === 0);
  await page.close();
}

/* ── the editor is opaque, and beside the plan ───────────────────── */
for (const width of [390, 768, 1024, 1280, 1440]) {
  const page = await open({ state: "owner-editing", viewport: { width, height: 900 } });
  const plate = await page.evaluate(() => {
    const el = document.querySelector(".b-edit");
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const bg = cs.backgroundColor.match(/[\d.]+/g).map(Number);
    const over = Array.from(document.querySelectorAll(".b-item:not([data-editing]) .b-copy"))
      .filter((other) => {
        const r = other.getBoundingClientRect();
        return r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
      }).length;
    return { alpha: bg.length > 3 ? bg[3] : 1, over, position: cs.position, width: box.width };
  });
  ok(`the editor plate is opaque @ ${width}`, plate.alpha === 1, String(plate.alpha));
  /* In the gutter it must never stand over a row. As a bottom sheet it
     deliberately covers the foot of the measure, and being opaque is
     what makes that legible rather than a double print. */
  if (plate.position !== "fixed") {
    ok(`nothing reads through the editor @ ${width}`, plate.over === 0, `${plate.over} rows`);
  } else {
    ok(`the editor is a sheet on the bottom edge @ ${width}`, plate.position === "fixed");
  }
  ok(`the editor is wide enough to use @ ${width}`, plate.width >= 300, `${Math.round(plate.width)}px`);
  await page.close();
}

/* ── the ground decision ─────────────────────────────────────────── */
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
    pad: parseFloat(getComputedStyle(document.querySelector(".b-print")).paddingLeft),
  }));
  ok("print forces the paper ground even when ink is chosen", forced.attr === "paper", forced.attr);
  ok("print actually paints on paper", forced.bg === "rgb(255, 255, 255)", forced.bg);
  ok("the printed page keeps its own margins", forced.pad >= 56, `${forced.pad}px`);
  await printOnInk.close();
}

/* ── composition ─────────────────────────────────────────────────── */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  const edges = await page.evaluate(() => ({
    bar: Math.round(document.querySelector(".b-bar").getBoundingClientRect().left),
    foot: Math.round(document.querySelector(".b-foot").getBoundingClientRect().left),
    barRight: Math.round(document.querySelector(".b-bar").getBoundingClientRect().right),
    footRight: Math.round(document.querySelector(".b-foot").getBoundingClientRect().right),
  }));
  /* The page opened on a full-measure rule and closed on one that
     started 424px right of every other left edge on the surface. */
  ok("the page closes on the margin it opened on",
    edges.bar === edges.foot && edges.barRight === edges.footRight,
    `${edges.bar}..${edges.barRight} vs ${edges.foot}..${edges.footRight}`);

  const ink = await page.evaluate(() => {
    const range = document.createRange();
    const measureInk = (el) => {
      range.selectNodeContents(el);
      return Math.round(range.getBoundingClientRect().left);
    };
    const item = document.querySelector(".b-item");
    return {
      title: measureInk(item.querySelector(".b-title")),
      date: measureInk(item.querySelector(".b-date")),
      chip: measureInk(item.querySelector(".b-grabWord")),
    };
  });
  ok("the three lines of a row start on one edge",
    Math.abs(ink.title - ink.chip) <= 1 && Math.abs(ink.title - ink.date) <= 1,
    `${ink.title} / ${ink.date} / ${ink.chip}`);
  await page.close();
}

/* Single-object states sit in the room rather than against its ceiling,
   and never centre themselves out of reach. */
for (const state of ["publish", "day", "ended", "loading"]) {
  for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }, { width: 390, height: 520 }]) {
    const page = await open({ state, viewport: vp });
    const box = await page.evaluate(() => {
      const page = document.querySelector(".tl-page");
      const r = page.getBoundingClientRect();
      return {
        top: r.top,
        overflow: document.documentElement.scrollHeight - window.innerHeight,
        height: r.height,
      };
    });
    ok(`nothing is centred out of reach · ${state} @ ${vp.width}x${vp.height}`, box.top >= -1, `${box.top}`);
    await page.close();
  }
}

/* ── the empty state has a failure path ──────────────────────────── */
{
  const page = await open({ state: "owner-empty" });
  await page.locator('[data-act="setday"]').click();
  await page.waitForTimeout(200);
  const refused = await page.evaluate(() => ({
    invalid: document.querySelector("#b-empty-date").getAttribute("aria-invalid"),
    hint: document.querySelector("#b-empty-hint").textContent,
    focused: document.activeElement.id,
  }));
  ok("an empty answer is refused rather than absorbed", refused.invalid === "true", refused.invalid);
  ok("it says what to do instead", /Type the day first/.test(refused.hint), refused.hint);
  ok("it keeps focus in the field", refused.focused === "b-empty-date", refused.focused);
  await page.locator("#b-empty-date").fill("3 October 2026");
  await page.locator('[data-act="setday"]').click();
  await page.waitForTimeout(200);
  ok("a real answer clears the refusal",
    await page.evaluate(() => document.querySelector("#b-empty-date").getAttribute("aria-invalid") === "false"));
  await page.close();
}

/* ── the link is the real link ───────────────────────────────────── */
for (const state of ["unfurl", "publish"]) {
  const page = await open({ state });
  const card = await page.evaluate(() => {
    const el = document.querySelector(".b-unfurl");
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      href: el.getAttribute("href"),
      display: cs.display,
      bg: cs.backgroundColor,
      radius: parseFloat(cs.borderTopLeftRadius),
      w: r.width, h: r.height,
    };
  });
  ok(`the card points at the real share origin · ${state}`,
    card.href === FIXTURE.shareUrlFull && card.href.startsWith("https://timeline.signalstudio.ie/s/"), card.href);
  ok(`the link card is a block · ${state}`, card.display === "block", card.display);
  ok(`the link card paints its own ground · ${state}`, card.bg === "rgb(255, 255, 255)", card.bg);
  ok(`the link card keeps its corners · ${state}`, card.radius >= 8, String(card.radius));
  ok(`the link card is card-shaped · ${state}`, card.w > 240 && card.w <= 302 && card.h > 180,
    `${Math.round(card.w)}×${Math.round(card.h)}`);
  await page.close();
}

/* ── the day tells the truth about the day ───────────────────────── */
{
  const page = await open({ state: "day" });
  const text = await page.evaluate(() => document.body.innerText);
  /* The venue used to be a string literal typed into the renderer in
     two places and presented as a fact about the record. The record has
     no venue field, so the page must not claim one. */
  ok("the day names the day", /Wedding day/.test(text));
  ok("nothing invents a venue the record does not hold",
    !/Wedding day at/.test(text));
  ok("the day names what is happening", /happening now/i.test(text) && /wedding day/i.test(text));
  /* It used to claim everything had happened while a live milestone was
     dated that very morning. */
  ok("the day does not claim the day is over", !/Nothing is left to count/.test(text));
  ok("the day is not a counter that ran out", !/\b0 days\b/.test(text));
  await page.close();
}

/* ── loading tells the truth ─────────────────────────────────────── */
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

/* ── the ended link is still a surface ───────────────────────────── */
{
  const page = await open({ state: "ended" });
  const text = await page.evaluate(() => document.body.innerText);
  /* True whether the link was revoked or simply ran out. The surface
     cannot tell the two apart and used to assert one of them. */
  ok("the ended link says what happened", /stopped working/i.test(text));
  ok("the ended link does not assert a cause it cannot know",
    !/turned off\./i.test(text));
  ok("the ended link names the plan it belonged to",
    text.toLowerCase().includes(FIXTURE.project.name.toLowerCase()));
  ok("the ended link says when the day was",
    text.includes(String(new Date(FIXTURE.project.primaryDate.date).getUTCFullYear())));
  ok("the ended link names who can fix it", text.includes(FIXTURE.workspace.owner));
  ok("the news is the heading", await page.evaluate(() =>
    /stopped working/i.test((document.querySelector("h1") || {}).textContent || "")));
  ok("the ended link says nothing was deleted", /nothing has been deleted/i.test(text));
  await page.close();
}

/* ── motion is physics ───────────────────────────────────────────── */
{
  const page = await open({ state: "owner-editing" });
  const moving = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".b-item"));
    const props = cs.transitionProperty.split(",").map((s) => s.trim());
    const durs = cs.transitionDuration.split(",").map((s) => parseFloat(s));
    const i = props.indexOf("top");
    return { has: i >= 0 && durs[i] > 0, dur: i >= 0 ? durs[i] : 0, ease: cs.transitionTimingFunction };
  });
  ok("the move is animated, because position is the quantity", moving.has, `${moving.dur}s`);
  ok("it uses the declared duration", Math.abs(moving.dur - 0.22) < 0.005, `${moving.dur}s`);
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const url = new URL(MASTER);
  url.searchParams.set("state", "owner-editing");
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForTimeout(250);
  const longest = await page.evaluate(() =>
    Math.max(0, ...Array.from(document.querySelectorAll("*")).flatMap((el) =>
      getComputedStyle(el).transitionDuration.split(",").map((d) => parseFloat(d) || 0))),
  );
  ok("reduced motion removes every transition", longest <= 0.002, `${longest}s`);
  await page.close();
}


/* ══ round 2 · the controls around the gesture ══════════════════════
   The gesture was fixed in round 1 and the panel said everything beside
   it was a promise. These guard the promises.
   ═══════════════════════════════════════════════════════════════════ */

/* The title field. It held the one thing this product is about — a
   person's own words — and discarded them on every path. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.locator("#b-edit-title").fill("Send the invitations to everyone");
  await page.locator("#b-edit-title").dispatchEvent("change");
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const item = document.querySelector('.b-item[data-editing="true"]');
    return {
      shown: item.querySelector(".b-title").textContent,
      full: item.querySelector(".b-title").getAttribute("data-full"),
      label: item.querySelector(".b-grab").getAttribute("aria-label"),
      undo: document.querySelector(".b-undoText").textContent,
    };
  });
  ok("a typed title reaches the row", after.full === "Send the invitations to everyone", after.full);
  ok("a typed title reaches the accessible name",
    after.label.includes("Send the invitations to everyone"), after.label);
  ok("a rename joins the history", /Renamed to/.test(after.undo), after.undo);
  await page.locator(".b-undoAct").click();
  await page.waitForTimeout(200);
  ok("a rename can be taken back", await page.evaluate(() =>
    document.querySelector('.b-item[data-editing="true"] .b-title').getAttribute("data-full")
      === "Send the invitations"));
  await page.close();
}

/* Add a moment. It opened the editor on somebody else's moment. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  const before = await page.evaluate(() => ({
    count: document.querySelectorAll(".b-item").length,
    titles: Array.from(document.querySelectorAll(".b-title")).map((el) => el.getAttribute("data-full") || el.textContent).join("|"),
  }));
  await page.locator('[data-act="add"]').click();
  await page.waitForTimeout(300);
  const added = await page.evaluate(() => ({
    count: document.querySelectorAll(".b-item").length,
    titles: Array.from(document.querySelectorAll(".b-title")).map((el) => el.getAttribute("data-full") || el.textContent).join("|"),
    focused: document.activeElement.id,
    value: (document.querySelector("#b-edit-title") || {}).value,
    undo: document.querySelector(".b-undoText").textContent,
  }));
  ok("add creates a moment", added.count === before.count + 1, `${before.count} → ${added.count}`);
  ok("add changes no existing moment", added.titles.includes(before.titles.split("|")[0]));
  ok("add opens an empty field, focused", added.focused === "b-edit-title" && added.value === "",
    `${added.focused} "${added.value}"`);
  ok("add joins the history", /moment was added/.test(added.undo), added.undo);
  await page.keyboard.press("Escape");
  await page.locator(".b-undoAct").click();
  await page.waitForTimeout(250);
  ok("add can be taken back",
    (await page.evaluate(() => document.querySelectorAll(".b-item").length)) === before.count);
  await page.close();
}

/* Delete. It was the one destructive act and the only one outside the
   reversibility system, and afterwards the bar offered to restore a row
   that no longer existed. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.locator('.b-step[aria-label="Move a week later"]').click();
  await page.waitForTimeout(250);
  const start = await page.evaluate(() => document.querySelectorAll(".b-item").length);
  await page.locator('[data-act="delete"]').click();
  await page.waitForTimeout(300);
  const gone = await page.evaluate(() => ({
    count: document.querySelectorAll(".b-item").length,
    undo: document.querySelector(".b-undoText").textContent,
    active: document.activeElement.tagName,
  }));
  ok("delete removes the moment", gone.count === start - 1, `${start} → ${gone.count}`);
  ok("delete names what it removed", /Send the invitations was removed/.test(gone.undo), gone.undo);
  ok("delete never drops focus to the body", gone.active !== "BODY", gone.active);
  await page.locator(".b-undoAct").click();
  await page.waitForTimeout(300);
  ok("delete can be taken back",
    (await page.evaluate(() => document.querySelectorAll(".b-item").length)) === start);
  ok("the move before the delete is still on the stack",
    /moved 7 days later/.test(await page.evaluate(() => document.querySelector(".b-undoText").textContent)));
  /* The advertised key was bound to the field, so once focus fell to the
     body after a delete it was dead for the rest of the session. */
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  ok("the advertised key still works after a delete",
    (await page.evaluate(() => document.querySelector(".b-undo").getAttribute("data-empty"))) === "true");
  await page.close();
}

/* Hiding a moment from the couple's families is the highest-stakes
   change on the screen and it had no undo and no ink. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  const shown = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.b-item[data-editing="true"] .b-title')).color);
  await page.locator(".b-seg button", { hasText: "Hidden" }).click();
  await page.waitForTimeout(250);
  const hidden = await page.evaluate(() => ({
    colour: getComputedStyle(document.querySelector('.b-item[data-editing="true"] .b-title')).color,
    undo: document.querySelector(".b-undoText").textContent,
  }));
  ok("a hidden moment is drawn quieter, in ink not hue", hidden.colour !== shown,
    `${shown} → ${hidden.colour}`);
  ok("hiding joins the history", /is now hidden from guests/.test(hidden.undo), hidden.undo);
  await page.locator(".b-undoAct").click();
  await page.waitForTimeout(250);
  const back = await page.evaluate(() => ({
    attr: document.querySelector('.b-item[data-editing="true"]').getAttribute("data-visibility"),
    pressed: Array.from(document.querySelectorAll(".b-seg button")).map((b) => b.getAttribute("aria-pressed")).join(","),
  }));
  ok("hiding can be taken back", back.attr === "shown" && back.pressed === "true,false",
    `${back.attr} ${back.pressed}`);
  await page.close();
}

/* The reversibility surface has to be where the change is made. It was
   rendered a thousand pixels below the button that filled it. */
for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }, { width: 1440, height: 960 }]) {
  const page = await open({ state: "owner-editing", viewport: vp });
  await page.locator('.b-step[aria-label="Move a week later"]').click();
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => {
    const el = document.querySelector(".b-undo");
    const r = el.getBoundingClientRect();
    const mid = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + 6));
    return {
      inView: r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0,
      reachable: !!(mid && mid.closest(".b-undo")),
      count: document.querySelectorAll(".b-undo").length,
    };
  });
  ok(`the way back is on screen when it has something to say @ ${vp.width}`, seen.inView);
  ok(`the way back is reachable by pointer @ ${vp.width}`, seen.reachable);
  ok(`there is still exactly one of it @ ${vp.width}`, seen.count === 1, String(seen.count));
  /* Closing the panel must bring the bar home, not destroy it with the
     panel: paintUndo would then have nothing to find for the rest of
     the mount and the surface would be silently dead. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok(`the way back survives closing the panel @ ${vp.width}`, await page.evaluate(() => {
    const el = document.querySelector(".b-undo");
    return document.querySelectorAll(".b-undo").length === 1 && el.getAttribute("data-empty") === "false";
  }));
  await page.close();
}

/* The move is the one animated thing in the product and below the
   gutter width it was happening under the sheet. */
for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  const page = await open({ state: "owner-editing", viewport: vp });
  const band = () => page.evaluate(() => {
    const panel = document.querySelector(".b-edit");
    const fixed = getComputedStyle(panel).position === "fixed";
    const free = fixed ? panel.getBoundingClientRect().top : window.innerHeight;
    const box = document.querySelector('.b-item[data-editing="true"] .b-copy').getBoundingClientRect();
    return { inBand: box.top >= 0 && box.bottom <= free + 1, fixed };
  });
  const onOpen = await band();
  ok(`the row being edited is on screen when it opens @ ${vp.width}`, onOpen.inBand);
  await page.locator('.b-step[aria-label="Move a week earlier"]').click();
  await page.waitForTimeout(400);
  ok(`the move is on screen where it happens @ ${vp.width}`, (await band()).inBand);
  /* A fixed sheet is outside layout, so the column it covers must be
     given the room back or the last rows are unreachable. */
  const reserved = await page.evaluate(() => {
    const field = document.querySelector(".b-field");
    const panel = document.querySelector(".b-edit");
    return parseFloat(getComputedStyle(field).paddingBottom) >= panel.offsetHeight;
  });
  ok(`the sheet reserves its own band @ ${vp.width}`, reserved);
  /* A fixed sheet always covers whatever is behind it at that scroll.
     What must never happen is a control being covered with no scroll
     left to free it — which is exactly what an unreserved band does to
     the last rows. */
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const stranded = await page.evaluate(() => {
    const panel = document.querySelector(".b-edit").getBoundingClientRect();
    return Array.from(document.querySelectorAll(".b-grab")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > panel.top && r.top < panel.bottom;
    }).length;
  });
  ok(`no row control is stranded under the sheet @ ${vp.width}`, stranded === 0, `${stranded} stranded`);
  await page.close();
}

/* Opening a panel that nothing announces, from a control that does not
   say it opened anything, upstream of the rows in tab order. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.locator(".b-item .b-grab").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => ({
    focusInside: !!(document.activeElement && document.activeElement.closest(".b-edit")),
    expanded: document.querySelector('.b-item[data-editing="true"] .b-grab').getAttribute("aria-expanded"),
    named: (document.querySelector(".b-edit") || {}).getAttribute
      ? document.querySelector(".b-edit").getAttribute("aria-label") : "",
    role: document.querySelector(".b-edit").getAttribute("role"),
  }));
  ok("opening the editor moves focus into it", opened.focusInside);
  ok("the control says it opened something", opened.expanded === "true", opened.expanded);
  ok("the panel names the moment it edits", /Editing /.test(opened.named), opened.named);
  ok("the panel is a group", opened.role === "group", opened.role);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("closing says so too", (await page.evaluate(() =>
    document.querySelector(".b-item .b-grab").getAttribute("aria-expanded"))) === "false");
  await page.close();
}

/* A planner told "it has moved to Thursday 10 September" should be able
   to type that on the surface built to remove arithmetic. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.locator("#b-edit-date").fill("10 September 2026");
  await page.locator("#b-edit-date").press("Enter");
  await page.waitForTimeout(300);
  const typed = await page.evaluate(() => {
    const item = document.querySelector('.b-item[data-editing="true"]');
    return {
      date: item.getAttribute("data-date"),
      away: item.getAttribute("data-away"),
      shown: item.querySelector(".b-date").textContent,
      undo: document.querySelector(".b-undoText").textContent,
    };
  });
  ok("a typed date moves the moment", typed.date === "2026-09-10" && typed.away === "56",
    `${typed.date} / ${typed.away}`);
  ok("the row follows a typed date", /10 Sep/.test(typed.shown), typed.shown);
  ok("a typed date joins the history", /moved \d+ days later/.test(typed.undo), typed.undo);

  await page.locator("#b-edit-date").fill("3 December 2026");
  await page.locator("#b-edit-date").press("Enter");
  await page.waitForTimeout(250);
  const refused = await page.evaluate(() => ({
    invalid: document.querySelector("#b-edit-date").getAttribute("aria-invalid"),
    hint: document.querySelector(".b-ceiling").textContent,
    away: document.querySelector('.b-item[data-editing="true"]').getAttribute("data-away"),
  }));
  ok("a date past the day itself is refused", refused.invalid === "true" && refused.away === "56",
    `${refused.invalid} / ${refused.away}`);
  ok("the refusal says why", /as far as it goes/.test(refused.hint), refused.hint);

  await page.locator("#b-edit-date").fill("1 January 2026");
  await page.locator("#b-edit-date").press("Enter");
  await page.waitForTimeout(250);
  ok("a date that has gone is refused", await page.evaluate(() =>
    document.querySelector("#b-edit-date").getAttribute("aria-invalid") === "true"
    && /has gone/.test(document.querySelector(".b-ceiling").textContent)));
  await page.close();
}

/* The ceremony had two buttons and neither did anything, on the screen
   the whole product exists for. */
{
  const page = await open({ state: "publish", viewport: { width: 1440, height: 960 } });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.locator('[data-act="copy"]').click();
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => ({
    label: document.querySelector('[data-act="copy"]').textContent,
    live: document.querySelector(".b-live").textContent,
    role: document.querySelector(".b-live").getAttribute("role"),
  }));
  ok("copy answers on the face of the control", copied.label === "Copied", copied.label);
  ok("copy answers out loud", /copied/i.test(copied.live), copied.live);
  ok("it answers through a live region", copied.role === "status");
  await page.locator('[data-act="owner"]').click();
  await page.waitForTimeout(400);
  ok("there is a way back from the ceremony", await page.evaluate(() =>
    (document.getElementById("deck") || document.body).getAttribute("data-state") === "owner-flight"));
  await page.close();
}

/* Preview reached an audience surface with no way out — and the way out
   must not put owner chrome inside the artifact a guest gets. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.locator('[data-act="preview"]').click();
  await page.waitForTimeout(400);
  ok("preview lands on the artifact", await page.evaluate(() =>
    (document.getElementById("deck") || document.body).getAttribute("data-state") === "desk"));
  ok("the way back sits outside the artifact", await page.evaluate(() =>
    !!document.querySelector(".b-previewStrip")
    && !document.querySelector(".b-field .b-previewStrip")));
  await page.locator('[data-act="owner"]').click();
  await page.waitForTimeout(400);
  ok("the way back works", await page.evaluate(() =>
    (document.getElementById("deck") || document.body).getAttribute("data-state") === "owner-flight"));
  await page.close();
}
{
  const page = await open({ state: "desk" });
  ok("a guest loading the artifact gets no owner chrome",
    (await page.locator(".b-previewStrip").count()) === 0);
  await page.close();
}

/* No control advertises a verb it does not have — proven by pressing it,
   in every state, rather than by checking for an attribute. */
for (const state of ["owner-flight", "owner-empty", "owner-editing", "publish", "phone", "desk", "day"]) {
  const page = await open({ state });
  const dead = [];
  const buttons = await page.locator(".tl-stage button").all();
  for (let i = 0; i < buttons.length; i++) {
    const before = await page.evaluate(() => ({
      html: document.querySelector(".tl-stage").innerHTML.length,
      state: (document.getElementById("deck") || document.body).getAttribute("data-state"),
      active: document.activeElement.className,
    }));
    const label = (await buttons[i].textContent()) || (await buttons[i].getAttribute("aria-label")) || "?";
    await buttons[i].click({ force: true }).catch(() => {});
    await page.waitForTimeout(160);
    const after = await page.evaluate(() => ({
      html: document.querySelector(".tl-stage") ? document.querySelector(".tl-stage").innerHTML.length : -1,
      state: (document.getElementById("deck") || document.body).getAttribute("data-state"),
      active: document.activeElement.className,
    }));
    if (before.html === after.html && before.state === after.state && before.active === after.active) {
      dead.push(label.trim().slice(0, 24));
    }
    if (before.state !== after.state) break;   /* it navigated; the rest belong to another state */
  }
  ok(`every control does something · ${state}`, dead.length === 0, dead.join(", "));
  await page.close();
}

/* The past is listed only if asked for — and the asking has to be a
   control the reader has, not a console knob. */
for (const state of ["phone", "desk"]) {
  const page = await open({ state });
  const fold = await page.evaluate(() => {
    const details = document.querySelector(".b-behindDetails");
    const rows = Array.from(document.querySelectorAll(".b-behindRow"));
    const note = document.querySelector(".b-behindNote");
    return {
      exists: !!details,
      open: details ? details.open : null,
      /* A closed <details> keeps layout boxes for its children in
         Chromium, so a rect test says they are visible when nobody can
         see them. checkVisibility knows about content-visibility. */
      visible: rows.filter((r) => r.checkVisibility({ contentVisibilityAuto: true })).length,
      total: rows.length,
      noteAfterRows: note && rows.length
        ? note.compareDocumentPosition(rows[rows.length - 1]) === Node.DOCUMENT_POSITION_PRECEDING
        : true,
    };
  });
  ok(`the past can be asked for · ${state}`, fold.exists && fold.open === false);
  ok(`the past is folded until it is · ${state}`, fold.visible === 0 && fold.total > 0,
    `${fold.visible}/${fold.total}`);
  ok(`the sentence closes the block · ${state}`, fold.noteAfterRows);
  await page.locator(".b-behindSummary").click();
  await page.waitForTimeout(200);
  ok(`asking shows every one of them · ${state}`, await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-behindRow"))
      .filter((r) => r.checkVisibility({ contentVisibilityAuto: true })).length
    === document.querySelectorAll(".b-behindRow").length));
  await page.close();
}
/* Where the past is LISTED there is no disclosure at all. The old rule
   hid the control in CSS, which took the heading and the count with it
   and left the rows behind a <details> that was still closed — and the
   one assertion here passed by proving the control was gone, which was
   the cause. */
for (const variant of ["approach", "record"]) {
  for (const state of ["print", "desk", "phone"]) {
    const listed = variant === "record" || state === "print";
    if (!listed) continue;
    const page = await open({ state, variant });
    const seen = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".b-behindRow"));
      const label = document.querySelector(".b-behindLabel");
      const count = document.querySelector(".b-behindCount");
      const vis = (el) => !!el && el.checkVisibility({ contentVisibilityAuto: true });
      return {
        rows: rows.length,
        visible: rows.filter(vis).length,
        label: vis(label),
        count: count ? count.textContent : "",
        summaries: document.querySelectorAll(".b-behindSummary").length,
      };
    });
    ok(`the past is listed, not hidden · ${variant}/${state}`,
      seen.rows > 0 && seen.visible === seen.rows, `${seen.visible}/${seen.rows}`);
    ok(`the heading survives · ${variant}/${state}`, seen.label);
    ok(`the count is the number of rows · ${variant}/${state}`,
      seen.count === seen.rows + " moments", seen.count);
    ok(`nothing to press where nothing folds · ${variant}/${state}`, seen.summaries === 0);
    await page.close();
  }
}

/* ═══ round 3 ══════════════════════════════════════════════════════ */

/* The reversibility bar is absolutely positioned inside the editor, and
   at the two widths where the editor is the rail it had no positioned
   ancestor, so it escaped to the sticky column and painted across the
   148px count. */
for (const width of [390, 768, 1280, 1440]) {
  const page = await open({ state: "owner-editing", viewport: { width, height: 900 } });
  await page.waitForTimeout(300);
  await page.locator('.b-step[data-delta="7"]').first().click();
  await page.waitForTimeout(250);
  const band = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().toJSON() : null;
    };
    return { undo: box(".b-undo"), edit: box(".b-edit"), num: box(".b-num") };
  });
  ok(`the bar sits inside the editor · ${width}`,
    !!band.undo && !!band.edit
    && band.undo.top >= band.edit.top - 1 && band.undo.bottom <= band.edit.bottom + 1,
    JSON.stringify(band.undo) + " in " + JSON.stringify(band.edit));
  const clear = !band.num || !band.undo
    || band.undo.bottom <= band.num.top || band.undo.top >= band.num.bottom
    || band.undo.right <= band.num.left || band.undo.left >= band.num.right;
  ok(`the bar never stands on the count · ${width}`, clear);
  await page.close();
}

/* The list calls itself nearest first. It stopped being it on the first
   press, so tab order contradicted the column on screen. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(300);
  const order = async () => page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-item")).map((el) => Number(el.getAttribute("data-away"))));
  for (let i = 0; i < 3; i += 1) {
    await page.locator('.b-step[data-delta="7"]').first().click();
    await page.waitForTimeout(150);
  }
  const after = await order();
  ok("the DOM order is the order the list claims",
    JSON.stringify(after) === JSON.stringify(after.slice().sort((a, b) => a - b)),
    JSON.stringify(after));
  ok("the pressed control still has focus after a reorder",
    await page.evaluate(() => document.activeElement.classList.contains("b-step")));
  await page.close();
}

/* Preview previews the plan as edited, and coming back does not destroy
   the owner's work. Every state remounts from the record, so an edit
   written only to the DOM lasted exactly as long as one screen. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(300);
  const before = await page.locator(".b-item").count();
  await page.locator('[data-act="add"]').click();
  await page.waitForTimeout(300);
  await page.locator("#b-edit-title").fill("Hair trial");
  await page.waitForTimeout(200);
  await page.locator('[data-act="done"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="preview"]').click();
  await page.waitForTimeout(350);
  ok("a moment added is a moment previewed",
    (await page.evaluate(() => document.body.innerText)).includes("Hair trial"));
  await page.locator('[data-act="owner"]').click();
  await page.waitForTimeout(350);
  ok("coming back does not destroy the plan",
    (await page.locator(".b-item").count()) === before + 1,
    String(await page.locator(".b-item").count()));

  /* And hiding a moment hides it from the person it is hidden from. */
  await page.locator(".b-grab").first().click();
  await page.waitForTimeout(300);
  const title = await page.evaluate(() =>
    document.querySelector('.b-item[data-editing="true"] .b-title').textContent);
  await page.locator(".b-seg button", { hasText: "Hidden" }).click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="done"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="preview"]').click();
  await page.waitForTimeout(350);
  const guestSees = await page.evaluate((t) => {
    const artifact = document.querySelector(".b-field");
    return artifact.innerText.includes(t);
  }, title);
  ok("what guests see is what the owner said they would see", !guestSees, title);
  await page.close();
}

/* Focus must not move the page. The browser scrolls to whatever takes
   it, so a delete threw the surface up to 638px away and undo restored
   the moment without restoring the view. */
for (const width of [320, 768, 1024, 1280]) {
  const page = await open({ state: "owner-editing", viewport: { width, height: 900 } });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(100);
  /* Measured on the screen, not on the scroll offset. Removing a row
     changes the height of the document, and the browser's own scroll
     anchoring then moves scrollY BY DESIGN to hold the picture still —
     which is the property that actually matters. The reference is the
     head of the measure: it is in normal flow, it is not sticky, and it
     does not move when a row leaves the plan. */
  const mark = () => page.evaluate(() => {
    const el = document.querySelector(".b-measureHead");
    return el ? el.getBoundingClientRect().top : null;
  });
  /* Pressed through the element itself, because Playwright scrolls a
     control into view before it clicks it and that scroll is the
     harness, not the product. What is measured here is whether the PAGE
     moves under the owner when the plan changes. */
  const press = (sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
  const at = await mark();
  await press('[data-act="delete"]');
  await page.waitForTimeout(350);
  const afterDelete = await mark();
  ok(`deleting does not move the page · ${width}`, Math.abs(afterDelete - at) <= 2,
    `${at} → ${afterDelete}`);
  await press(".b-undoAct");
  await page.waitForTimeout(350);
  const afterUndo = await mark();
  ok(`the way back returns the view · ${width}`, Math.abs(afterUndo - at) <= 2,
    `${at} → ${afterUndo}`);
  await page.close();
}

/* A change of surface lands somewhere and says where. Three of the
   owner's five top-level actions were silent screen changes. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1280, height: 900 } });
  await page.waitForTimeout(300);
  for (const [act, next] of [["preview", "desk"], ["owner", "owner-flight"], ["publish", "publish"]]) {
    await page.locator(`[data-act="${act}"]`).first().click();
    await page.waitForTimeout(350);
    ok(`${act} lands on something`, await page.evaluate(() =>
      document.activeElement && document.activeElement !== document.body));
    ok(`${act} says where it went`, await page.evaluate(() => {
      const live = document.querySelector(".b-live");
      return !!live && live.textContent.trim().length > 0;
    }));
    if (next === "publish") break;
  }
  await page.close();
}

/* The keepsake is a fixed physical artifact and its column count must
   be a fact about the paper, not about the window that previewed it. */
{
  const shapes = [];
  for (const width of [1024, 1280, 1440]) {
    const page = await open({ state: "print", viewport: { width, height: 900 } });
    await page.waitForTimeout(250);
    shapes.push(await page.evaluate(() => {
      const two = document.querySelector(".b-print .b-two");
      const titles = Array.from(document.querySelectorAll(".b-print .b-title"));
      const oneLine = titles.every((t) => {
        const lh = parseFloat(getComputedStyle(t).lineHeight);
        return t.getBoundingClientRect().height <= lh * 1.4;
      });
      return { cols: getComputedStyle(two).gridTemplateColumns, oneLine };
    }));
    await page.close();
  }
  ok("the sheet is one document at every window width",
    shapes.every((s) => s.cols === shapes[0].cols), shapes.map((s) => s.cols).join(" | "));
  ok("no title breaks on the printed sheet", shapes.every((s) => s.oneLine));
}

/* The only link on paper has to be one a person can type. */
{
  const page = await open({ state: "print" });
  const paper = await page.evaluate(() => document.body.innerText);
  const token = await page.evaluate(() => window.__TLCORE.F.token);
  ok("the keepsake prints a link that can be typed",
    paper.includes(token) && !paper.includes(token.toUpperCase()));
  await page.close();
}

/* Every date in the record has to fit its own lane. Two thirds of a
   calendar was breaking the weekday off the day it belonged to. */
for (const [variant, state, click] of [["record", "desk", false], ["approach", "phone", true]]) {
  const page = await open({ state, variant, viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  if (click) { await page.locator(".b-behindSummary").click(); await page.waitForTimeout(200); }
  const lanes = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-behindDate")).map((el) => {
      const cs = getComputedStyle(el);
      return { h: el.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight) };
    }));
  ok(`no date breaks in half · ${variant}/${state}`,
    lanes.length > 0 && lanes.every((l) => l.h <= l.lh * 1.4),
    JSON.stringify(lanes.slice(0, 3)));
  await page.close();
}

/* A moment that was called off says so in words, in the row, so the
   accessible name carries it too. */
for (const [variant, state] of [["record", "phone"], ["record", "desk"]]) {
  const page = await open({ state, variant });
  await page.waitForTimeout(250);
  const off = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".b-behindRow"));
    const cancelled = rows.filter((r) => r.querySelector('[data-cancelled="true"]'));
    return {
      any: cancelled.length,
      said: cancelled.every((r) => /not going ahead/i.test(r.innerText)),
      count: (document.querySelector(".b-behindCount") || {}).textContent,
      rows: rows.length,
    };
  });
  ok(`a cancelled moment says so · ${variant}/${state}`, off.any > 0 && off.said,
    String(off.any));
  ok(`the record counts what it lists · ${variant}/${state}`,
    off.count === off.rows + " moments", off.count + " vs " + off.rows);
  await page.close();
}

/* The only control a guest is ever given has to read as one. */
for (const state of ["phone", "desk", "day"]) {
  const page = await open({ state, viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  const door = await page.evaluate(() => {
    const sum = document.querySelector(".b-behindSummary");
    if (!sum) return null;
    const closed = getComputedStyle(sum, "::after").content;
    sum.parentElement.open = true;
    const opened = getComputedStyle(sum, "::after").content;
    return { h: sum.getBoundingClientRect().height, closed, opened };
  });
  ok(`the door is big enough to press · ${state}`, !!door && door.h >= 44,
    door ? String(door.h) : "missing");
  ok(`the door says whether it is open · ${state}`,
    !!door && door.closed !== "none" && door.opened !== "none" && door.closed !== door.opened,
    door ? door.closed + " → " + door.opened : "missing");
  await page.close();
}

/* An untitled moment has one name, and it is the same name everywhere. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(300);
  await page.locator('[data-act="add"]').click();
  await page.waitForTimeout(350);
  const fresh = await page.evaluate(() => {
    const item = document.querySelector('.b-item[data-editing="true"]');
    return {
      row: item.querySelector(".b-title").textContent,
      label: item.querySelector(".b-grab").getAttribute("aria-label"),
      panel: document.getElementById("b-edit").getAttribute("aria-label"),
    };
  });
  ok("an untitled moment is named once",
    fresh.row === "Untitled moment"
    && fresh.label.indexOf("Edit Untitled moment.") === 0
    && fresh.panel === "Editing Untitled moment",
    JSON.stringify(fresh));
  await page.locator("#b-edit-title").fill("Hair trial");
  await page.waitForTimeout(200);
  const named = await page.evaluate(() => ({
    row: document.querySelector('.b-item[data-editing="true"] .b-title').textContent,
    panel: document.getElementById("b-edit").getAttribute("aria-label"),
  }));
  ok("a typed name reaches the panel that is editing it",
    named.row === "Hair trial" && named.panel === "Editing Hair trial", JSON.stringify(named));
  await page.close();
}

/* Three answers, three sentences. One refusal told a typist to type. */
{
  const page = await open({ state: "owner-empty", viewport: { width: 1280, height: 900 } });
  const says = async (value) => {
    await page.locator("#b-empty-date").fill(value);
    await page.locator('[data-act="setday"]').click();
    await page.waitForTimeout(150);
    return page.evaluate(() => document.querySelector("#b-empty-hint").textContent);
  };
  ok("an empty field is asked for a day", (await says("")).indexOf("Type the day first") === 0);
  ok("an unreadable date is told so", (await says("banana")).indexOf("That is not a date") === 0);
  ok("a day that has gone is told so", (await says("1 January 2020")).indexOf("That day has gone") === 0);
  ok("a real day is accepted", (await says("3 October 2026")).indexOf("The day is set") === 0);
  await page.close();
}

/* Figures are mono; words are not. */
{
  const page = await open({ state: "day" });
  const word = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".b-dayCount"));
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize), weight: cs.fontWeight };
  });
  ok("the morning word is set in the reading face",
    !/mono/i.test(word.family) && word.size === 96, JSON.stringify(word));
  await page.close();
}

/* ═══ round 4 ══════════════════════════════════════════════════════ */

/* The morning is the screen the whole company is judged by, and the
   best idea in the direction was absent from it: the past opened into a
   flat dated table while the measure — real days at real distance —
   was nowhere. Same data, same language, two pixels a day. */
{
  const page = await open({ state: "day", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  await page.locator(".b-behindSummary").click();
  await page.waitForTimeout(250);
  const back = await page.evaluate(() => {
    const measure = document.querySelector(".b-back");
    if (!measure) return null;
    const rows = Array.from(measure.querySelectorAll(".b-item"));
    const px = Number(measure.getAttribute("data-px"));
    return {
      px,
      rows: rows.length,
      head: (document.querySelector(".b-backWrap .b-measureHead") || {}).textContent,
      /* Position IS the quantity, going back exactly as going forward. */
      exact: rows.every((el) =>
        Math.abs(parseFloat(el.style.top) - Number(el.getAttribute("data-away")) * px) < 0.5),
      accent: rows.some((el) => {
        const tick = el.querySelector(".b-tick");
        return tick && getComputedStyle(tick).backgroundColor === "rgb(79, 70, 229)";
      }),
      rail: !!measure.querySelector(".b-rail"),
    };
  });
  ok("the morning draws the past as the instrument", !!back && back.rows > 0 && back.rail,
    back ? String(back.rows) : "missing");
  ok("the past is measured, not listed", !!back && back.exact);
  ok("the past runs at its own scale", !!back && back.px === 2, back ? String(back.px) : "-");
  ok("the past says which way it counts", !!back && back.head === "days back", back ? back.head : "-");
  ok("nothing behind you is the next thing", !!back && !back.accent);
  await page.close();
}

/* The morning names everything dated on it. A second moment on the
   wedding day used to make the wedding itself vanish from its own
   screen, because nothing rendered anything but the first. */
{
  const page = await open({ state: "day" });
  await page.waitForTimeout(200);
  const named = await page.evaluate(() => {
    const F = window.__TLCORE.F;
    const clock = F.project.primaryDate.date;
    const on = F.live().filter((m) => m.date === clock);
    const text = document.body.innerText;
    return { on: on.length, missing: on.filter((m) => text.indexOf(m.title) < 0).map((m) => m.title) };
  });
  ok("the morning names everything happening on it", named.missing.length === 0,
    named.missing.join(", "));
  await page.close();
}

/* The countdown has three states and one owner. It had one, so a
   wedding a day out read "1 DAYS", the morning read "0 DAYS", and the
   week after read "-6 DAYS" at ninety-six pixels. */
for (const k of [2, 1, 0, -3]) {
  const page = await open({ state: "phone" });
  await page.waitForTimeout(150);
  const said = await page.evaluate((n) => {
    const F = window.__TLCORE.F;
    F.project.primaryDate.date = F.plusDays(F.today, n);
    window.__TLCORE.mount();
    const read = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    };
    return {
      num: read(".b-num"), unit: read(".b-unit"),
      word: read(".b-dayCount"), passed: read(".b-passed"),
      text: document.body.innerText,
    };
  }, k);
  if (k > 0) {
    ok(`the count agrees with its unit · ${k}`,
      said.num === String(k) && said.unit === (k === 1 ? "day" : "days"),
      said.num + " " + said.unit);
  } else if (k === 0) {
    ok("the count arrives as a word", said.word === "Today" && said.num === null, String(said.word));
  } else {
    ok("a guest never sees a negative count", !/-\d/.test(said.text) && !!said.passed,
      String(said.passed));
  }
  await page.close();
}

/* The card is a fixed asset that lands in somebody else's chat client,
   so it cannot follow this lab's ground, and its name has to carry what
   it shows. */
for (const variant of ["approach", "paper"]) {
  const page = await open({ state: "unfurl", variant });
  await page.waitForTimeout(200);
  const card = await page.evaluate(() => {
    const og = document.querySelector(".b-og");
    const link = document.querySelector(".b-unfurl");
    return {
      ground: getComputedStyle(og).backgroundColor,
      label: link.getAttribute("aria-label"),
      shown: link.innerText,
    };
  });
  ok(`the card keeps one ground · ${variant}`, card.ground === "rgb(17, 17, 17)", card.ground);
  const figure = (card.shown.match(/\d+/) || [""])[0];
  ok(`the card announces what it shows · ${variant}`,
    !!figure && card.label.indexOf(figure) >= 0, card.label);
  await page.close();
}

/* The publish screen shows the card on a plate, not floating on the
   owner's own ground, where it painted ink on ink. */
{
  const page = await open({ state: "publish", viewport: { width: 1280, height: 900 } });
  await page.waitForTimeout(200);
  ok("the card lands on a plate", await page.evaluate(() => {
    const plate = document.querySelector(".b-chatPlate");
    return !!plate && parseFloat(getComputedStyle(plate).borderTopWidth) >= 1;
  }));
  await page.close();
}

/* The past is stated once. Round 3 opened the rows and left the
   sentence beside them, printing a title the reader could already see
   twelve pixels above it. */
for (const [variant, state] of [["record", "desk"], ["record", "print"], ["approach", "print"]]) {
  const page = await open({ state, variant });
  await page.waitForTimeout(200);
  ok(`the past is stated once · ${variant}/${state}`, await page.evaluate(() => {
    const notes = Array.from(document.querySelectorAll(".b-behindNote"))
      .filter((n) => n.checkVisibility({ contentVisibilityAuto: true }));
    const titles = Array.from(document.querySelectorAll(".b-behindTitle"))
      .filter((n) => n.checkVisibility({ contentVisibilityAuto: true }))
      .map((n) => n.textContent.trim());
    return notes.length === 1 && !titles.some((t) => t && notes[0].textContent.indexOf(t) >= 0);
  }));
  await page.close();
}

/* A cancelled row has no date, and the empty lane went on reserving
   96px while the machine's label took more room than the couple's own
   words. */
{
  const page = await open({ state: "desk", variant: "record", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  const off = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll(".b-behindRow"))
      .filter((r) => r.querySelector('[data-cancelled="true"]'))[0];
    if (!row) return null;
    const title = row.querySelector(".b-behindTitle");
    const lh = parseFloat(getComputedStyle(title).lineHeight);
    const date = row.querySelector(".b-behindDate");
    return {
      oneLine: title.getBoundingClientRect().height <= lh * 1.4,
      lane: date ? getComputedStyle(date).display : "gone",
    };
  });
  ok("a cancelled moment keeps its own words on one line", !!off && off.oneLine);
  ok("an empty lane reserves nothing", !!off && off.lane === "none", off ? off.lane : "-");
  await page.close();
}

/* On a phone there is no hover, so a press had no answer at all until
   the sheet arrived. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  const pressed = await page.evaluate(() => {
    const el = document.querySelector(".b-grab");
    const rest = getComputedStyle(el).backgroundColor;
    const rules = Array.from(document.styleSheets)
      .flatMap((sheet) => { try { return Array.from(sheet.cssRules); } catch (e) { return []; } })
      .filter((r) => r.selectorText && r.selectorText.indexOf(":active") >= 0);
    return { rest, actives: rules.length, tap: getComputedStyle(el).webkitTapHighlightColor };
  });
  ok("a press is answered", pressed.actives > 0, String(pressed.actives));
  ok("no colour nobody chose", /rgba\(0, 0, 0, 0\)|transparent/.test(pressed.tap), pressed.tap);
  await page.close();
}

/* One rhythm for every rule-topped section. It was declared in one
   place and broken by the footer on every state. */
for (const state of ["phone", "day", "owner-flight"]) {
  const page = await open({ state, viewport: { width: 1280, height: 900 } });
  await page.waitForTimeout(200);
  const rhythm = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".b-behind, .b-foot, .b-dayNow")) {
      const cs = getComputedStyle(el);
      if (parseFloat(cs.borderTopWidth) < 1) continue;
      out.push([el.className, cs.marginTop, cs.paddingTop]);
    }
    return out;
  });
  ok(`one rhythm above every rule · ${state}`,
    rhythm.length > 0 && rhythm.every((r) => r[1] === "40px" && r[2] === "20px"),
    JSON.stringify(rhythm));
  await page.close();
}

/* The owner is told the plan is shared. The surface used to be
   byte-identical before and after publishing. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1280, height: 900 } });
  await page.waitForTimeout(200);
  ok("the plan says it is shared", await page.evaluate(() => {
    const el = document.querySelector(".b-shared");
    return !!el && /live since/i.test(el.textContent);
  }));
  await page.close();
}

/* The loading frame stands in for the shape of what is coming, and the
   one sentence readable in both frames does not move. */
{
  const before = await open({ state: "loading", viewport: { width: 390, height: 844 } });
  await before.waitForTimeout(250);
  const skel = await before.evaluate(() => ({
    name: (document.querySelector(".b-who") || {}).textContent,
    widths: Array.from(document.querySelectorAll(".b-skel"))
      .map((el) => Math.round(el.getBoundingClientRect().width)),
    today: document.querySelector(".b-todayLabel").getBoundingClientRect().top,
  }));
  await before.close();
  const after = await open({ state: "phone", viewport: { width: 390, height: 844 } });
  await after.waitForTimeout(250);
  const real = await after.evaluate(() => ({
    name: (document.querySelector(".b-who") || {}).textContent,
    today: document.querySelector(".b-todayLabel").getBoundingClientRect().top,
  }));
  await after.close();
  ok("the loading frame keeps the name the card promised", skel.name === real.name,
    skel.name + " vs " + real.name);
  ok("the frame stands in for the shape, not the column",
    skel.widths.length > 0 && skel.widths.every((w) => w < 300), JSON.stringify(skel.widths));
  ok("nothing hops when the data lands", Math.abs(skel.today - real.today) <= 2,
    skel.today + " → " + real.today);
}

/* The owner's own phone shows the owner their plan. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(300);
  const first = await page.evaluate(() => {
    const el = document.querySelector(".b-item");
    return el ? el.getBoundingClientRect().toJSON() : null;
  });
  ok("the owner sees their first moment without scrolling",
    !!first && first.bottom <= 844, first ? String(Math.round(first.bottom)) : "missing");
  await page.close();
}

/* The morning itself. It carried an eleven-week-old timestamp, named a
   cancelled hotel search as its closing sentence, and printed the one
   fact it exists for twice. */
{
  const page = await open({ state: "day" });
  const day = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      text,
      stamped: /Updated/i.test(text),
      dropped: /not going ahead/i.test(text),
      weddings: (text.match(/wedding day/gi) || []).length,
      count: document.querySelector(".b-dayCount").textContent,
      countSize: parseFloat(getComputedStyle(document.querySelector(".b-dayCount")).fontSize),
      nameSize: parseFloat(getComputedStyle(document.querySelector(".b-dayWrap .b-who")).fontSize),
    };
  });
  ok("the morning carries no stale timestamp", !day.stamped);
  ok("the morning does not close on a cancellation", !day.dropped);
  ok("the morning says the one fact once", day.weddings === 1, String(day.weddings));
  /* A countdown that has arrived is a word, not a zero — and the word
     takes the count's slot rather than being demoted to a micro-label
     while the couple's name is promoted into the display register. */
  ok("the arrived count is a word", day.count === "Today", day.count);
  ok("the arrived count keeps the count's register",
    day.countSize >= 96 && day.countSize > day.nameSize, `${day.countSize} vs ${day.nameSize}`);
  await page.close();
}

/* A project that has never held anything wore another couple's facts. */
{
  const page = await open({ state: "owner-empty" });
  const identity = await page.evaluate(() => ({
    region: document.querySelector("section.b-field").getAttribute("aria-label"),
    h1: document.querySelector("h1").textContent,
    bar: document.querySelector(".b-switch").textContent,
    foot: document.querySelector(".b-foot").textContent,
    hint: document.querySelector("#b-empty-hint").textContent,
  }));
  ok("the region names the project it belongs to", /Aisling/.test(identity.region), identity.region);
  ok("every name on the screen is the same name",
    /Aisling/.test(identity.h1) && /Aisling/.test(identity.bar));
  ok("a project with nothing in it claims no update", !/Updated/.test(identity.foot), identity.foot);
  ok("the date format survives typing", /3 October 2026/.test(identity.hint), identity.hint);
  await page.locator("#b-empty-date").fill("3 October 2026");
  await page.locator('[data-act="setday"]').click();
  await page.waitForTimeout(200);
  ok("a real day is accepted", await page.evaluate(() =>
    document.querySelector("#b-empty-date").getAttribute("aria-invalid") === "false"));
  await page.close();
}

/* Two moments on one day. The measure's law is that position is the
   quantity, and it used to be abandoned at the moment two things
   coincided: one count and one tick painted over another. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.locator('.b-step[aria-label="Move a week earlier"]').click();
  await page.waitForTimeout(400);
  const stacked = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".b-item"))
      .filter((el) => el.getAttribute("data-away") === "16");
    return {
      pair: items.length,
      stacks: items.map((el) => el.getAttribute("data-stack")).join(","),
      marks: items.filter((el) => getComputedStyle(el.querySelector(".b-tick")).visibility === "visible").length,
      counts: items.filter((el) => getComputedStyle(el.querySelector(".b-away")).visibility === "visible").length,
      said: items.map((el) => el.querySelector(".b-unitSaid").textContent).join(" / "),
      tops: items.map((el) => el.offsetTop).join(","),
    };
  });
  ok("two moments can share a day", stacked.pair === 2, String(stacked.pair));
  ok("they share one mark and one count", stacked.marks === 1 && stacked.counts === 1,
    `${stacked.marks} marks, ${stacked.counts} counts`);
  ok("they are grouped, not overprinted", stacked.stacks === "lead,follow", stacked.stacks);
  ok("both stay on the true pixel", stacked.tops === "288,288", stacked.tops);
  ok("the day says how many it holds", /2 moments on this day/.test(stacked.said), stacked.said);
  ok("nothing else collides", (await collisions(page)) === 0);
  await page.close();
}

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
