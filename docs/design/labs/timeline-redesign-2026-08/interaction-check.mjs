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

async function open({ state, variant, viewport, touch, forcedColors, clipboard } = {}) {
  const vp = viewport ?? { width: 1440, height: 960 };
  const page = await browser.newPage({
    viewport: vp,
    /* A thumb is not a pointer and a forced-colours desktop is not this
       palette: both are regimes the gate has to be able to enter. */
    hasTouch: Boolean(touch),
    isMobile: Boolean(touch),
    forcedColors: forcedColors || undefined,
    /* Taking the link is the act that publishes, so the gate has to be
       able to actually take it - without the grant writeText rejects
       and only the failure path is ever driven. */
    permissions: clipboard ? ["clipboard-read", "clipboard-write"] : undefined,
  });
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

/* Painted pixels, not computed style. A forced palette is applied by
   the compositor and getComputedStyle still reports what the author
   wrote, so a check phrased against declared values passes while the
   screen is blank - which is exactly how four loading slabs and an open
   editor's plate went missing under two green assertions. A screenshot
   is a PNG and the lab ships no image library, so it is decoded on a
   scratch page's own canvas. */
const scratch = await browser.newPage();
await scratch.goto("about:blank");
async function painted(shot, points) {
  return scratch.evaluate(async ({ b64, pts }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return pts.map(([x, y]) => {
      const d = ctx.getImageData(
        Math.max(0, Math.min(c.width - 1, Math.round(x))),
        Math.max(0, Math.min(c.height - 1, Math.round(y))),
        1, 1,
      ).data;
      return [d[0], d[1], d[2]];
    });
  }, { b64: shot.toString("base64"), pts: points });
}
/* Dates carry non-breaking spaces, so every string read off the page
 * is flattened before it is matched. Declared here, with the other
 * helpers, because an assertion 1700 lines above the old declaration
 * reached it and died in the temporal dead zone. */
const flat9 = (x) => String(x).replace(/ /g, " ").trim();
const samePixel = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
/* WCAG, on two pixels that are already composited. */
function pixelRatio(a, b) {
  const chan = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
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

/* The ring has to SEPARATE from what it paints on, not merely exist.
   --focus is scoped per ground, but the page carries a second ground
   inside it: the chat plate is somebody else's surface and is literally
   white in both rooms, so the ink room's white ring painted white on
   white and the only focusable element on the unfurl screen had no
   indicator at all. outlineWidth > 0 was true the whole time.

   Walked with real Tab presses, because Chromium grants :focus-visible
   to a programmatically focused button only after a keyboard gesture -
   el.focus() reads every ring as transparent and proves nothing. */
for (const variant of config.variants) {
  for (const state of config.states) {
    const page = await open({ state, variant });
    /* Tab reaches the page that HAS focus, and the scratch page opened
       for pixel reading took it. Without this the whole ring walk reads
       transparent outlines and the block passes on nothing. */
    await page.bringToFront();
    await page.evaluate(() => {
      const parse = (c) => {
        const m = String(c).match(/[\d.]+/g) || [];
        return { r: +m[0] || 0, g: +m[1] || 0, b: +m[2] || 0, a: m.length > 3 ? +m[3] : 1 };
      };
      const over = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      const lum = (c) => {
        const s = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * s(c.r) + 0.7152 * s(c.g) + 0.0722 * s(c.b);
      };
      /* The ring sits at outline-offset, OUTSIDE the border box, so the
         backdrop is the ancestor stack - not the element's own fill. */
      const backdrop = (el) => {
        const chain = [];
        for (let n = el.parentElement; n; n = n.parentElement) chain.push(parse(getComputedStyle(n).backgroundColor));
        let base = { r: 255, g: 255, b: 255, a: 1 };
        for (let i = chain.length - 1; i >= 0; i -= 1) base = over(chain[i], base);
        return base;
      };
      window.__ringAt = () => {
        const el = document.activeElement;
        if (!el || el === document.body || !el.matches(":focus-visible")) return null;
        const cs = getComputedStyle(el);
        if (!(parseFloat(cs.outlineWidth) > 0) || cs.outlineStyle === "none") return null;
        const bg = backdrop(el);
        const ring = over(parse(cs.outlineColor), bg);
        const a = lum(ring), b = lum(bg);
        return {
          tag: el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0],
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      };
    });
    const dim = [];
    for (let i = 0; i < 24; i += 1) {
      await page.keyboard.press("Tab");
      const hit = await page.evaluate(() => window.__ringAt());
      if (hit && hit.ratio < 3) dim.push(hit.tag + " " + hit.ratio.toFixed(2) + ":1");
    }
    ok(`the focus ring separates from what it paints on · ${state} · ${variant}`, dim.length === 0, dim.slice(0, 3).join(", "));
    await page.close();
  }
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
      const items = Array.from(document.querySelectorAll(".b-measure:not([data-back]) .b-item"))
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
    const items = Array.from(document.querySelectorAll(".b-measure:not([data-back]) .b-item"));
    const measure = document.querySelector(".b-measure:not([data-back])");
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
  const ink = await open({ state: "phone", variant: "ink" });
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
  await page.waitForTimeout(250);
  /* The question is answered, so the screen stops asking it. It used to
     leave the heading, the field and the button exactly as they were and
     append a sentence under the button. */
  const answered = await page.evaluate(() => ({
    asking: !!document.querySelector("#b-empty-date"),
    count: (document.querySelector(".b-empty .b-num") || {}).textContent,
    next: (document.querySelector('.b-empty [data-act="add"]') || {}).textContent,
    focused: document.activeElement.getAttribute("data-act"),
    said: (document.querySelector("#b-empty-hint") || {}).textContent,
  }));
  ok("the first screen stops asking once it is answered", !answered.asking);
  ok("the answer becomes the count the plan is measured from",
    Number(answered.count) > 0, String(answered.count));
  ok("the first screen offers the next move", answered.next === "Add a moment", String(answered.next));
  ok("the next move takes focus", answered.focused === "add", String(answered.focused));
  ok("the answer is announced", /day is set/i.test(answered.said || ""), String(answered.said));
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
  ok("the ended link says what happened", /has ended/i.test(text));
  /* The tense follows the clock. This was hardcoded past, so a link
     switched off in July told the couple's family that the most
     important day of their life was over, three months before it. */
  ok("the ended link keeps the day in the tense the clock is in",
    FIXTURE.toDay() > 0 ? /the day is/i.test(text) : /the day was/i.test(text), text.slice(0,120));
  ok("the ended link does not assert a cause it cannot know",
    !/turned off\./i.test(text));
  ok("the ended link names the plan it belonged to",
    text.toLowerCase().includes(FIXTURE.project.name.toLowerCase()));
  ok("the ended link says when the day was",
    text.includes(String(new Date(FIXTURE.project.primaryDate.date).getUTCFullYear())));
  ok("the ended link names who can fix it", text.includes(FIXTURE.workspace.owner));
  ok("the news is the heading", await page.evaluate(() =>
    /has ended/i.test((document.querySelector("h1") || {}).textContent || "")));
  /* One name per state across the product: publish promises the reader
     "sees that it has ended", so this screen may not say something
     harsher for the same fact. */
  ok("the ended link names a state, not a malfunction", !/stopped working/i.test(text));
  ok("the ended link says it once", (text.match(/nothing has been deleted/gi) || []).length === 1);
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
    count: document.querySelectorAll(".b-measure:not([data-back]) .b-item").length,
    titles: Array.from(document.querySelectorAll(".b-title")).map((el) => el.getAttribute("data-full") || el.textContent).join("|"),
  }));
  await page.locator('[data-act="add"]').click();
  await page.waitForTimeout(300);
  const added = await page.evaluate(() => ({
    count: document.querySelectorAll(".b-measure:not([data-back]) .b-item").length,
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
    (await page.evaluate(() => document.querySelectorAll(".b-measure:not([data-back]) .b-item").length)) === before.count);
  await page.close();
}

/* Delete. It was the one destructive act and the only one outside the
   reversibility system, and afterwards the bar offered to restore a row
   that no longer existed. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.locator('.b-step[aria-label="Move a week later"]').click();
  await page.waitForTimeout(250);
  const start = await page.evaluate(() => document.querySelectorAll(".b-measure:not([data-back]) .b-item").length);
  await page.locator('[data-act="delete"]').click();
  await page.waitForTimeout(300);
  const gone = await page.evaluate(() => ({
    count: document.querySelectorAll(".b-measure:not([data-back]) .b-item").length,
    undo: document.querySelector(".b-undoText").textContent,
    active: document.activeElement.tagName,
  }));
  ok("delete removes the moment", gone.count === start - 1, `${start} → ${gone.count}`);
  ok("delete names what it removed", /Send the invitations was removed/.test(gone.undo), gone.undo);
  ok("delete never drops focus to the body", gone.active !== "BODY", gone.active);
  await page.locator(".b-undoAct").click();
  await page.waitForTimeout(300);
  ok("delete can be taken back",
    (await page.evaluate(() => document.querySelectorAll(".b-measure:not([data-back]) .b-item").length)) === start);
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
  /* It used to assert "as far as it goes" - which is the wording of the
     standing note the panel writes when a date IS accepted at the limit.
     One string carried both "we took it, you are at the edge" and "we
     did not take it", so this assertion passed on the ambiguity it
     should have caught. Now: name the rule, and name what still stands. */
  ok("the refusal says why", /Nothing can sit after/.test(flat9(refused.hint)), refused.hint);
  ok("the refusal names the date that still stands",
    /Still .*10 September 2026/.test(flat9(refused.hint)), refused.hint);
  ok("the refusal does not borrow the accepted note's words",
    !/as far as it goes/.test(refused.hint), refused.hint);

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
for (const variant of ["paper", "ink"]) {
  for (const state of ["print", "desk", "phone"]) {
    /* Both shipping rooms fold the past, so the listed case is paper -
       which both of them force. The retired rooms are gone from the
       matrix; the assertion follows the rooms that ship. */
    const listed = state === "print";
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
    Array.from(document.querySelectorAll(".b-measure:not([data-back]) .b-item")).map((el) => Number(el.getAttribute("data-away"))));
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
for (const [variant, state, click] of [["paper", "desk", true], ["ink", "phone", true]]) {
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
/* The past folds in both shipping rooms, so a cancelled moment is read
   where the rows are actually listed: the printed sheet, in both. */
for (const [variant, state] of [["paper", "print"], ["ink", "print"]]) {
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
for (const variant of ["ink", "paper"]) {
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
for (const [variant, state] of [["paper", "print"], ["ink", "print"]]) {
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
  const page = await open({ state: "print", variant: "paper", viewport: { width: 390, height: 844 } });
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
      titleLeft: Math.round(title.getBoundingClientRect().left),
      siblingLeft: (function () {
        var s = Array.from(document.querySelectorAll(".b-behindRow"))
          .filter(function (r) { return !r.querySelector('[data-cancelled="true"]'); })[0];
        var st = s && s.querySelector(".b-behindTitle");
        return st ? Math.round(st.getBoundingClientRect().left) : -1;
      })(),
      aligned: (function () {
        var s = Array.from(document.querySelectorAll(".b-behindRow"))
          .filter(function (r) { return !r.querySelector('[data-cancelled="true"]'); })[0];
        var st = s && s.querySelector(".b-behindTitle");
        return !!st && Math.abs(st.getBoundingClientRect().left - title.getBoundingClientRect().left) <= 1;
      })(),
    };
  });
  ok("a cancelled moment keeps its own words on one line", !!off && off.oneLine);
  /* The old assertion demanded the empty lane COLLAPSE, which was true
     of a room that no longer exists. On the sheet the lane is a grid
     column and reserving it is what keeps every title on one left edge -
     which is the property that actually matters, so that is what is
     asserted. Measured: cancelled and uncancelled rows are identical at
     390 and 1440. */
  ok("a cancelled moment stands on the same margin as its siblings",
    !!off && off.aligned, off ? String(off.titleLeft) + " vs " + String(off.siblingLeft) : "-");
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
    /* Measured from the head of the field, not from the top of the
       window: loading is one object in a room and is centred in it,
       while the arrived plan is a document that starts at the top, so
       an absolute comparison would be measuring the centring rather
       than the hop. */
    today: document.querySelector(".b-todayLabel").getBoundingClientRect().top
      - document.querySelector(".b-who").getBoundingClientRect().top,
  }));
  await before.close();
  const after = await open({ state: "phone", viewport: { width: 390, height: 844 } });
  await after.waitForTimeout(250);
  const real = await after.evaluate(() => ({
    name: (document.querySelector(".b-who") || {}).textContent,
    today: document.querySelector(".b-todayLabel").getBoundingClientRect().top
      - document.querySelector(".b-who").getBoundingClientRect().top,
  }));
  await after.close();
  ok("the loading frame keeps the name the card promised", skel.name === real.name,
    skel.name + " vs " + real.name);
  ok("the frame stands in for the shape, not the column",
    skel.widths.length > 0 && skel.widths.every((w) => w < 300), JSON.stringify(skel.widths));
  ok("nothing hops when the data lands", Math.abs(skel.today - real.today) <= 2,
    skel.today + " → " + real.today);
}

/* ═══ round 5 ══════════════════════════════════════════════════════ */

/* The keepsake is the one artifact this product makes that cannot be
   reflowed after it exists, and it had honoured A4's width and nothing
   else: no page rule, no print media, no break rules, so it printed as
   two sheets - and the two-column document every frame showed was one
   the printer never produced, because the lab's own stage padding took
   the sheet under its column threshold. */
{
  const page = await open({ state: "print", viewport: { width: 794, height: 1123 } });
  await page.waitForTimeout(300);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(200);
  const sheet = await page.evaluate(() => {
    const el = document.querySelector(".b-print");
    const two = document.querySelector(".b-print .b-two");
    const pad = parseFloat(getComputedStyle(el).paddingLeft);
    return {
      height: el.getBoundingClientRect().height,
      box: el.clientWidth - 2 * pad,
      tracks: getComputedStyle(two).gridTemplateColumns.split(" ").length,
      caption: !!document.querySelector(".tl-caption")
        && document.querySelector(".tl-caption").checkVisibility(),
    };
  });
  ok("the sheet fits the page it is printed on", sheet.height <= 1123,
    String(Math.round(sheet.height)));
  ok("the sheet keeps its composition on paper", sheet.tracks === 2, String(sheet.tracks));
  ok("the lab's furniture stays off the paper", !sheet.caption);
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok("the keepsake is one sheet", pages === 1, String(pages));
  await page.close();
}

/* Paper cannot be reloaded, so it dates itself. Everything on the sheet
   was relative to a today the sheet never named. */
{
  const page = await open({ state: "print" });
  await page.waitForTimeout(200);
  const said = await page.evaluate(() => ({
    unit: document.querySelector(".b-unit").textContent,
    today: !!document.querySelector(".b-todayLabel"),
    origin: document.querySelector(".b-origin").textContent,
    link: (document.querySelector(".b-printLinkUrl") || {}).textContent,
  }));
  ok("the sheet dates its own figure", /away on .*20\d\d/.test(said.unit), said.unit);
  ok("the sheet states today once", !said.today);
  /* One ceremonial date per sheet. The dateline under the count owns the
     full form; the origin said the same day again in the same full form
     200px away, and on paper the two always print together. */
  ok("the sheet carries one ceremonial date, not two",
    !/20\d\d/.test(said.origin), said.origin);
  /* Renamed to what it actually tests. It asserted that a string starts
     with https:// and was read for years as "the sheet has a route
     back" - which it did not: 76 characters ending in a 43-character
     case-sensitive token is not a route anyone can take off paper. */
  ok("the sheet prints the link in full",
    !!said.link && said.link.indexOf("https://") === 0, String(said.link));
  await page.close();
}

/* ...and carries a route that can actually be TAKEN from paper. The
   sheet goes to the venue, the celebrant and the day's helpers - the
   people who never got the card in a message - so it is the one surface
   where the fallback was "interrupt the person running the day". */
for (const variant of config.variants) {
  const page = await open({ state: "print", variant, viewport: { width: 900, height: 1200 } });
  await page.waitForTimeout(200);
  const route = await page.evaluate(() => {
    const block = document.querySelector(".b-printLink");
    if (!block) return { none: true };
    const code = block.querySelector('[role="img"]');
    const line = block.querySelector(".b-printLinkUrl");
    if (!code) return { code: false };
    const c = code.getBoundingClientRect();
    const u = line ? line.getBoundingClientRect() : null;
    return {
      code: true,
      name: code.getAttribute("aria-label") || "",
      w: Math.round(c.width),
      h: Math.round(c.height),
      shapes: code.querySelectorAll("path, rect").length,
      first: u ? c.bottom <= u.top + 1 : false,
    };
  });
  ok(`the sheet carries a scannable route, not just a typed one · ${variant}`,
    route.code === true && route.shapes > 1, JSON.stringify(route));
  ok(`the scannable route is big enough to read off paper · ${variant}`,
    route.w >= 88 && route.h >= 88, JSON.stringify(route));
  ok(`the scannable route says what it is, and comes first · ${variant}`,
    /scan/i.test(route.name) && route.first === true, JSON.stringify(route));
  await page.close();
}

/* The link is set to be read rather than clipped. */
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const page = await open({ state: "publish", viewport: vp });
  await page.waitForTimeout(250);
  ok(`the link is not cut mid-token @ ${vp.width}`, await page.evaluate(() => {
    const el = document.querySelector(".b-linkRow span");
    return el.scrollWidth <= el.clientWidth + 1;
  }));
  await page.close();
}

/* A rail that counts backwards says so, in the words a screen reader
   hears as well as the heading a reader sees. */
{
  const page = await open({ state: "day", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  await page.locator(".b-behindSummary").click();
  await page.waitForTimeout(250);
  const spoken = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".b-back .b-unitSaid")).map((el) => el.textContent));
  ok("the past rail speaks its own direction",
    spoken.length > 0 && spoken.every((t) => /days back/.test(t)),
    spoken.slice(0, 2).join(" | "));
  await page.close();
}

/* One name for the past, on every surface it appears on. */
{
  const seen = new Set();
  for (const [variant, state] of [["paper", "phone"], ["paper", "desk"],
    ["paper", "day"], ["paper", "print"], ["ink", "phone"], ["ink", "desk"]]) {
    const page = await open({ state, variant });
    await page.waitForTimeout(200);
    seen.add(await page.evaluate(() => {
      const el = document.querySelector(".b-behind .b-behindLabel");
      return el ? el.textContent : "missing";
    }));
    await page.close();
  }
  ok("the past has one name", seen.size === 1, Array.from(seen).join(" vs "));
}

/* Today is one mark. Across the band from 701 to 1279 the field is one
   wide track, and the single indigo on the owner's screen ran the whole
   width of it, reading as a divider. */
{
  const widths = new Set();
  for (const width of [701, 1152, 1279, 1280, 1440]) {
    const page = await open({ state: "owner-flight", viewport: { width, height: 800 } });
    await page.waitForTimeout(200);
    widths.add(await page.evaluate(() =>
      Math.round(document.querySelector(".b-todayRule").getBoundingClientRect().width)));
    await page.close();
  }
  ok("today is one mark at every width", widths.size === 1, Array.from(widths).join(" vs "));
}

/* The editor is docked, not modal, so the page may scroll under it -
   but the browser's own focus scrolling must never park a control
   beneath it. */
for (const width of [390, 1024]) {
  const page = await open({ state: "owner-editing", viewport: { width, height: 800 } });
  await page.waitForTimeout(300);
  await page.locator('[data-act="delete"]').focus();
  let hidden = 0;
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
    if (await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!at && !!at.closest && !!at.closest(".b-edit") && !el.closest(".b-edit");
    })) hidden += 1;
  }
  ok(`nothing parks under the sheet @ ${width}`, hidden === 0, String(hidden));
  await page.close();
}

/* The pinned horizon keeps speaking. After a screen of scrolling it was
   still announcing the empty stretch before the first moment. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 900 } });
  await page.waitForTimeout(300);
  const atRest = await page.evaluate(() => document.querySelector(".b-gapNote").textContent);
  /* Scroll whatever actually scrolls. At desk width the plan is its
     own pane - the lock says the horizon does not move there - so
     scrolling the window moves nothing and the sentence rightly does
     not change. */
  await page.evaluate(() => {
    const pane = document.querySelector(".b-plan");
    if (pane && getComputedStyle(pane).overflowY === "auto") pane.scrollTop = 900;
    else window.scrollTo(0, 900);
  });
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => document.querySelector(".b-gapNote").textContent);
  ok("the pinned column says where the plan is now", scrolled !== atRest, scrolled);
  ok("and says it in figures that exist", /\d/.test(scrolled), scrolled);
  await page.evaluate(() => {
    const pane = document.querySelector(".b-plan");
    if (pane) pane.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  ok("and goes back to the gap when the gap is on screen",
    (await page.evaluate(() => document.querySelector(".b-gapNote").textContent)) === atRest);
  await page.close();
}

/* No sentence ends on one word. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1280, height: 900 } });
  await page.waitForTimeout(300);
  const widows = await page.evaluate(() => {
    const out = [];
    for (const sel of [".b-note", ".b-stepRead"]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = Array.from(range.getClientRects()).filter((r) => r.width > 0);
      if (lines.length < 2) continue;
      out.push([sel, lines[lines.length - 1].width / Math.max.apply(null, lines.map((r) => r.width))]);
    }
    return out;
  });
  ok("no sentence ends on one word",
    widows.every((w) => w[1] > 0.25), JSON.stringify(widows));
  await page.close();
}

/* ═══ round 6 ══════════════════════════════════════════════════════ */

/* The owner's very first action in the product. It was a focused
   primary button that did nothing at all, on the screen that had just
   said moments come next. */
{
  const page = await open({ state: "owner-empty", viewport: { width: 1280, height: 900 } });
  await page.locator("#b-empty-date").fill("3 October 2026");
  await page.locator('[data-act="setday"]').click();
  await page.waitForTimeout(250);
  await page.locator('.b-empty [data-act="add"]').click();
  await page.waitForTimeout(400);
  const started = await page.evaluate(() => ({
    rows: document.querySelectorAll(".b-measure:not([data-back]) .b-item:not([data-terminus])").length,
    editor: document.querySelectorAll(".b-edit").length,
    focused: document.activeElement.id,
    named: (document.querySelector(".b-who") || {}).textContent,
  }));
  ok("the first action puts a moment on the plan", started.rows === 1, String(started.rows));
  ok("and opens it to be named", started.editor === 1 && started.focused === "b-edit-title",
    started.focused);
  ok("and it is their plan, not the demonstration",
    /Aisling/i.test(started.named || ""), String(started.named));
  await page.close();
}

/* One noun, one number. The head counts the rows a reader can see; the
   sentence under it partitions that total and never recounts it. */
for (const [variant, state] of [["paper", "print"], ["ink", "print"]]) {
  const page = await open({ state, variant });
  await page.waitForTimeout(250);
  const said = await page.evaluate(() => {
    const head = (document.querySelector(".b-behindCount") || {}).textContent || "";
    const notes = Array.from(document.querySelectorAll(".b-behindNote"))
      .filter((n) => n.checkVisibility({ contentVisibilityAuto: true }))
      .map((n) => n.textContent);
    const rows = document.querySelectorAll(".b-behindRow").length;
    return { head, notes, rows };
  });
  ok(`the head counts what is on the page · ${variant}/${state}`,
    said.head === said.rows + " moments", said.head + " vs " + said.rows);
  ok(`nothing recounts it in the same words · ${variant}/${state}`,
    !said.notes.some((n) => /\d+ moments/.test(n)), said.notes.join(" | "));
  await page.close();
}

/* Provenance, said where a stranger looks first rather than last and
   smallest — and said once. */
{
  const page = await open({ state: "phone", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  const who = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"))
      .filter((el) => el.children.length === 0 && /Kept by/i.test(el.textContent));
    return { count: all.length, top: all.length ? Math.round(all[0].getBoundingClientRect().top) : -1 };
  });
  ok("the sender is named once", who.count === 1, String(who.count));
  ok("and named on the first screen", who.top > 0 && who.top < 844, String(who.top));
  await page.close();
}

/* Uppercase mono is exclusive to section heads. Twenty-seven of
   thirty-two strings used to render at one byte-identical spec. */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(250);
  const roles = await page.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll("*")) {
      if (el.children.length || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.textTransform !== "uppercase") continue;
      if (!el.checkVisibility({ contentVisibilityAuto: true })) continue;
      /* The caption naming the frame is the lab's furniture, not the
         artifact - the measured gate exempts it for the same reason. */
      if (el.closest(".tl-caption")) continue;
      const key = cs.fontFamily + "|" + cs.fontSize + "|" + cs.letterSpacing + "|" + cs.color;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    /* Uppercase is now reserved for section heads, so the remaining
       uppercase strings SHOULD share one spec. What must not be
       uppercase is anything that is not a head. */
    const strays = [];
    for (const sel of [".b-date", ".b-unit", ".b-behindDate", ".b-behindCount",
      ".b-behindState", ".b-hiddenMark", ".b-keeper", ".b-origin", ".b-where"]) {
      for (const el of document.querySelectorAll(sel)) {
        if (getComputedStyle(el).textTransform === "uppercase") strays.push(sel);
      }
    }
    return { specs: seen.size, strays: Array.from(new Set(strays)) };
  });
  ok("uppercase is reserved for section heads", roles.strays.length === 0,
    roles.strays.join(" | "));
  ok("and the heads are one object", roles.specs <= 3, String(roles.specs));
  await page.close();
}

/* A thumb is not a pointer. */
{
  const page = await open({
    state: "owner-editing",
    viewport: { width: 390, height: 844 },
    touch: true,
  });
  await page.waitForTimeout(300);
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll(".b-act, .b-step, .b-grab, .b-seg button")) {
      if (!el.checkVisibility({ contentVisibilityAuto: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 44) out.push(el.className + " " + Math.round(r.height));
    }
    return out;
  });
  ok("every control a thumb presses is 44px", small.length === 0, small.slice(0, 3).join(" | "));
  await page.close();
}

/* The spine survives a forced-colours context. Every status here is
   carried in ink density and fill rather than hue, so there is nothing
   to degrade to unless it is mapped. */
{
  const page = await open({ state: "owner-flight", forcedColors: "active" });
  await page.waitForTimeout(300);
  const spine = await page.evaluate(() => {
    const bg = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).backgroundColor : null;
    };
    const ring = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).borderTopWidth : null;
    };
    return {
      rail: bg(".b-rail"),
      today: bg(".b-todayRule"),
      /* A forced palette may repaint any fill, so what has to survive is
         that the next thing is marked differently at all - here, in
         geometry, which no palette can flatten. */
      lead: ring('.b-item[data-lead="true"] .b-tick'),
      plain: ring('.b-item:not([data-lead="true"]) .b-tick'),
    };
  });
  ok("the rail is drawn in forced colours", spine.rail && spine.rail !== "rgba(0, 0, 0, 0)",
    String(spine.rail));
  ok("today is drawn in forced colours", spine.today && spine.today !== "rgba(0, 0, 0, 0)",
    String(spine.today));
  ok("the next thing is still the only filled mark", spine.lead !== spine.plain,
    spine.lead + " vs " + spine.plain);
  await page.close();
}

/* These states are one object in a room and every one of them sat at
   the top of it. Loading is NOT among them: a loading face is a promise
   about the page that follows, and centring it put its heading 236px
   below where the arrived page puts the same heading, so the screen
   jumped on arrival - the one thing a loading state exists to prevent.
   It is asserted against the arrived page instead, below. */
for (const state of ["ended", "unfurl", "day"]) {
  const page = await open({ state, viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(250);
  const room = await page.evaluate(() => {
    const stage = document.querySelector(".tl-stage");
    const r = stage.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(document.querySelector(".tl-page")).paddingTop);
    return { top: r.top, bottom: window.innerHeight - r.bottom, fits: r.height + 2 * pad <= window.innerHeight };
  });
  ok(`the object sits in the middle of its room · ${state}`,
    !room.fits || Math.abs(room.top - room.bottom) <= 2,
    Math.round(room.top) + " / " + Math.round(room.bottom));
  await page.close();
}

/* The one destructive control does not move under the arriving cursor,
   and the keyboard gets what the pointer gets. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(300);
  const danger = await page.evaluate(() => {
    const el = document.querySelector('[data-act="delete"]');
    const rest = el.getBoundingClientRect();
    return { restLeft: rest.left, cs: getComputedStyle(el).paddingLeft };
  });
  await page.hover('[data-act="delete"]');
  await page.waitForTimeout(250);
  const hovered = await page.evaluate(() =>
    document.querySelector('[data-act="delete"]').getBoundingClientRect().left);
  ok("the destructive control holds still under the cursor",
    Math.abs(hovered - danger.restLeft) <= 1, danger.restLeft + " → " + hovered);
  await page.evaluate(() => document.querySelector('[data-act="delete"]').focus());
  await page.waitForTimeout(200);
  ok("and the keyboard gets what the pointer gets", await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('[data-act="delete"]'));
    return cs.borderTopColor !== "rgba(0, 0, 0, 0)" && cs.borderTopColor !== "transparent";
  }));
  await page.close();
}

/* The link can be selected by hand, because the page says so when the
   clipboard refuses — and it breaks at its own midpoint rather than
   wherever the box runs out. */
for (const width of [390, 768]) {
  const page = await open({ state: "publish", viewport: { width, height: 900 } });
  await page.waitForTimeout(250);
  const link = await page.evaluate(() => {
    const el = document.querySelector(".b-linkField");
    if (!el) return null;
    el.focus();
    const picked = String(window.getSelection());
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    const widest = Math.max.apply(null, lines.map((r) => r.width));
    return {
      picked: picked.length,
      whole: el.textContent.length,
      last: lines.length < 2 ? 1 : lines[lines.length - 1].width / widest,
    };
  });
  ok(`the link can be selected by keyboard @ ${width}`,
    !!link && link.picked === link.whole, link ? link.picked + "/" + link.whole : "missing");
  ok(`the link breaks where it can be read @ ${width}`, !!link && link.last > 0.25,
    link ? String(Math.round(link.last * 100) / 100) : "missing");
  await page.close();
}

/* A guest row carries no control, so its title may never be trimmed out
   of reach — the finger would get an ellipsis the screen reader does
   not. */
for (const state of ["phone", "desk", "day"]) {
  const page = await open({ state, viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  const long = await page.evaluate(() => {
    const el = document.querySelector(".b-title");
    if (!el) return null;
    const said = "A very long name for a moment that someone typed in full and meant every word of";
    el.setAttribute("data-full", said);
    el.textContent = said;
    window.__TLCORE.settle();
    return { trimmed: el.getAttribute("data-trimmed"), clamp: getComputedStyle(el).webkitLineClamp };
  });
  ok(`a guest title is never trimmed out of reach · ${state}`,
    !long || long.trimmed !== "true", long ? String(long.trimmed) : "no rows");
  await page.close();
}

/* The one word of jargon, and the document's own language. */
{
  const page = await open({ state: "publish" });
  await page.waitForTimeout(200);
  ok("no state says workspace", !/workspace/i.test(
    await page.evaluate(() => document.body.innerText)));
  ok("the document says what language it is in", await page.evaluate(() =>
    /^[a-z]{2}(-[A-Za-z]{2,})?$/.test(document.documentElement.lang)),
    await page.evaluate(() => document.documentElement.lang));
  await page.close();
}

/* A load that has stopped arriving has a face, and it is the same face
   with one thing changed. */
{
  const page = await open({ state: "loading-slow", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(250);
  const slow = await page.evaluate(() => ({
    busy: document.querySelector(".b-field").getAttribute("aria-busy"),
    says: document.body.innerText,
    way: document.querySelectorAll('[data-act="retry"]').length,
    focused: document.activeElement === document.body,
  }));
  ok("the stalled load says so", /taking longer/i.test(slow.says));
  ok("and stops claiming to be busy", slow.busy === "false", String(slow.busy));
  ok("and offers a way on", slow.way === 1, String(slow.way));
  ok("and does not steal focus to do it", slow.focused);
  await page.close();
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
    !document.querySelector("#b-empty-date") && !!document.querySelector(".b-empty .b-num")));
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
    const items = Array.from(document.querySelectorAll(".b-measure:not([data-back]) .b-item"))
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

/* ── round 7 · what the panel found, made unrepeatable ─────────────
   One block per fixed defect class, each placed where the defect
   actually lived rather than where it was convenient to test. */

/* The WHEN field is a consumer of the one date, never a rival source.
   Three seats found this independently and all three were confirmed:
   the field was seeded once when the editor opened and never written
   again, so three presses of +7 left the most authoritative statement
   of the date on the panel showing the value from before any of them -
   and a bare Enter in that untouched field then committed the stale
   string and dragged the moment back twenty-one days. */
{
  const page = await open({ state: "owner-editing" });
  const flat = (s) => String(s).replace(/ /g, " ").trim();
  const read = () => page.evaluate(() => ({
    field: document.querySelector("#b-edit-date").value,
    readout: document.querySelector(".b-stepRead").textContent,
    away: document.querySelector('.b-item[data-editing="true"]').getAttribute("data-away"),
    date: document.querySelector('.b-item[data-editing="true"]').getAttribute("data-date"),
    undo: (document.querySelector(".b-undoText") || {}).textContent || "",
  }));
  const first = await read();
  for (let i = 0; i < 3; i++) {
    await page.click('.b-step[data-delta="7"]');
    await page.waitForTimeout(120);
    const now = await read();
    ok(`the field follows the move · press ${i + 1}`,
      flat(now.readout).includes(flat(now.field)),
      `field "${flat(now.field)}" vs readout "${flat(now.readout)}"`);
  }
  const moved = await read();
  ok("three presses moved the moment", Number(moved.away) === Number(first.away) + 21,
    `${first.away} -> ${moved.away}`);
  /* The defect that cost the most: confirming a field nobody typed in.
     It must touch neither the model, the history, nor the live region. */
  await page.focus("#b-edit-date");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const after = await read();
  ok("a bare Enter on an untouched field changes nothing",
    after.away === moved.away && after.date === moved.date,
    `${moved.away}/${moved.date} -> ${after.away}/${after.date}`);
  ok("a bare Enter writes no history", after.undo === moved.undo,
    `"${moved.undo}" -> "${after.undo}"`);
  /* Undo runs through the same single writer, so the field comes back
     with everything else. */
  await page.click(".b-undoAct");
  await page.waitForTimeout(200);
  const undone = await read();
  ok("undo brings the field back with the moment",
    flat(undone.readout).includes(flat(undone.field)),
    `field "${flat(undone.field)}" vs readout "${flat(undone.readout)}"`);
  await page.close();
}

/* Undo of a move: no throw, focus back on the control that made the
   change, and the place given back. The old closure read
   event.currentTarget after dispatch had nulled it, so every undo of
   the product's most frequent action threw - and the throw landed
   between the repaint and the line that restores scroll. The assertion
   that was supposed to guard this passed vacuously, because it pressed
   Ctrl+Z with focus already sitting on the stepper. */
for (const viewport of [{ width: 1280, height: 900 }, { width: 1440, height: 960 }]) {
  const page = await open({ state: "owner-editing", viewport });
  const before = pageErrors.length;
  const anchor = () => page.evaluate(() =>
    Math.round(document.querySelector(".b-measureHead").getBoundingClientRect().top));
  await page.click('.b-step[data-delta="7"]');
  await page.waitForTimeout(150);
  const home = await anchor();
  /* Drive the plan away from the change, using whatever actually
     scrolls at this width - the owner desk surface is two panes in a
     fixed frame, so the window is no longer the thing that moves. */
  await page.evaluate(() => {
    const pane = document.querySelector(".b-plan");
    if (pane && pane.scrollHeight > pane.clientHeight + 1) pane.scrollTop = pane.scrollTop + 700;
    else window.scrollTo(0, 700);
  });
  await page.waitForTimeout(120);
  const adrift = await page.evaluate(() => {
    const row = document.querySelector('.b-item[data-editing="true"] .b-copy');
    const pane = document.querySelector(".b-plan");
    const r = row.getBoundingClientRect(), pr = pane.getBoundingClientRect();
    return r.top >= pr.top && r.bottom <= pr.bottom;
  });
  await page.click(".b-undoAct");
  await page.waitForTimeout(300);
  const back = await anchor();
  const seen = await page.evaluate(() => {
    const row = document.querySelector('.b-item[data-editing="true"] .b-copy');
    const pane = document.querySelector(".b-plan");
    if (!row || !pane) return null;
    const r = row.getBoundingClientRect(), pr = pane.getBoundingClientRect();
    return { inView: r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1, top: Math.round(r.top - pr.top) };
  });
  const active = await page.evaluate(() => document.activeElement.className);
  ok(`the owner really was driven away from the change @${viewport.width}`, adrift === false);
  ok(`undoing a move raises nothing @${viewport.width}`,
    pageErrors.length === before, pageErrors.slice(before, before + 1).join(""));
  /* The promise is that undo puts the owner back in front of the
     moment they just reversed - not that a pixel offset is restored.
     keepInBand deliberately brings the moved row into view on the way
     back, and asserting an exact offset would be asserting against the
     product's own place-keeping. */
  ok(`undo puts the moment back in front of the owner @${viewport.width}`,
    seen && seen.inView, seen ? JSON.stringify(seen) : "row not found");
  ok(`undo returns focus to the control that made the change @${viewport.width}`,
    /b-step/.test(active), active);
  await page.close();
}

/* Every count stands beside the words it names. --push used to be set
   on .b-copy, whose siblings inherit nothing from it, so when two
   moments fell closer than a row is tall the words moved clear and the
   number stayed on the true pixel beside somebody else's title. The
   collision window is transient - it opens around the fifth press and
   closes again - so this asserts after EVERY press, not only the last. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  const drift = () => page.evaluate(() => {
    const bad = [];
    for (const it of document.querySelectorAll(".b-item")) {
      if (it.getAttribute("data-stack") === "follow") continue;
      const a = it.querySelector(".b-away"), c = it.querySelector(".b-copy");
      if (!a || !c) continue;
      const ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect();
      if (!ar.height || !cr.height) continue;
      if (Math.abs(ar.top - cr.top) > 4) {
        bad.push(((it.querySelector(".b-title") || {}).textContent || "?") + "@" + Math.round(Math.abs(ar.top - cr.top)));
      }
    }
    return bad;
  });
  let worst = [];
  for (let i = 0; i < 20; i++) {
    await page.click('.b-step[data-delta="-1"]');
    await page.waitForTimeout(40);
    const d = await drift();
    if (d.length) worst = d;
  }
  ok("no count is ever left beside another moment's words",
    worst.length === 0, worst.join(" | "));
  await page.close();
}

/* The count and the mark must never give a reader a false reading on
   the compressed past rail, where a week is 14px and a row of type is
   39px. Six of eight rows crowd at once there, and both gates were
   blind to it because the disclosure is closed at rest and every frame
   was shot closed. */
{
  const page = await open({ state: "day", viewport: { width: 390, height: 844 } });
  await page.evaluate(() => {
    const d = document.querySelector(".b-back summary, summary");
    if (d) d.click();
  });
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => {
    const bad = [];
    const rows = [...document.querySelectorAll(".b-back .b-item")];
    for (const it of rows) {
      if (it.getAttribute("data-stack") === "follow") continue;
      const a = it.querySelector(".b-away"), c = it.querySelector(".b-copy");
      if (!a || !c) continue;
      const ar = a.getBoundingClientRect(), cr = c.getBoundingClientRect();
      if (!ar.height || !cr.height) continue;
      if (Math.abs(ar.top - cr.top) > 4) bad.push(Math.round(Math.abs(ar.top - cr.top)) + "px");
    }
    return { rows: rows.length, bad };
  });
  ok("the past rail has rows to grade", back.rows > 0, String(back.rows));
  ok("every figure behind you stands beside its own moment",
    back.bad.length === 0, back.bad.join(","));
  await page.close();
}

/* The laptop band. The two-column composition used to begin only at
   1280, so 1024 through 1279 rendered the plan as the phone stack blown
   up - 456px of dead field beside every row, and the first moment
   pushed below an 800px fold. The gate checked the fold at 390 only. */
for (const width of [1024, 1152, 1279]) {
  const page = await open({ state: "owner-flight", viewport: { width, height: 800 } });
  const m = await page.evaluate(() => {
    const first = document.querySelector(".b-measure .b-item");
    return {
      columns: getComputedStyle(document.querySelector(".b-two")).gridTemplateColumns.split(" ").length,
      firstTop: first ? Math.round(first.getBoundingClientRect().top) : -1,
      rule: Math.round(document.querySelector(".b-todayRule").getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  ok(`the plan is composed in two columns @${width}`, m.columns === 2, String(m.columns));
  ok(`the owner sees a moment without scrolling @${width}`,
    m.firstTop > 0 && m.firstTop < 800, String(m.firstTop));
  ok(`today is one mark at ${width}`, m.rule === 344, `${m.rule}px`);
  ok(`nothing overflows sideways @${width}`, m.overflow <= 0, String(m.overflow));
  await page.close();
}

/* The docked sheet has a measure. Below the two-column boundary nothing
   inside it was capped, so a date field holding "25 July 2026" drew
   1221px across and the Shown/Hidden plate framed 1079px of nothing. */
for (const width of [768, 1023]) {
  const page = await open({ state: "owner-editing", viewport: { width, height: 900 } });
  const m = await page.evaluate(() => ({
    field: Math.round(document.querySelector("#b-edit-date").getBoundingClientRect().width),
    plate: Math.round(document.querySelector(".b-seg").getBoundingClientRect().width),
  }));
  ok(`the docked field keeps a measure @${width}`, m.field <= 480, `${m.field}px`);
  ok(`the segmented plate wraps its own buttons @${width}`, m.plate <= 260, `${m.plate}px`);
  await page.close();
}

/* The only control on the only screen where the audience meets failure.
   It had no handler at all: no row, no announcement, not even an
   acknowledgement that the product had tried. The gate counted the
   button's existence and the every-control-does-something loop never
   visited this state. */
{
  const page = await open({ state: "loading-slow", viewport: { width: 390, height: 844 } });
  const before = pageErrors.length;
  const say = () => page.evaluate(() => ({
    busy: document.querySelector(".b-field").getAttribute("aria-busy"),
    live: (document.querySelector(".b-live") || {}).textContent || "",
    sub: document.querySelector(".b-sub").textContent,
    focus: document.activeElement.getAttribute("data-act"),
  }));
  const rest = await say();
  await page.click('[data-act="retry"]');
  await page.waitForTimeout(180);
  const trying = await say();
  ok("try again marks the region busy", trying.busy === "true", String(trying.busy));
  ok("try again says so in a live region of its own",
    trying.live.trim().length > 0, `"${trying.live}"`);
  ok("try again really goes back to the loading face",
    trying.sub !== rest.sub, `"${rest.sub}" -> "${trying.sub}"`);
  ok("try again keeps the press where it was", trying.focus === "retry", String(trying.focus));
  await page.waitForTimeout(1500);
  const settled = await say();
  ok("a second failure is announced, not left silent",
    /still not arriving/i.test(settled.live), `"${settled.live}"`);
  ok("a second failure still says nothing is lost",
    /link still works/i.test(settled.live), `"${settled.live}"`);
  ok("try again raises nothing", pageErrors.length === before,
    pageErrors.slice(before, before + 1).join(""));
  await page.close();
}

/* Nothing on the owner's bar may be drawn as a control and be inert,
   and no named decision may be published in the console with nothing
   behind it. */
{
  const page = await open({ state: "owner-flight" });
  const m = await page.evaluate(() => {
    const s = document.querySelector(".b-switch");
    const cs = getComputedStyle(s);
    return {
      border: parseFloat(cs.borderTopWidth),
      radius: parseFloat(cs.borderTopLeftRadius),
      spacing: document.body.hasAttribute("data-spacing"),
      publish: (document.querySelector('[data-act="publish"]') || {}).textContent || "",
    };
  });
  ok("the project name is not drawn as a button it is not",
    m.border === 0 && m.radius === 0, `border ${m.border}, radius ${m.radius}`);
  ok("no decision is published with nothing behind it", !m.spacing);
  /* On a plan that is already live, the primary control may not offer
     to do the thing that has already been done. */
  ok("the publish verb knows whether anyone is holding a copy",
    FIXTURE.publication.state === "published"
      ? /get the link/i.test(m.publish)
      : /publish/i.test(m.publish), m.publish);
  await page.close();
}

/* The reversibility bar, now inside the measured perimeter. Nothing
   about the product's way out of a mistake had ever been graded,
   because the bar is display:none or visibility:hidden in every state
   the audit visits. */
{
  const page = await open({ state: "owner-undone" });
  const m = await page.evaluate(() => {
    const bar = document.querySelector(".b-edit .b-undo");
    const kbd = bar && bar.querySelector("kbd");
    const label = document.querySelector(".b-edit .b-label");
    return {
      shown: bar ? getComputedStyle(bar).visibility : "missing",
      empty: bar ? bar.getAttribute("data-empty") : "missing",
      track: kbd ? getComputedStyle(kbd).letterSpacing : "missing",
      lead: kbd ? getComputedStyle(bar.querySelector(".b-undoAct")).lineHeight : "missing",
      barBottom: bar ? Math.round(bar.getBoundingClientRect().bottom) : 0,
      labelTop: label ? Math.round(label.getBoundingClientRect().top) : 0,
    };
  });
  ok("the way back is on screen and filled in this state",
    m.shown === "visible" && m.empty === "false", JSON.stringify(m));
  ok("the keycap sits in the data register with its neighbours",
    m.track === "0.44px", m.track);
  ok("the filled bar never paints over the panel's first label",
    m.barBottom <= m.labelTop, `bar ${m.barBottom} vs label ${m.labelTop}`);
  await page.close();
}
{
  const page = await open({ state: "owner-undone", viewport: { width: 390, height: 844 }, touch: true });
  const h = await page.evaluate(() => {
    const el = document.querySelector(".b-undoAct");
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
  ok("the way back is a thumb target like everything else", h >= 44, `${h}px`);
  await page.close();
}

/* Breaks. A date may not be split between its weekday and its day
   number on the card that is the product's first impression, and a
   connector may not open a line. */
{
  const page = await open({ state: "unfurl", viewport: { width: 1440, height: 960 } });
  const m = await page.evaluate(() => {
    const span = document.querySelector(".b-unfurlTitle span");
    return { rects: span ? span.getClientRects().length : -1 };
  });
  ok("the unfurl date is never split across lines", m.rects === 1, String(m.rects));
  await page.close();
}
/* The readout is two facts and sets as two lines. The old assertion
   policed only the connector's HEAD - the nbsp kept the middot off the
   start of line two - and the break moved to the other side of the same
   glyph, so line one ended on a separator standing alone in white
   space at every width the panel is ever given. The property actually
   wanted: two lines, and no line ending on its own punctuation. Driven
   at rest and after a move, on both grounds. */
for (const variant of config.variants) {
  for (const w of [390, 1152, 1280, 1440]) {
    const page = await open({ state: "owner-editing", variant, viewport: { width: w, height: 900 } });
    await page.waitForTimeout(300);
    const measure = () => page.evaluate(() => {
      const el = document.querySelector(".b-stepRead");
      const lines = new Map();
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        for (let i = 0; i < node.textContent.length; i += 1) {
          const rg = document.createRange();
          rg.setStart(node, i);
          rg.setEnd(node, i + 1);
          const b = rg.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue;
          const key = Math.round(b.top);
          if (!lines.has(key)) lines.set(key, []);
          lines.get(key).push({ ch: node.textContent[i], right: b.right });
        }
      }
      return [...lines.entries()].sort((a, b2) => a[0] - b2[0]).map(([, cs]) => {
        cs.sort((a, b2) => a.right - b2.right);
        let last = "";
        for (let i = cs.length - 1; i >= 0; i -= 1) {
          if (!/\s| /.test(cs[i].ch)) { last = cs[i].ch; break; }
        }
        return { text: cs.map((c) => c.ch).join(""), last };
      });
    });
    const rest = await measure();
    await page.click('.b-step[data-delta="7"]');
    await page.waitForTimeout(200);
    const moved = await measure();
    for (const [when, lines] of [["at rest", rest], ["after a move", moved]]) {
      ok(`the readout sets on two lines · ${when} · ${variant} @ ${w}`,
        lines.length === 2, JSON.stringify(lines.map((l) => l.text)));
      ok(`no line of the readout ends on its own punctuation · ${when} · ${variant} @ ${w}`,
        lines.every((l) => !"·–—,;:".includes(l.last)),
        JSON.stringify(lines.map((l) => l.text)));
    }
    await page.close();
  }
}

/* The horizon sentence cannot outlive the fact it describes. It used to
   be restored from a snapshot captured when the surface was wired. */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.click('.b-step[data-delta="-7"]');
  await page.click('.b-step[data-delta="-7"]');
  await page.waitForTimeout(200);
  const moved = await page.evaluate(() => document.querySelector(".b-gapNote").textContent);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(180);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => document.querySelector(".b-gapNote").textContent);
  ok("the horizon sentence cannot outlive its own fact", moved === back,
    `"${moved}" vs "${back}"`);
  await page.close();
}



/* ── round 9 · what the panel found, made unrepeatable ────────────── */
async function firstRun(page) {
  await page.fill("#b-empty-date", "3 October 2026");
  await page.click('[data-act="setday"]');
  await page.waitForTimeout(350);
  await page.click('[data-act="add"]');
  await page.waitForTimeout(500);
}
/* the day is never a placeholder read back as a fact */
{
  const page = await open({ state: "owner-empty", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  await firstRun(page);
  const r = await page.evaluate(() => ({
    body: document.querySelector(".b-field").innerText,
    sub: !!document.querySelector(".b-sub"),
    label: window.__TLCORE.F.project.primaryDate.label,
    card: (document.querySelector(".b-unfurlTitle") || {}).textContent || "",
  }));
  ok("a plan the owner made carries no invented day-name", r.label === "" && !r.sub, `label "${r.label}" sub ${r.sub}`);
  /* The form may name the concept ("The day is set.") — what must never
     happen is the product printing its own placeholder back as though
     the owner had written it. */
  ok("and no surface prints a day-name the owner never wrote",
    !/The day is the last day/.test(flat9(r.body)) && !/^The day,/.test(flat9(r.card)),
    flat9(r.card).slice(0, 60) || "(no card on this state)");
  await page.close();
}
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const ceil = await page.evaluate(async () => {
    const g = document.querySelector(".b-item[data-anchor='true'] .b-grab") || document.querySelector(".b-grab");
    g.click();
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 90; i++) document.querySelector('.b-step[data-delta="7"]').click();
    await new Promise((r) => setTimeout(r, 300));
    return (document.querySelector(".b-ceiling") || {}).textContent || "";
  });
  ok("the ceiling sentence is not a tautology", /Nothing can sit after the day itself/.test(ceil), ceil.slice(0, 70));
  await page.close();
}

/* the day is not edited as a moment */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const row = document.querySelector('.b-item[data-anchor="true"]');
    if (!row) return { none: true };
    row.querySelector(".b-grab").click();
    await new Promise((r2) => setTimeout(r2, 350));
    return {
      anchors: document.querySelectorAll('.b-item[data-anchor="true"]').length,
      seg: !!document.querySelector(".b-edit .b-seg"),
      del: !!document.querySelector('.b-edit [data-act="delete"]'),
      name: document.querySelector(".b-edit").getAttribute("aria-label"),
      standing: (document.querySelector(".b-edit .b-standing") || {}).textContent || "",
    };
  });
  ok("exactly one row is the day", r.anchors === 1, String(r.anchors));
  ok("the day cannot be hidden from guests", !r.seg);
  ok("the day cannot be deleted as a moment", !r.del);
  ok("the day's editor says what it is", /measured from this day/.test(r.standing), r.standing);
  await page.close();
}

/* renaming the day writes the one record the horizon reads */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    document.querySelector('.b-item[data-anchor="true"] .b-grab').click();
    await new Promise((r2) => setTimeout(r2, 350));
    const f = document.querySelector("#b-edit-title");
    f.value = "The ceremony";
    f.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r2) => setTimeout(r2, 250));
    return {
      label: window.__TLCORE.F.project.primaryDate.label,
      sub: (document.querySelector(".b-sub") || {}).textContent || "",
    };
  });
  ok("renaming the day renames it everywhere", r.label === "The ceremony" && flat9(r.sub) === "The ceremony",
    `${r.label} / ${flat9(r.sub)}`);
  await page.close();
}

/* the plan ends on the day it counts to */
{
  const page = await open({ state: "owner-empty", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  await firstRun(page);
  const r = await page.evaluate(() => {
    const t = document.querySelector('.b-item[data-terminus="true"]');
    return {
      has: !!t,
      away: t ? t.getAttribute("data-away") : null,
      last: t ? t === [...document.querySelectorAll(".b-measure .b-item")].pop() : false,
      grab: t ? !!t.querySelector(".b-grab") : true,
    };
  });
  ok("a new plan ends on its own day", r.has && r.last, JSON.stringify(r));
  ok("the day at the end is not an editable moment", r.has && !r.grab);
  await page.close();
}
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const dup = await page.evaluate(() => document.querySelectorAll('.b-item[data-terminus="true"]').length);
  ok("the seeded plan does not draw its day twice", dup === 0, String(dup));
  await page.close();
}

/* ids are monotonic; a typed name lands on the row typed into */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const F = window.__TLCORE.F;
    const press = async (sel) => { document.querySelector(sel).click(); await new Promise((r2) => setTimeout(r2, 260)); };
    await press('[data-act="add"]');
    await press('[data-act="done"]');
    await press('[data-act="add"]');
    await press('[data-act="done"]');
    const first = document.querySelector(".b-measure .b-item .b-grab");
    first.click(); await new Promise((r2) => setTimeout(r2, 260));
    await press('[data-act="delete"]');
    await press('[data-act="add"]');
    const f = document.querySelector("#b-edit-title");
    f.value = "Rehearsal dinner";
    f.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r2) => setTimeout(r2, 260));
    const ids = F.milestones.map((m) => m.id);
    const named = F.milestones.filter((m) => m.title === "Rehearsal dinner").length;
    return { ids, dup: ids.length !== new Set(ids).size, named };
  });
  ok("no two moments share an id", !r.dup, r.ids.join(","));
  ok("a typed name lands on exactly one record", r.named === 1, String(r.named));
  await page.close();
}

/* place() is a fixed point: a stacked pair is right on the first render */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    document.querySelector('.b-step[data-delta="-7"]').click();
    await new Promise((r2) => setTimeout(r2, 400));
    const lead = document.querySelector('.b-item[data-stack="lead"] .b-copy');
    const foll = document.querySelector('.b-item[data-stack="follow"] .b-copy');
    if (!lead || !foll) return { none: true };
    const gap = foll.getBoundingClientRect().top - lead.getBoundingClientRect().bottom;
    const before = [...document.querySelectorAll(".b-item")].map((i) => i.style.getPropertyValue("--push"));
    window.__TLD.b.settle();
    await new Promise((r2) => setTimeout(r2, 150));
    const after = [...document.querySelectorAll(".b-item")].map((i) => i.style.getPropertyValue("--push"));
    return { gap: Math.round(gap), same: before.join("|") === after.join("|") };
  });
  ok("a stacked pair does not overlap on the render that forms it", !r.none && r.gap > 0, JSON.stringify(r));
  ok("place() is a fixed point", r.same === true);
  await page.close();
}

/* A forced palette may repaint any fill, but nothing on the screen may
   disappear because of it. Read on painted pixels: the loading frame's
   four slabs and the open editor's plate both carried their whole
   meaning by translucency, so Canvas-on-Canvas erased them - the frame
   fell to three text lines and the panel lost every tie to the row it
   edits. The gate's other forced-colours passes only ever opened
   owner-flight, so neither state was ever entered in that regime. */
for (const variant of config.variants) {
  {
    const page = await open({ state: "loading", variant, viewport: { width: 390, height: 844 }, forcedColors: "active" });
    const boxes = await page.evaluate(() => [...document.querySelectorAll(".b-skel")].map((s) => {
      const r = s.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }));
    const shot = await page.screenshot();
    const probes = [];
    for (const b of boxes) {
      probes.push([b.x + b.w / 2, b.y]);
      probes.push([b.x + b.w / 2, b.y + b.h - 1]);
      probes.push([b.x + b.w / 2, b.y - 6]);
    }
    const got = probes.length ? await painted(shot, probes) : [];
    const flat = [];
    for (let i = 0; i < boxes.length; i += 1) {
      const [top, bot, ground] = [got[i * 3], got[i * 3 + 1], got[i * 3 + 2]];
      if (samePixel(top, ground) && samePixel(bot, ground)) flat.push("slab " + i);
    }
    ok(`the loading frame still has slabs in a forced palette · ${variant}`, boxes.length > 0 && flat.length === 0, flat.join(", "));
    await page.close();
  }
  {
    const page = await open({ state: "owner-editing", variant, forcedColors: "active" });
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const c = document.querySelector('.b-item[data-editing="true"] .b-copy');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const shot = await page.screenshot();
    const got = box ? await painted(shot, [
      [box.x + box.w / 2, box.y - 10],
      [box.x + box.w / 2, box.y + 2],
      [box.x + box.w / 2, box.y + box.h - 2],
      [box.x - 10, box.y + box.h / 2],
    ]) : [];
    const tied = Boolean(box) && !(samePixel(got[0], got[1]) && samePixel(got[1], got[2]) && samePixel(got[2], got[3]));
    ok(`the edited row keeps a shape in a forced palette · ${variant}`, tied, JSON.stringify(got));
    await page.close();
  }
}

/* The frame around the artifact is furniture and must whisper on both
   grounds. It is an alpha edge, and an alpha edge composites over the
   box's OWN background - so writing the box white threw the ladder step
   away and made the bezel the loudest line in the ink room at 13.4:1.
   Read on painted pixels: computed style reported the same rgba on both
   grounds the whole time, which is precisely what hid it. Print is
   excluded: it forces the paper ground by design. */
for (const variant of config.variants) {
  for (const state of config.states) {
    if (state === "print") continue;
    const page = await open({ state, variant });
    const box = await page.evaluate(() => {
      const el = document.querySelector(".tl-device, .tl-paperEdge");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { cls: String(el.className), x: r.left, y: r.top };
    });
    if (!box) { await page.close(); continue; }
    const shot = await page.screenshot();
    const [edge, out] = await painted(shot, [[box.x - 0.5, box.y + 60], [box.x - 5, box.y + 60]]);
    const r = pixelRatio(edge, out);
    ok(`the artifact frame whispers on this ground · ${state} · ${variant}`, r < 2,
      `${box.cls} ${JSON.stringify(edge)} vs ${JSON.stringify(out)} = ${r.toFixed(2)}:1`);
    await page.close();
  }
}

/* The stamp is the ONLY string that dates the plan for a guest - the
   owner's "Live since" line does not exist on the surfaces they see. It
   used to be written by hand in the add branch, so it moved for one of
   the six things an owner can do and lied after the other five: an
   owner could delete eight moments in a row and the footer would still
   claim the plan had not changed in eleven days. */
for (const variant of config.variants) {
  const page = await open({ state: "owner-flight", variant });
  await page.waitForTimeout(400);
  const stamps = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r2) => setTimeout(r2, ms));
    const read = () => (document.querySelector(".b-stamp")?.textContent || "").trim();
    const openRow = async (id) => {
      document.querySelector('.b-item[data-id="' + id + '"] .b-grab').click();
      await wait(300);
    };
    const out = { before: read() };
    await openRow("demo-audience-item-invitations");
    document.querySelector('.b-step[data-delta="7"]').click();
    await wait(400);
    out.afterMove = read();
    await openRow("demo-audience-item-music");
    const del = document.querySelector('[data-act="delete"]');
    if (del) { del.click(); await wait(500); }
    out.afterDelete = read();
    return out;
  });
  ok(`moving a moment moves the stamp · ${variant}`, /16 July/.test(flat9(stamps.afterMove)), flat9(stamps.afterMove));
  ok(`deleting a moment moves the stamp · ${variant}`, /16 July/.test(flat9(stamps.afterDelete)), flat9(stamps.afterDelete));
  ok(`the stamp was stale to begin with · ${variant}`, /15 July/.test(flat9(stamps.before)), flat9(stamps.before));
  await page.close();
}

/* The heading may not claim possession at the instant of publishing.
   "Have had this since <today>" states elapsed possession where the
   elapsed time is zero and nobody has been handed anything - and it
   contradicted the strap beside it, which has always said sending
   comes next. The day after, the same sentence is true, so the branch
   is on the distance and not on the state. */
for (const variant of config.variants) {
  const page = await open({ state: "owner-draft", variant, clipboard: true });
  await page.waitForTimeout(300);
  const said = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r2) => setTimeout(r2, ms));
    document.querySelector('[data-act="publish"]').click();
    await wait(400);
    const before = document.querySelector(".b-pressTitle")?.textContent || "";
    document.querySelector('[data-act="copy"]').click();
    await wait(600);
    return {
      before,
      head: document.querySelector(".b-pressTitle")?.textContent || "",
      live: document.querySelector(".b-live")?.textContent || "",
    };
  });
  ok(`publishing today does not claim they have had it · ${variant}`,
    !/have had this since/.test(flat9(said.head)), flat9(said.head));
  ok(`the heading still moves on the press · ${variant}`,
    flat9(said.head) !== flat9(said.before), flat9(said.head));
  ok(`copying a link does not say it was delivered · ${variant}`,
    /Link copied/.test(flat9(said.live)) && !/can open this now/.test(flat9(said.live)), flat9(said.live));
  await page.close();
}
/* ...and the sentence is still the right one for a plan somebody has
   genuinely been holding since yesterday. */
for (const variant of config.variants) {
  const page = await open({ state: "publish", variant });
  const head = await page.evaluate(() => document.querySelector(".b-pressTitle")?.textContent || "");
  ok(`a plan already out there says so plainly · ${variant}`,
    /have had this since 15 July/.test(flat9(head)), flat9(head));
  await page.close();
}

/* The reversibility bar is absolutely positioned against a reserve
   that was hand-measured in the DOCKED sheet, where the panel is ~480px
   wide and the sentence takes two rows. In the shipping rail column it
   is 310px and three rows, so the reserve ran out - and because the bar
   is opaque it did not overlap the first field's label, it deleted it.
   Measured by hit-testing the label's own centre, at every desk width
   and on the coarse path, on both grounds. The stepper under the
   pointer must not move either: that is what the reserve was for. */
for (const variant of config.variants) {
  for (const vp of [
    { width: 1440, height: 960 },
    { width: 1280, height: 900 },
    { width: 1152, height: 800 },
    { width: 1024, height: 800 },
    { width: 390, height: 844, touch: true },
  ]) {
    const page = await open({ state: "owner-flight", variant, viewport: { width: vp.width, height: vp.height }, touch: vp.touch });
    await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r2) => setTimeout(r2, ms));
      document.querySelector('.b-measure:not(.b-back) .b-item .b-grab').click();
      await wait(350);
      const step = document.querySelector('.b-step[data-delta="7"]');
      const held = step.getBoundingClientRect().top;
      step.click();
      await wait(450);
      const moved = Math.round(document.querySelector('.b-step[data-delta="7"]').getBoundingClientRect().top - held);
      const label = document.querySelector(".b-edit .b-label, #b-edit .b-label");
      if (!label) return { none: true };
      const bar = document.querySelector(".b-edit .b-undo, #b-edit .b-undo");
      const air = bar ? Math.round(label.getBoundingClientRect().top - bar.getBoundingClientRect().bottom) : null;
      label.scrollIntoView({ block: "center" });
      await wait(150);
      const b = label.getBoundingClientRect();
      const hit = [
        document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2),
        document.elementFromPoint(b.left + 2, b.top + b.height / 2),
      ];
      return {
        covered: hit.some((el) => Boolean(el && bar && bar.contains(el))),
        air,
        moved,
        name: label.textContent.trim(),
      };
    });
    ok(`the undo band never paints over the first field's name · ${variant} @ ${vp.width}`,
      !r.none && r.covered === false, JSON.stringify(r));
    ok(`the first field keeps the air every other label has · ${variant} @ ${vp.width}`,
      !r.none && r.air >= 16, JSON.stringify(r));
    ok(`filling the band does not move the stepper · ${variant} @ ${vp.width}`,
      !r.none && Math.abs(r.moved) <= 1, String(r.moved));
    await page.close();
  }
}

/* ...and it holds for a title long enough to take the sentence to four
   lines, which is what a reserve measured against one fixture always
   misses. The name gives way, never the act: clipping the plate would
   have hidden the Undo control itself. */
for (const variant of config.variants) {
  for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844, touch: true }]) {
    const page = await open({ state: "owner-flight", variant, viewport: { width: vp.width, height: vp.height }, touch: vp.touch });
    await page.waitForTimeout(400);
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r2) => setTimeout(r2, ms));
      document.querySelector('.b-measure:not(.b-back) .b-item .b-grab').click();
      await wait(350);
      const title = document.querySelector("#b-edit-title");
      title.value = "Menu tasting at The Orchard with both families and the celebrant, and the photographer joining after";
      title.dispatchEvent(new Event("input", { bubbles: true }));
      title.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await wait(300);
      document.querySelector('.b-step[data-delta="7"]').click();
      await wait(450);
      const bar = document.querySelector(".b-edit .b-undo");
      const label = document.querySelector(".b-edit .b-label");
      const act = bar.querySelector(".b-undoAct");
      const air = Math.round(label.getBoundingClientRect().top - bar.getBoundingClientRect().bottom);
      label.scrollIntoView({ block: "center" });
      await wait(120);
      const b = label.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const ar = act.getBoundingClientRect();
      const br = bar.getBoundingClientRect();
      return {
        air,
        covered: Boolean(hit && bar.contains(hit)),
        said: bar.querySelector(".b-undoText").textContent,
        actInside: ar.top >= br.top - 1 && ar.bottom <= br.bottom + 1,
      };
    });
    ok(`a long title cannot grow the band back over the label · ${variant} @ ${vp.width}`,
      r.covered === false && r.air >= 16, JSON.stringify(r));
    ok(`the way back out of a mistake is never the thing that gets clipped · ${variant} @ ${vp.width}`,
      r.actInside === true && /moved 7 days later/.test(flat9(r.said)), flat9(r.said));
  await page.close();
  }
}

/* Three on one day, not two. A crowded plate's halo is a 12px opaque
   spread that paints OUTSIDE its own box and over whatever was painted
   before it, so the row above a crowded row loses its last 12px. A pair
   never showed it: the only follower had nothing painted after it. The
   gap > 0 test above passes at 1px and can never catch this, so this one
   asserts against the halo's own spread. */
for (const variant of config.variants) {
  for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const page = await open({ state: "owner-flight", variant, viewport: vp });
    await page.waitForTimeout(400);
    const crowd = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r2) => setTimeout(r2, ms));
      const pull = async (id, times) => {
        document.querySelector('.b-item[data-id="' + id + '"] .b-grab').click();
        await wait(300);
        for (let i = 0; i < times; i += 1) {
          document.querySelector('.b-step[data-delta="-7"]').click();
          await wait(280);
        }
      };
      await pull("demo-audience-item-invitations", 1);
      await pull("demo-audience-item-fitting", 3);
      await wait(400);
      const items = [...document.querySelectorAll('.b-measure:not(.b-back) .b-item')];
      const run = items.filter((el) => ["lead", "follow"].includes(el.getAttribute("data-stack")));
      const eaten = [];
      for (let i = 0; i < items.length - 1; i += 1) {
        if (items[i + 1].getAttribute("data-crowded") !== "true") continue;
        const copy = items[i].querySelector(".b-copy");
        const nextCopy = items[i + 1].querySelector(".b-copy");
        if (!copy || !nextCopy) continue;
        let deepest = -1e9;
        for (const kid of copy.querySelectorAll("*")) {
          const b = kid.getBoundingClientRect();
          if (b.height > 0 && b.bottom > deepest) deepest = b.bottom;
        }
        const clear = Math.round(nextCopy.getBoundingClientRect().top - 12 - deepest);
        if (clear < 0) eaten.push(items[i].getAttribute("data-id") + " " + clear + "px");
      }
      return { run: run.length, eaten };
    });
    ok(`three on one day: a run of three actually forms · ${variant} @ ${vp.width}`, crowd.run >= 3, String(crowd.run));
    ok(`no crowded halo paints over the row above it · ${variant} @ ${vp.width}`, crowd.eaten.length === 0, crowd.eaten.join(", "));
    await page.close();
  }
}

/* the follower says its own number */
{
  const page = await open({ state: "owner-editing", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const said = await page.evaluate(async () => {
    document.querySelector('.b-step[data-delta="-7"]').click();
    await new Promise((r2) => setTimeout(r2, 400));
    const f = document.querySelector('.b-item[data-stack="follow"] .b-unitSaid');
    const l = document.querySelector('.b-item[data-stack="lead"] .b-unitSaid');
    return { follow: f ? f.textContent : "", lead: l ? l.textContent : "" };
  });
  ok("the follower never speaks a unit with no number",
    !/^\s*days away/.test(said.follow) && /the second of 2/.test(said.follow), flat9(said.follow));
  ok("the lead takes a real ordinal", /the first of 2/.test(said.lead), flat9(said.lead));
  await page.close();
}

/* a plan with every moment removed still ends on its day */
{
  const page = await open({ state: "owner-flight", viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const rows = () => [...document.querySelectorAll(".b-measure .b-item")];
    const spare = () => rows().filter((x) => !x.hasAttribute("data-anchor"));
    for (let n = 0; n < 14 && spare().length; n++) {
      spare()[0].querySelector(".b-grab").click();
      await new Promise((r2) => setTimeout(r2, 220));
      const d = document.querySelector('[data-act="delete"]');
      if (!d) {
        const done = document.querySelector('[data-act="done"]');
        if (done) done.click();
        await new Promise((r2) => setTimeout(r2, 200));
        continue;
      }
      d.click();
      await new Promise((r2) => setTimeout(r2, 240));
    }
    const all = rows();
    return {
      spare: spare().length,
      total: all.length,
      lastIsDay: all.length ? all[all.length - 1].hasAttribute("data-anchor") : false,
      note: (document.querySelector(".b-gapNote") || {}).textContent || "",
      measureH: Math.round(document.querySelector(".b-measure").getBoundingClientRect().height),
      body: document.querySelector(".b-field").innerText.slice(0, 200),
    };
  });
  
  ok("every moment can be removed", r.spare === 0, String(r.spare));
  ok("and the plan is never a bare rule - it still ends on its day",
    r.total === 1 && r.lastIsDay, JSON.stringify({ total: r.total, lastIsDay: r.lastIsDay }));
  ok("and the horizon sentence is true of what is left",
    /nothing is planned until 3 october/i.test(flat9(r.note)), flat9(r.note));
  await page.close();
}

/* draft commits; taking the link publishes */
{
  const page = await open({ state: "owner-draft", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    document.querySelector('[data-act="publish"]').click();
    await new Promise((r2) => setTimeout(r2, 400));
    return {
      head: (document.querySelector(".b-pressTitle") || {}).textContent || "",
      live: (document.querySelector(".b-live") || {}).textContent || "",
    };
  });
  ok("publishing a draft does not claim a past it never had",
    /Send it to/.test(r.head) && !/have had this since/.test(r.head), flat9(r.head));
  await page.close();
}

/* the panes say where they are cut */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const pane = document.querySelector(".b-plan");
    const at0 = pane.getAttribute("data-fold");
    pane.scrollTop = Math.round(pane.scrollHeight / 2);
    pane.dispatchEvent(new Event("scroll"));
    await new Promise((r2) => setTimeout(r2, 250));
    const mid = pane.getAttribute("data-fold");
    pane.scrollTop = pane.scrollHeight;
    pane.dispatchEvent(new Event("scroll"));
    await new Promise((r2) => setTimeout(r2, 250));
    return { at0, mid, end: pane.getAttribute("data-fold"), masked: getComputedStyle(pane).maskImage !== "none" };
  });
  ok("a pane says when something is below its edge", r.at0 === "below", String(r.at0));
  ok("and when it is cut at both edges", r.mid === "both", String(r.mid));
  ok("and stops saying it at the end", r.end === "above", String(r.end));
  ok("the edge is painted, not declared", r.masked === true);
  await page.close();
}

/* titles survive a large root size */
{
  const page = await open({ state: "owner-flight", viewport: { width: 1440, height: 960 } });
  await page.addStyleTag({ content: "html{font-size:24px}" });
  await page.waitForTimeout(700);
  const trimmed = await page.evaluate(() => {
    window.__TLCORE.settle();
    return [...document.querySelectorAll(".b-title")]
      .filter((t) => (t.getAttribute("data-full") || "") !== t.textContent).length;
  });
  ok("no title is eaten at a large root size", trimmed === 0, `${trimmed} trimmed`);
  await page.close();
}




/* ── round 10 · the room that ships, graded on both grounds ─────────
   The founder picked paper / folded / structure and its ink twin. Every
   assertion below runs on BOTH grounds, because the two ladders do not
   permit the same token and a fix that lands in one room and not the
   other is a defect in itself. */
const flat10 = (x) => String(x).replace(/ /g, " ").trim();

/* Indigo marks what is still AHEAD. The rule was unscoped and .b-back is
   a .b-measure, so on the wedding morning — which has no forward measure
   at all — the only indigo rail drew the PAST. Three seats found it. */
for (const room of ["paper", "ink"]) {
  const page = await open({ state: "day", variant: room, viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const back = document.querySelector(".b-back .b-rail");
    return back ? getComputedStyle(back).backgroundColor : null;
  });
  ok(`the past rail is never the accent · ${room}`,
    !!r && !/79,\s*70,\s*229|111,\s*104,\s*238/.test(r), String(r));
  await page.close();
}
/* And the forward rail IS the accent — at an alpha chosen per ground,
   because one value cannot read on both. */
for (const room of ["paper", "ink"]) {
  const page = await open({ state: "owner-flight", variant: room, viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const fwd = document.querySelector(".b-measure:not(.b-back) .b-rail");
    const cs = getComputedStyle(fwd);
    return { bg: cs.backgroundColor, op: parseFloat(cs.opacity) };
  });
  ok(`the forward rail carries the accent · ${room}`,
    /79,\s*70,\s*229|111,\s*104,\s*238/.test(r.bg), r.bg);
  ok(`at an alpha on the declared ladder · ${room}`,
    [0.46, 1].some((a) => Math.abs(r.op - a) < 0.01), String(r.op));
  await page.close();
}

/* Adding a moment to a plan people already hold cannot un-hand it. */
{
  const page = await open({ state: "owner-flight", variant: "paper", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const before = window.__TLCORE.F.publication.state;
    document.querySelector('[data-act="add"]').click();
    await new Promise((r2) => setTimeout(r2, 400));
    return {
      before, after: window.__TLCORE.F.publication.state,
      shared: (document.querySelector(".b-shared") || {}).textContent || "",
    };
  });
  ok("adding a moment does not unpublish a live plan",
    r.before === "published" && r.after === "published" && /anyone with the link/i.test(r.shared),
    `${r.before} -> ${r.after} · "${flat10(r.shared)}"`);
  await page.close();
}

/* Taking the link IS the handover: the record, the heading the owner is
   standing on, and the surface they come back to all move together. */
{
  const page = await open({ state: "owner-draft", variant: "paper", viewport: { width: 1440, height: 960 }, clipboard: true });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    document.querySelector('[data-act="publish"]').click();
    await new Promise((r2) => setTimeout(r2, 400));
    const headBefore = (document.querySelector(".b-pressTitle") || {}).textContent || "";
    document.querySelector('[data-act="copy"]').click();
    await new Promise((r2) => setTimeout(r2, 700));
    const headAfter = (document.querySelector(".b-pressTitle") || {}).textContent || "";
    const back = document.querySelector('[data-act="owner"]');
    if (back) back.click();
    await new Promise((r2) => setTimeout(r2, 500));
    return {
      headBefore, headAfter,
      state: window.__TLCORE.F.publication.state,
      shared: (document.querySelector(".b-shared") || {}).textContent || "",
      verb: (document.querySelector('[data-act="publish"]') || {}).textContent || "",
    };
  });
  ok("taking the link changes the screen the owner is standing on",
    r.headBefore !== r.headAfter, `"${flat10(r.headBefore)}" -> "${flat10(r.headAfter)}"`);
  ok("and the plan is theirs when the owner returns",
    r.state === "published" && /anyone with the link/i.test(r.shared) && /get the link/i.test(r.verb),
    `${r.state} · "${flat10(r.shared)}" · "${flat10(r.verb)}"`);
  await page.close();
}

/* Enter commits in the first field the product ever offers. */
for (const room of ["paper", "ink"]) {
  const page = await open({ state: "owner-empty", variant: room, viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(400);
  await page.fill("#b-empty-date", "3 October 2026");
  await page.press("#b-empty-date", "Enter");
  await page.waitForTimeout(450);
  const gone = await page.evaluate(() => !document.querySelector("#b-empty-date"));
  ok(`Enter sets the day in the first field · ${room}`, gone);
  await page.close();
}

/* Every label in the editor clears its own control. */
for (const room of ["paper", "ink"]) {
  const page = await open({ state: "owner-editing", variant: room, viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const gaps = await page.evaluate(() => {
    const out2 = [];
    for (const g of document.querySelectorAll(".b-editGroup")) {
      const label = g.querySelector(".b-label");
      const ctrl = g.querySelector(".b-seg, input, .b-stepBtns");
      if (!label || !ctrl) continue;
      out2.push(Math.round(ctrl.getBoundingClientRect().left - label.getBoundingClientRect().right));
    }
    return out2;
  });
  ok(`every editor label clears its control · ${room}`,
    gaps.length > 0 && gaps.every((g) => g >= 8), gaps.join(","));
  await page.close();
}

/* ONE WRITER for the pinned line. place() used to paint the at-rest
   sentence on every repaint while speak() painted the scrolled one only
   on scroll, so a resize, fonts.ready or a keystroke snapped the line
   back to a fact about the top of a plan nobody was looking at. */
{
  const page = await open({ state: "owner-editing", variant: "paper", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(420);
  const r = await page.evaluate(async () => {
    const pane = document.querySelector(".b-plan");
    pane.scrollTop = 600;
    pane.dispatchEvent(new Event("scroll"));
    await new Promise((r2) => setTimeout(r2, 350));
    const scrolled = document.querySelector(".b-gapNote").textContent;
    window.__TLCORE.settle();
    await new Promise((r2) => setTimeout(r2, 350));
    const afterSettle = document.querySelector(".b-gapNote").textContent;
    const f = document.querySelector("#b-edit-title");
    if (f) { f.value = f.value + "x"; f.dispatchEvent(new Event("input", { bubbles: true })); }
    await new Promise((r2) => setTimeout(r2, 350));
    return { scrolled, afterSettle, afterType: document.querySelector(".b-gapNote").textContent };
  });
  ok("a repaint does not revert the pinned readout",
    r.afterSettle === r.scrolled, `${flat10(r.scrolled)} -> ${flat10(r.afterSettle)}`);
  ok("nor does a keystroke in the title",
    r.afterType === r.scrolled, `${flat10(r.scrolled)} -> ${flat10(r.afterType)}`);
  await page.close();
}

/* Which segment is chosen survives a forced palette. It was carried by
   fill alone, and a forced palette repaints exactly that — measured, the
   chosen fill came back equal to the page ground. */
for (const room of ["paper", "ink"]) {
  const page = await open({
    state: "owner-editing", variant: room,
    viewport: { width: 1440, height: 960 }, forcedColors: "active",
  });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".b-seg button")];
    if (btns.length < 2) return null;
    const ground = getComputedStyle(document.querySelector(".b-field")).backgroundColor;
    const on = btns.find((x) => x.getAttribute("aria-pressed") === "true");
    const off = btns.find((x) => x.getAttribute("aria-pressed") !== "true");
    const mark = (e) => {
      const a = getComputedStyle(e, "::after");
      return a.content !== "none" && parseFloat(a.height) > 0;
    };
    return {
      ground,
      onBg: getComputedStyle(on).backgroundColor,
      offBg: getComputedStyle(off).backgroundColor,
      onMark: mark(on), offMark: mark(off),
    };
  });
  /* A fill equal to the ground is not a mark. */
  const distinct = !!r && ((r.onBg !== r.ground && r.onBg !== r.offBg) || (r.onMark && !r.offMark));
  ok(`the chosen segment is visibly chosen in a forced palette · ${room}`,
    distinct, JSON.stringify(r));
  await page.close();
}

/* The card names itself with the words it paints — including the one
   qualifier that keeps a cached preview honest a month later. */
for (const room of ["paper", "ink"]) {
  const page = await open({ state: "unfurl", variant: room, viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  const named = await page.evaluate(() => {
    const a = [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label"));
    return a.find((l) => /when this was sent|the day/i.test(l)) || a.join(" | ");
  });
  ok(`the card says what it paints · ${room}`,
    /when this was sent/i.test(flat10(named)) || /the day/i.test(flat10(named)),
    flat10(named).slice(0, 80));
  await page.close();
}

/* The disclosure does not speak its own typographic mark: generated
   content joins the accessible name, on a role that already exposes its
   own state. */
for (const room of ["paper", "ink"]) {
  const page = await open({ state: "phone", variant: room, viewport: { width: 390, height: 844 } });
  await page.waitForTimeout(400);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const d = nodes.find((n) => /disclosure|button/i.test(n.role?.value || "")
    && /behind you/i.test(n.name?.value || ""));
  ok(`the disclosure does not announce its own mark · ${room}`,
    !!d && !/[+−–-]\s*$/.test((d.name?.value || "").trim()),
    d ? d.name.value : "not found");
  await page.close();
}

/* The strap does not point below at a link that is above it. */
{
  const page = await open({ state: "owner-flight", variant: "paper", viewport: { width: 1440, height: 960 } });
  await page.waitForTimeout(400);
  await page.click('[data-act="publish"]');
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const live = document.querySelector(".b-live");
    const field = document.querySelector(".b-linkField");
    if (!live || !field) return null;
    return {
      text: live.textContent,
      liveTop: Math.round(live.getBoundingClientRect().top),
      fieldTop: Math.round(field.getBoundingClientRect().top),
    };
  });
  const saysBelow = r && /below/i.test(r.text);
  ok("the strap does not say 'below' when the link is above it",
    !!r && (!saysBelow || r.fieldTop > r.liveTop),
    r ? `"${flat10(r.text)}" live@${r.liveTop} link@${r.fieldTop}` : "missing");
  await page.close();
}

/* The forced palette's "this one" ring belongs to what is next, never to
   the past. */
{
  const page = await open({
    state: "day", variant: "paper",
    viewport: { width: 390, height: 844 }, forcedColors: "active",
  });
  await page.waitForTimeout(400);
  const widths = await page.evaluate(async () => {
    const d = document.querySelector(".b-back summary, summary");
    if (d) d.click();
    await new Promise((r2) => setTimeout(r2, 400));
    return [...document.querySelectorAll(".b-back .b-tick")]
      .map((t) => getComputedStyle(t).borderTopWidth);
  });
  ok("the past carries no ring that means 'this one'",
    widths.length > 0 && new Set(widths).size === 1, widths.join(","));
  await page.close();
}


await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
