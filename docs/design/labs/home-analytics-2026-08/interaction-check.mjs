// The behaviour gate for Lately.
//
//   node interaction-check.mjs            (run from the lab directory)
//
// Owned by the engagement. Every confirmed panel finding gets an assertion
// here, written FIRST and watched failing against the unfixed file. A rule
// that has never fired is not a rule.
//
// What this gate is aimed at, beyond the universal floor: this surface is an
// instrument, and an instrument's defects are arithmetic ones. A header that
// disagrees with the marks beneath it, a missing source resolving to a
// fabricated zero, a state carried only in ink density — none of those are
// visible in a screenshot, and all three have shipped in this estate before.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/* Playwright, resolved from wherever it actually is. ESM resolves a bare
   specifier from the importing module's directory upward, and a lab inside
   docs/ has no node_modules above it until the workspace root. Walk. */
const { chromium } = await (async () => {
  const norm = (m) => (m?.chromium ? m : m?.default ?? m);
  const roots = [process.cwd(), path.resolve("."), path.resolve("../../../../.."), path.resolve("../../../../../collateral")];
  for (const root of roots) {
    try {
      const require = createRequire(path.join(root, "_resolve.cjs"));
      return norm(await import(pathToFileURL(require.resolve("@playwright/test")).href));
    } catch { /* next root */ }
  }
  throw new Error("@playwright/test could not be resolved. Run from a directory that can see it.");
})();

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
   every "phone" assertion written against one is proving the desk. */
async function open({ state, variant, viewport, touch, reducedMotion, raw } = {}) {
  const vp = viewport ?? { width: 1440, height: 960 };
  const isTouch = touch ?? vp.width <= 480;
  const context = await browser.newContext({
    viewport: vp, isMobile: isTouch, hasTouch: isTouch,
    ...(reducedMotion ? { reducedMotion: "reduce" } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));
  const url = new URL(MASTER);
  if (raw) {
    for (const [k, v] of Object.entries(raw)) url.searchParams.set(k, v);
  } else {
    if (state) url.searchParams.set("state", state);
    url.searchParams.set("v", variant ?? config.defaultVariant);
  }
  await page.goto(url.href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(reducedMotion ? 120 : 1800);
  return page;
}

/* ══ universal floor ═══════════════════════════════════════════════ */

for (const state of config.states) {
  for (const vp of config.viewports) {
    const page = await open({ state, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile), reducedMotion: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    ok(`no sideways scroll · ${state} @ ${vp.name}`, overflow <= 1, `${overflow}px`);
    await page.close();
  }
}

/* Focus and names: everything interactive is reachable, visible, and named. */
for (const state of config.states) {
  const page = await open({ state, reducedMotion: true });
  const audit = await page.evaluate(() => {
    const out = { unnamed: [], invisible: [], stops: 0 };
    const interactive = Array.from(
      document.querySelectorAll("button, a[href], [tabindex], input, textarea, select, [role='button'], [role='checkbox']"),
    );
    for (const el of interactive) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.01;
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
      const focusable = el.tabIndex >= 0;
      if (focusable) out.stops += 1;
      if (visible && !name) out.unnamed.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
      if (!visible && focusable && cs.pointerEvents !== "none") out.invisible.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    }
    return out;
  });
  ok(`every visible interactive element has an accessible name · ${state}`, audit.unnamed.length === 0, audit.unnamed.slice(0, 4).join(", "));
  ok(`nothing invisible can take focus · ${state}`, audit.invisible.length === 0, audit.invisible.slice(0, 4).join(", "));
  await page.close();
}

{
  const page = await open({ state: "full", reducedMotion: true });
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

  const clipped = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("*")) {
      if (!el.childNodes.length) continue;
      const cs = getComputedStyle(el);
      if (cs.overflow !== "hidden" && cs.overflowX !== "hidden") continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      if (cs.textOverflow === "ellipsis") continue;
      /* Screen-reader-only text is not clipped content — it is content
         routed to a different channel on purpose, and it trips this check
         by construction (1px box, clip rect, real string). Excluded here,
         and the exclusion is paid for by the assertions below, which prove
         every such string is non-empty and still announced. */
      if (el.closest(".sr")) continue;
      const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
      if (text) bad.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    }
    return bad.slice(0, 6);
  });
  ok("no silent text clipping (hidden overflow without ellipsis)", clipped.length === 0, clipped.join(", "));

  /* The price of excluding .sr above: every one of them must carry a real
     sentence and still reach the accessibility tree. */
  const spoken = await page.evaluate(() => {
    const srs = Array.from(document.querySelectorAll(".sr"));
    return {
      count: srs.length,
      empty: srs.filter((e) => e.textContent.trim().length < 8).length,
      hidden: srs.filter((e) => e.closest("[aria-hidden='true']")).length,
    };
  });
  ok("every screen-reader line carries a real sentence", spoken.count > 0 && spoken.empty === 0, `${spoken.empty} short of ${spoken.count}`);
  ok("no screen-reader line is buried under aria-hidden", spoken.hidden === 0, `${spoken.hidden}`);
  await page.close();
}

/* ══ the URL contract ══════════════════════════════════════════════
   Non-negotiable 12. A harness that accepts a key it does not have grades
   work that does not exist. */
{
  for (const bad of [{ state: "resting" }, { state: "" }, { v: "c" }, { state: "full", v: "sepia" }, { state: "full", motion: "slow" }]) {
    const page = await open({ raw: bad, reducedMotion: true });
    const stopped = await page.evaluate(() => Boolean(window.__LATELY_FATAL));
    const rendered = await page.evaluate(() => Boolean(document.querySelector(".kpis, .hero")));
    ok(`unknown key stops rather than rendering the default · ${JSON.stringify(bad)}`, stopped && !rendered);
    await page.close();
  }
  for (const state of config.states) {
    for (const variant of config.variants) {
      const page = await open({ state, variant, reducedMotion: true });
      const fine = await page.evaluate(() => !window.__LATELY_FATAL && window.__LATELY_READY === true);
      ok(`declared key renders · ${state} @ ${variant}`, fine);
      await page.close();
    }
  }
}

/* ══ one accessor, one arithmetic ══════════════════════════════════
   Self-contradicting counts are the class that spends the credibility of
   the whole product. Every figure on this screen derives from D; these
   assertions prove the screen agrees with itself, from the DOM. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const read = await page.evaluate(() => {
    const num = (sel) => Number(document.querySelector(sel)?.textContent.trim());
    const kpis = Array.from(document.querySelectorAll(".kpi:not(.lead) .t-num")).map((e) => e.textContent.trim());
    return {
      hero: num("#count"),
      lastFourFromData: window.LATELY_FIXTURE.weeks.slice(8).reduce((a, w) => a + w.v, 0),
      denominator: num(".kpi.lead .t-num"),
      openFromFixture: window.LATELY_FIXTURE.bound.openCount,
      kpis,
      dots: document.querySelectorAll(".dot").length,
      jobs: window.LATELY_FIXTURE.jobs.length,
      columns: document.querySelectorAll(".plot .bar").length,
      weeks: window.LATELY_FIXTURE.weeks.length,
      denominatorLine: document.querySelector('[id="m2"]')?.closest(".band")?.querySelector(".t-label")?.textContent ?? "",
    };
  });
  ok("the hero numeral equals the last four columns it sits beside", read.hero === read.lastFourFromData, `${read.hero} vs ${read.lastFourFromData}`);
  ok("the denominator card reads the fixture's open count", read.denominator === read.openFromFixture, `${read.denominator} vs ${read.openFromFixture}`);
  ok("every status card counts out of the shared denominator", read.kpis.every((v) => v === "—" || Number(v) <= read.denominator), read.kpis.join(","));
  ok("one dot per open job, none dropped", read.dots === read.jobs, `${read.dots} vs ${read.jobs}`);
  ok("twelve weeks are drawn, not summarised", read.columns === read.weeks, `${read.columns} vs ${read.weeks}`);

  /* The undesigned edge: the axis maximum is derived, so the oldest job can
     never fall off the end of its own chart. */
  const edge = await page.evaluate(() => {
    const xs = Array.from(document.querySelectorAll(".dot")).map((d) => parseFloat(d.style.getPropertyValue("--x")));
    const box = document.querySelector(".strip").getBoundingClientRect();
    const worst = Array.from(document.querySelectorAll(".dot")).map((d) => d.getBoundingClientRect());
    return { max: Math.max(...xs), inside: worst.every((r) => r.left >= box.left - 1 && r.right <= box.right + 1) };
  });
  ok("the oldest job sits inside its own axis", edge.max <= 100 && edge.inside, `max ${edge.max}%`);

  /* Nine jobs must read as nine marks. Two three days apart merge into one
     blob at narrow widths, and a strip drawing eight marks contradicts the
     card beside it stating nine. */
  for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const swarm = await open({ state: "full", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
    const spread = await swarm.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll(".dot")).map((d) => d.getBoundingClientRect());
      let worst = Infinity;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const dx = Math.abs((boxes[i].left + boxes[i].right) / 2 - (boxes[j].left + boxes[j].right) / 2);
          const dy = Math.abs((boxes[i].top + boxes[i].bottom) / 2 - (boxes[j].top + boxes[j].bottom) / 2);
          worst = Math.min(worst, Math.hypot(dx, dy));
        }
      }
      const strip = document.querySelector(".strip").getBoundingClientRect();
      return { worst, inside: boxes.every((b) => b.top >= strip.top - 1 && b.bottom <= strip.bottom + 1) };
    });
    ok(`no two marks merge into one · ${vp.width}`, spread.worst >= 12, `closest pair ${Math.round(spread.worst)}px`);
    ok(`every stacked mark stays inside the strip · ${vp.width}`, spread.inside);
    await swarm.close();
  }

  /* The columns are read against a magnitude, not only against each other. */
  const grid = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll(".gridline"));
    const max = Math.max(...window.LATELY_FIXTURE.weeks.map((w) => w.v));
    return { n: lines.length, top: lines.map((l) => Number(l.textContent)).includes(max) };
  });
  ok("the chart states its own scale", grid.n >= 2 && grid.top, JSON.stringify(grid));

  /* Provenance: which source answered, and which numbers this lab authored. */
  const cover = await page.evaluate(() => document.querySelector(".coverage")?.textContent ?? "");
  ok("the surface says which sources answered", /Tasks/.test(cover) && /Timeline/.test(cover) && /Notes/.test(cover));
  ok("the surface says which of its numbers are lab-authored", /lab-authored/.test(cover) && /bound to the shipping fixture/.test(cover));

  /* The current bucket is drawn open-topped and hatched: the week is not
     over, and a solid column there claims a completed week. */
  const partial = await page.evaluate(() => {
    const last = document.querySelector(".plot .colw:last-child .bar");
    const cs = getComputedStyle(last);
    return { hatched: cs.backgroundImage.includes("gradient"), open: parseFloat(cs.borderBottomWidth) === 0, said: Boolean(document.querySelector(".bar-val")?.textContent.includes("so far")) };
  });
  ok("the unfinished week is hatched, open-topped and says so", partial.hatched && partial.open && partial.said, JSON.stringify(partial));
  await page.close();
}

/* ══ honest degradation ════════════════════════════════════════════
   A missing source resolves to unavailable and never to a fabricated zero.
   A reader must not be able to mistake "we don't know" for "it's zero". */
{
  const page = await open({ state: "partial", reducedMotion: true });
  ok("the coverage strip names the source that did not answer",
    /Timeline<\/b>? ?did not answer|Timeline did not answer/.test(await page.evaluate(() => document.querySelector(".coverage").textContent)));
  const degraded = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".kpi:not(.lead)"));
    const na = cards.filter((c) => c.querySelector(".na"));
    return {
      count: cards.length,
      naCount: na.length,
      naReadsZero: na.some((c) => c.querySelector(".t-num").textContent.trim() === "0"),
      naHasMeter: na.some((c) => c.querySelector(".meter")),
      naSaysWords: na.every((c) => /not available/i.test(c.textContent)),
      srSaysWhy: na.every((c) => /not available/i.test(c.querySelector(".sr")?.textContent ?? "")),
      stillFive: document.querySelectorAll(".kpi").length === 5,
    };
  });
  ok("the unavailable card keeps its place in the row", degraded.stillFive && degraded.count === 4);
  ok("an unanswered source never renders as zero", degraded.naCount > 0 && !degraded.naReadsZero);
  ok("an unavailable card draws no meter (a meter of nothing is a claim)", !degraded.naHasMeter);
  ok("unavailability is carried in words, not only in ink", degraded.naSaysWords && degraded.srSaysWhy);
  await page.close();
}

/* A genuine zero is a different thing from an unknown, and says so. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const zero = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".kpi:not(.lead)")).find((c) => c.querySelector(".t-num").textContent.trim() === "0");
    if (!card) return null;
    return { isLink: card.tagName === "A", meter: Boolean(card.querySelector(".meter")), words: card.querySelector(".sr")?.textContent ?? "" };
  });
  ok("a true zero draws its meter and is not a link to an empty list", zero !== null && zero.meter && !zero.isLink, JSON.stringify(zero));
  await page.close();
}

/* ══ state carried in words, not only in ink ═══════════════════════ */
{
  const page = await open({ state: "full", reducedMotion: true });
  const words = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll(".dot"));
    const old = dots.filter((d) => d.classList.contains("old"));
    return {
      allNamed: dots.every((d) => /open \d+ days?$/.test(d.getAttribute("aria-label") ?? "")),
      ageInName: dots.every((d) => /\d+ days?/.test(d.getAttribute("aria-label") ?? "")),
      oldCount: old.length,
      sitting: window.LATELY_FIXTURE.status.sitting,
      chartSpoken: /Twelve weeks of finished work/.test(document.querySelector(".chart .sr")?.textContent ?? ""),
    };
  });
  ok("every mark names its own fact in words", words.allNamed && words.ageInName);
  ok("the marks past the fortnight line are the number the card claims", words.oldCount === words.sitting, `${words.oldCount} vs ${words.sitting}`);
  ok("the chart has a spoken equivalent, not just a shape", words.chartSpoken);
  await page.close();
}

/* ══ unanchored time ═══════════════════════════════════════════════
   Everything relative resolves against one stated reading instant, printed
   once, in every state that renders a reading. */
{
  for (const state of ["full", "partial", "quiet", "first-run", "error"]) {
    const page = await open({ state, reducedMotion: true });
    const anchored = await page.evaluate(() => {
      const want = window.LATELY_FIXTURE.readingLong;
      const hits = Array.from(document.querySelectorAll("*")).filter(
        (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.includes(want)),
      );
      return hits.length;
    });
    ok(`the reading instant is stated, once · ${state}`, anchored >= 1, `${anchored} occurrences`);
    await page.close();
  }
}

/* ══ the loading state promises only what arrives ══════════════════
   Skeletons at the real geometry of the sections that actually render. */
for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
  const skel = await open({ state: "loading", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
  const real = await open({ state: "full", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
  const shape = await skel.evaluate(() => ({
    sections: document.querySelectorAll("main section").length,
    kpis: document.querySelectorAll(".kpi").length,
    hero: document.querySelector(".hero")?.getBoundingClientRect().height ?? 0,
    kpiH: document.querySelector(".kpi")?.getBoundingClientRect().height ?? 0,
    shimmer: Array.from(document.querySelectorAll("main *")).some((e) => getComputedStyle(e).animationName !== "none"),
  }));
  const truth = await real.evaluate(() => ({
    kpis: document.querySelectorAll(".kpi").length,
    hero: document.querySelector(".hero")?.getBoundingClientRect().height ?? 0,
    kpiH: document.querySelector(".kpi")?.getBoundingClientRect().height ?? 0,
  }));
  ok(`the skeleton draws the same number of cards that arrive @ ${vp.width}`, shape.kpis === truth.kpis, `${shape.kpis} vs ${truth.kpis}`);
  ok(`the skeleton hero is the real hero's height @ ${vp.width}`, Math.abs(shape.hero - truth.hero) <= 8, `${shape.hero} vs ${truth.hero}`);
  ok(`the skeleton card is the real card's height @ ${vp.width}`, Math.abs(shape.kpiH - truth.kpiH) <= 8, `${shape.kpiH} vs ${truth.kpiH}`);
  ok(`no shimmer @ ${vp.width}`, !shape.shimmer);
  ok(`the skeleton promises no section that never renders @ ${vp.width}`, shape.sections <= 3, `${shape.sections}`);
  await skel.close(); await real.close();
}

/* ══ one instruction, once ═════════════════════════════════════════ */
{
  const page = await open({ state: "empty", reducedMotion: true });
  const empty = await page.evaluate(() => ({
    paragraphs: document.querySelectorAll("main p").length,
    buttons: document.querySelectorAll("main button").length,
    sections: document.querySelectorAll("main section").length,
  }));
  ok("the empty state says one thing and offers one move", empty.paragraphs <= 2 && empty.buttons === 1 && empty.sections === 1, JSON.stringify(empty));
  await page.close();
}

/* ══ the refusals are not a footnote ═══════════════════════════════ */
{
  const page = await open({ state: "full", reducedMotion: true });
  const limits = await page.evaluate(() => {
    const band = document.querySelector('[id="m3"]')?.closest("section");
    const ghost = document.querySelector(".ghost-plot");
    return {
      present: Boolean(band),
      tiles: band?.querySelectorAll(".limit").length ?? 0,
      ghostColumns: ghost?.children.length ?? 0,
      ghostHeight: ghost?.getBoundingClientRect().height ?? 0,
      heading: band?.querySelector(".t-sect")?.getBoundingClientRect().height ?? 0,
      m1Heading: document.querySelector('[id="m1"]')?.getBoundingClientRect().height ?? 0,
    };
  });
  ok("the limits movement is present with its three tiles", limits.present && limits.tiles === 3);
  ok("the chart that is not there is drawn as a chart", limits.ghostColumns >= 8 && limits.ghostHeight > 80, JSON.stringify(limits));
  ok("the refusals carry the same rank as the findings", limits.heading === limits.m1Heading);
  await page.close();
}

/* ══ driving with real input ═══════════════════════════════════════ */
async function travel(page, selector) {
  /* The mark is below the fold at desk height, and a mouse.move to a
     coordinate outside the viewport hovers nothing at all — the first
     version of this assertion proved that and nothing else. */
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`travel: no box for ${selector}`);
  await page.mouse.move(box.x - 60, box.y - 60);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
}
async function tap(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`tap: no box for ${selector}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

{
  const page = await open({ state: "full" });
  await travel(page, ".dot.old >> nth=0");
  await page.waitForTimeout(220);
  const tip = await page.evaluate(() => {
    const t = document.getElementById("tip");
    const r = t.getBoundingClientRect();
    return { on: t.classList.contains("on"), text: t.textContent, inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth };
  });
  ok("a real pointer over a mark names it", tip.on && /days? open/.test(tip.text));
  ok("the tooltip stays inside the window", tip.inside);
  await page.close();
}

{
  /* The same claim on a phone, which is a different code path. A tooltip
     bound to hover alone does not exist under a coarse pointer, and the
     mark it names is the only place the job's title lives. */
  const page = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true });
  await tap(page, ".dot.old >> nth=0");
  await page.waitForTimeout(220);
  const tip = await page.evaluate(() => {
    const t = document.getElementById("tip");
    const r = t.getBoundingClientRect();
    return { on: t.classList.contains("on"), text: t.textContent, inside: r.left >= 0 && r.right <= window.innerWidth };
  });
  ok("a real touch on a mark names it", tip.on && /days? open/.test(tip.text));
  ok("the tooltip stays inside a 390 window", tip.inside);

  /* Pinned, not flashed: the same tap must dismiss it, and so must a tap
     anywhere else. Without this the tip is raised and then deleted by the
     browser's own compatibility mouse sequence one frame later. */
  await tap(page, ".dot.old >> nth=0");
  await page.waitForTimeout(200);
  ok("a second touch on the same mark dismisses it", await page.evaluate(() => !document.getElementById("tip").classList.contains("on")));
  await tap(page, ".dot.old >> nth=0");
  await page.waitForTimeout(200);
  await page.touchscreen.tap(8, 8);
  await page.waitForTimeout(200);
  ok("a touch away from the marks dismisses it", await page.evaluate(() => !document.getElementById("tip").classList.contains("on")));
  await page.close();
}

{
  /* Keyboard reaches every mark, and the same tooltip appears. */
  const page = await open({ state: "full", reducedMotion: true });
  await page.evaluate(() => document.querySelector(".dot").focus());
  await page.waitForTimeout(120);
  const viaKeys = await page.evaluate(() => document.getElementById("tip").classList.contains("on"));
  ok("focus alone raises the mark's name", viaKeys);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  ok("Escape dismisses it", await page.evaluate(() => !document.getElementById("tip").classList.contains("on")));
  await page.close();
}

/* ══ the motion contract ═══════════════════════════════════════════
   Automation photographs the surface at rest, because a frame taken part
   way through a 1.7s entrance is a picture of a moment and cannot evidence
   a change. The choreography must still be drivable, and still run. */
{
  const settled = await open({ raw: { state: "full", v: "light" } });
  ok("automation lands on the settled surface by default",
    await settled.evaluate(() => document.documentElement.getAttribute("data-motion") === "settled"));
  const still = await settled.evaluate(() => {
    const bar = document.querySelector(".bar");
    return { h: bar.getBoundingClientRect().height, hero: document.getElementById("count").textContent.trim() };
  });
  ok("settled means every column is already at its height", still.h > 8, `${still.h}px`);
  await settled.close();

  const playing = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const p2 = await playing.newPage();
  const url2 = new URL(MASTER); url2.searchParams.set("state", "full"); url2.searchParams.set("v", "light"); url2.searchParams.set("motion", "play");
  await p2.goto(url2.href, { waitUntil: "load" });
  await p2.waitForTimeout(200);
  const early = await p2.evaluate(() => ({
    hero: Number(document.getElementById("count").textContent),
    lastBar: document.querySelector(".plot .colw:last-child .bar").getBoundingClientRect().height,
    record: getComputedStyle(document.querySelector(".record")).opacity,
  }));
  await p2.waitForTimeout(2000);
  const late = await p2.evaluate(() => ({
    hero: Number(document.getElementById("count").textContent),
    lastBar: document.querySelector(".plot .colw:last-child .bar").getBoundingClientRect().height,
    record: getComputedStyle(document.querySelector(".record")).opacity,
  }));
  ok("the entrance actually runs when it is asked to", early.hero < late.hero || early.lastBar < late.lastBar, JSON.stringify({ early, late }));
  ok("the figure counts up from below and never overshoots", early.hero <= late.hero, `${early.hero} then ${late.hero}`);
  ok("the previous best draws last, after the columns have grown", Number(early.record) < Number(late.record) || early.lastBar < late.lastBar);
  await p2.close(); await playing.close();
}

/* ══ motion, and the promise to switch it off ══════════════════════ */
{
  const page = await open({ state: "full", reducedMotion: true });
  const settled = await page.evaluate(() => ({
    hero: document.getElementById("count").textContent.trim(),
    target: String(window.LATELY_FIXTURE.weeks.slice(8).reduce((a, w) => a + w.v, 0)),
    barsUp: Array.from(document.querySelectorAll(".bar")).every((b) => b.getBoundingClientRect().height > 0),
  }));
  ok("under reduced motion the figure is simply correct, immediately", settled.hero === settled.target, `${settled.hero} vs ${settled.target}`);
  ok("under reduced motion every column is at its full height", settled.barsUp);
  await page.close();
}

{
  /* The count-up must never show a number the reader could mistake for the
     answer — it approaches from below and lands exactly. */
  const page = await open({ state: "full" });
  const overshoot = await page.evaluate(() => Number(document.getElementById("count").textContent));
  const target = await page.evaluate(() => window.LATELY_FIXTURE.weeks.slice(8).reduce((a, w) => a + w.v, 0));
  ok("the hero lands on the real total and stops there", overshoot === target, `${overshoot} vs ${target}`);
  await page.close();
}

/* ══ the ground-flipped twin ═══════════════════════════════════════ */
{
  const light = await open({ state: "full", variant: "light", reducedMotion: true });
  const dark = await open({ state: "full", variant: "dark", reducedMotion: true });
  const read = (page) => page.evaluate(() => ({
    ground: getComputedStyle(document.body).backgroundColor,
    card: getComputedStyle(document.querySelector(".card")).backgroundColor,
    accent: getComputedStyle(document.querySelector(".bar.live, .bar.part")).borderTopColor,
    marks: document.querySelectorAll(".bar").length,
    dots: document.querySelectorAll(".dot").length,
  }));
  const [l, d] = [await read(light), await read(dark)];
  ok("the ground actually flips", l.ground !== d.ground, `${l.ground} vs ${d.ground}`);
  ok("the twin draws the same marks, not fewer", l.marks === d.marks && l.dots === d.dots);
  await light.close(); await dark.close();
}

/* ══ the fixture binding ═══════════════════════════════════════════
   The surface must not be able to drift from the fixture it claims. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const bound = await page.evaluate(() => {
    const f = window.LATELY_FIXTURE;
    const text = document.body.textContent;
    return {
      workspace: text.includes(f.bound.workspace),
      owner: text.includes(f.bound.owner),
      titlesPresent: f.bound.fixtureTitles.every((t) => Array.from(document.querySelectorAll(".dot")).some((d) => (d.getAttribute("aria-label") ?? "").startsWith(t))),
      jobsMatchDenominator: f.jobs.length === f.bound.openCount,
    };
  });
  ok("the workspace on screen is the fixture's workspace", bound.workspace);
  ok("the owner on screen is the fixture's actor", bound.owner);
  ok("every fixture root task is a mark on the strip", bound.titlesPresent);
  ok("the strip's marks are exactly the fixture's open count", bound.jobsMatchDenominator);
  await page.close();
}

/* ══ round 1, batch 1 ═══════════════════════════════════════════════
   Written before the fixes and watched failing. Each one guards a finding
   seven blind seats raised and a fresh refuter confirmed on the problem.
   Appended into interaction-check.mjs by panel/append-assertions.mjs. */

/* ua-margins-set-the-vertical-rhythm · the declared ladder is the only
   thing setting vertical space. The source gate cannot see a UA margin,
   because the number never appears in the stylesheet. */
{
  const LADDER = [0, 4, 8, 12, 16, 24, 32, 48, 72];
  for (const state of config.states) {
    for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
      const page = await open({ state, reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
      const bad = await page.evaluate((ladder) => {
        const out = [];
        for (const el of document.querySelectorAll("header, header *, main, main *, .coverage, .coverage *")) {
          if (el.closest(".sr")) continue;
          const cs = getComputedStyle(el);
          for (const prop of ["marginTop", "marginBottom"]) {
            const v = Math.round(parseFloat(cs[prop]) * 100) / 100;
            if (!Number.isFinite(v) || v === 0) continue;
            if (!ladder.includes(v)) out.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0] + " " + prop + " " + v);
          }
        }
        return out;
      }, LADDER);
      ok("every margin is a rung on the declared ladder · " + state + " @ " + vp.width, bad.length === 0, bad.length + ": " + bad.slice(0, 3).join(" | "));
      await page.close();
    }
  }
}

/* bar-val-overprints-axis-max · the chart's right-edge labels each own
   their space, and none of them leaves the card. */
{
  for (const state of ["full", "partial", "quiet"]) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const clash = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll(".plot .gridline b, .plot .record-tag, .plot .bar-val"));
        const hit = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const boxes = labels.map((el) => ({ el: String(el.className), r: el.getBoundingClientRect() }))
          .filter((b) => b.r.width > 0 && b.r.height > 0);
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (hit(boxes[i].r, boxes[j].r)) overlaps.push(boxes[i].el + " x " + boxes[j].el);
          }
        }
        const card = document.querySelector(".card.hero");
        const cr = card ? card.getBoundingClientRect() : null;
        const escaped = cr ? boxes.filter((b) => b.r.right > cr.right + 0.5 || b.r.left < cr.left - 0.5).map((b) => b.el) : [];
        return { overlaps, escaped };
      });
      ok("no two chart labels overprint · " + state + " @ " + vp.name, clash.overlaps.length === 0, clash.overlaps.join(", "));
      ok("no chart label leaves its card · " + state + " @ " + vp.name, clash.escaped.length === 0, clash.escaped.join(", "));
      await page.close();
    }
  }
}

/* record-tag-never-paints · the previous best is named on screen, not only
   in the spoken line. Laid out is not painted: the tag must hit-test as
   itself, with no clipped ancestor, in every motion mode. */
{
  for (const variant of config.variants) {
    for (const vp of config.viewports) {
      const page = await open({ state: "full", variant, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const painted = await page.evaluate(() => {
        const tag = document.querySelector(".record-tag");
        if (!tag) return { ok: false, why: "no tag" };
        const r = tag.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return { ok: false, why: "box " + Math.round(r.width) + "x" + Math.round(r.height) };
        for (let n = tag; n && n !== document.body; n = n.parentElement) {
          const cp = getComputedStyle(n).clipPath;
          if (cp && cp !== "none") return { ok: false, why: String(n.className) + " clip-path " + cp };
        }
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { ok: Boolean(at && (at === tag || tag.contains(at))), why: at ? String(at.className) || at.tagName : "nothing" };
      });
      ok("the previous best names itself on screen · " + variant + " @ " + vp.name, painted.ok, painted.why);
      await page.close();
    }
  }
}

/* partial-column-is-closed-at-the-top · the edge that carries the meaning
   is the top one. The retired assertion measured the bottom edge, which
   sits on the baseline and is invisible, so it certified its own opposite. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const edges = await page.evaluate(() => {
    const bar = document.querySelector(".plot .colw:last-child .bar");
    const cs = getComputedStyle(bar);
    const solid = document.querySelector(".plot .colw:first-child .bar");
    const cs2 = getComputedStyle(solid);
    return {
      topOpen: parseFloat(cs.borderTopWidth) === 0,
      radiusFlat: parseFloat(cs.borderTopLeftRadius) === 0 && parseFloat(cs.borderTopRightRadius) === 0,
      rails: parseFloat(cs.borderLeftWidth) > 0 && parseFloat(cs.borderRightWidth) > 0,
      hatched: cs.backgroundImage.includes("gradient"),
      finishedIsCapped: parseFloat(cs2.borderTopLeftRadius) > 0,
    };
  });
  ok("the unfinished week is open at the edge a reader can see", edges.topOpen && edges.radiusFlat, JSON.stringify(edges));
  ok("the unfinished week keeps its two rails and its hatch", edges.rails && edges.hatched, JSON.stringify(edges));
  ok("a finished week is capped, so the two shapes differ", edges.finishedIsCapped);
  await page.close();
}

/* kpi-row-shares-no-line · the five cards are comparable only if their
   figures and their marks each sit on one line. */
{
  for (const state of ["full", "partial"]) {
    for (const w of [1280, 1440]) {
      const page = await open({ state, reducedMotion: true, viewport: { width: w, height: 960 } });
      const rows = await page.evaluate(() => {
        const nums = Array.from(document.querySelectorAll(".kpi .t-num")).map((e) => Math.round(e.getBoundingClientRect().top));
        const marks = Array.from(document.querySelectorAll(".kpi .meter, .kpi > .t-label.dim")).map((e) => Math.round(e.getBoundingClientRect().bottom));
        const span = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
        return { numSpan: span(nums), markSpan: span(marks), n: nums.length, m: marks.length };
      });
      ok("every figure in the row shares one line · " + state + " @ " + w, rows.numSpan <= 1, rows.numSpan + "px across " + rows.n);
      ok("every mark in the row shares one floor · " + state + " @ " + w, rows.markSpan <= 1, rows.markSpan + "px across " + rows.m);
      await page.close();
    }
  }
}

/* kpi-row-and-ages-card-share-an-edge · a rung, not a doubled hairline. */
{
  const LADDER = [4, 8, 12, 16, 24, 32, 48, 72];
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const gap = await page.evaluate(() => {
      const ages = document.querySelector(".card.ages");
      if (!ages) return null;
      const prev = ages.previousElementSibling;
      if (!prev) return null;
      return Math.round(ages.getBoundingClientRect().top - prev.getBoundingClientRect().bottom);
    });
    ok("the ages card stands off its neighbour by a rung · " + state, gap !== null && LADDER.includes(gap), gap + "px");
    await page.close();
  }
}

/* axis-ticks-go-ragged · the ruler is one line at every width, and every
   tick it still shows lands inside the card. The bands were measured, not
   guessed: 1140-901 and 792 down both wrap; 900-793 does not. */
{
  for (const w of [1440, 1141, 1140, 1000, 901, 900, 793, 792, 768, 560, 390]) {
    const page = await open({ state: "full", reducedMotion: true, viewport: { width: w, height: 960 }, touch: w <= 480 });
    const axis = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll(".xaxis span")).filter((s) => getComputedStyle(s).display !== "none");
      const hs = spans.map((s) => Math.round(s.getBoundingClientRect().height));
      const card = document.querySelector(".card.hero").getBoundingClientRect();
      const out = spans.filter((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && (r.right > card.right + 0.5 || r.left < card.left - 0.5);
      }).length;
      const doc = document.documentElement;
      return { max: Math.max(...hs), min: Math.min(...hs), shown: spans.length, out, overflow: doc.scrollWidth - doc.clientWidth };
    });
    ok("the week ruler stays on one line · " + w, axis.max === axis.min && axis.max <= 16, axis.min + "-" + axis.max + "px over " + axis.shown + " ticks");
    ok("no week tick leaves the card · " + w, axis.out === 0 && axis.overflow <= 1, axis.out + " out, overflow " + axis.overflow);
    await page.close();
  }
}

/* reading-rule-dangles-at-390 · a connector joins two things or it is not
   drawn. No mark is left at the end of a wrapped line. */
{
  for (const w of [390, 480, 560, 570, 600, 768, 1440]) {
    const page = await open({ state: "full", reducedMotion: true, viewport: { width: w, height: 844 }, touch: w <= 480 });
    const reading = await page.evaluate(() => {
      const rule = document.querySelector(".reading .rule");
      const parts = Array.from(document.querySelectorAll(".reading p"));
      const tops = parts.map((p) => Math.round(p.getBoundingClientRect().top));
      return {
        oneLine: new Set(tops).size === 1,
        ruleShown: rule ? getComputedStyle(rule).display !== "none" : false,
      };
    });
    ok("the reading rule is drawn only when it joins something · " + w, reading.oneLine === reading.ruleShown, JSON.stringify(reading));
    await page.close();
  }
}

/* ══ round 1, batch 2 ═══════════════════════════════════════════════
   The degraded states were assembled from full-state parts and never
   reconciled to their own claims, so two of them stated one thing and drew
   another. Written before the fixes and watched failing. */

/* quiet-state-contradicts-its-own-evidence · no claim may contradict the
   marks beside it. This is asserted for every state that draws a strip,
   not only the one where it was found, because the class is the assembly
   and not the state. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    for (const variant of config.variants) {
      const page = await open({ state, variant, reducedMotion: true });
      const claim = await page.evaluate(() => {
        /* main, not body: body.textContent includes the <script>
           element, so a template literal in the source matched and the
           assertion graded the code rather than the page. */
        const text = (document.querySelector("main") || document.body).textContent;
        const dots = Array.from(document.querySelectorAll(".dot"));
        const ages = dots.map((d) => {
          const m = (d.getAttribute("aria-label") || "").match(/open (\d+) days?/);
          return m ? Number(m[1]) : null;
        });
        const head = document.querySelector(".card.ages .band-head .t-label");
        const oldestLabel = head ? Number((head.textContent.match(/(\d+)/) || [])[1]) : null;
        const sr = document.querySelector(".card.ages .sr");
        const spoken = sr ? Number((sr.textContent.match(/(\d+) (?:job has|jobs have) been open longer/) || [])[1]) : null;
        const card = Array.from(document.querySelectorAll(".kpi")).find((c) => /fortnight/.test(c.textContent));
        const claimed = card ? Number((card.querySelector(".t-num").textContent || "").trim()) : null;
        return {
          reassures: /Nothing is sitting/.test(text),
          old: dots.filter((d) => d.classList.contains("old")).length,
          maxAge: ages.length ? Math.max(...ages) : null,
          oldestLabel,
          spoken,
          claimed,
          fortnight: window.LATELY_FIXTURE.fortnight,
        };
      });
      if (claim.reassures) {
        ok(`nothing is sitting means nothing is drawn sitting · ${state} @ ${variant}`,
          claim.old === 0 && claim.spoken === 0 && claim.maxAge < claim.fortnight,
          JSON.stringify(claim));
      }
      ok(`the oldest label is the oldest mark · ${state} @ ${variant}`,
        claim.oldestLabel === claim.maxAge, `${claim.oldestLabel} vs ${claim.maxAge}`);
      if (claim.claimed !== null) {
        ok(`the fortnight card equals the marks past the line · ${state} @ ${variant}`,
          claim.claimed === claim.old && claim.claimed === claim.spoken,
          `card ${claim.claimed}, marks ${claim.old}, spoken ${claim.spoken}`);
      }
      await page.close();
    }
  }
}

/* first-run-shows-a-41-day-old-job · an account cannot hold work older
   than the account. The bound is the days of record the state itself
   claims, not a number typed into a filter. */
{
  const page = await open({ state: "first-run", reducedMotion: true });
  const age = await page.evaluate(() => {
    const f = window.LATELY_FIXTURE;
    const first = document.querySelector(".xaxis span");
    const ages = Array.from(document.querySelectorAll(".dot")).map((d) => {
      const m = (d.getAttribute("aria-label") || "").match(/open (\d+) days?/);
      return m ? Number(m[1]) : null;
    });
    const start = new Date(f.weeks[f.weeks.length - 1].iso + "T00:00:00Z");
    const read = new Date(f.bound.readingDate + "T00:00:00Z");
    const accountDays = Math.round((read - start) / 86400000);
    return { max: ages.length ? Math.max(...ages) : null, accountDays, dots: ages.length, firstTick: first ? first.textContent : null };
  });
  ok("no job is older than the account that holds it", age.max !== null && age.max <= age.accountDays,
    `oldest ${age.max}, account ${age.accountDays} days`);
  ok("first-run still draws every open job", age.dots === 9, `${age.dots}`);
  await page.close();
}

/* age-axis-labels-are-laid-out-by-flexbox-not-by-value · every tick sits
   where its value sits. The shipped fixture's oldest job rounds the axis
   to exactly 45, which is the only reason the two ever agreed. */
{
  for (const state of ["full", "quiet", "first-run"]) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const ticks = await page.evaluate(() => {
        const strip = document.querySelector(".strip");
        if (!strip) return null;
        const box = strip.getBoundingClientRect();
        const marks = Array.from(document.querySelectorAll(".strip-scale span"));
        const axisMax = Number(strip.dataset.axisMax);
        const worst = marks.map((m) => {
          const days = /today/i.test(m.textContent) ? 0 : Number((m.textContent.match(/(\d+)/) || [])[1]);
          const want = box.left + (days / axisMax) * box.width;
          const r = m.getBoundingClientRect();
          const got = days === 0 ? r.left : (days === axisMax ? r.right : (r.left + r.right) / 2);
          return Math.abs(got - want);
        });
        const inside = marks.every((m) => {
          const r = m.getBoundingClientRect();
          return r.left >= box.left - 1 && r.right <= box.right + 1;
        });
        return { worst: marks.length ? Math.max(...worst) : 0, inside, n: marks.length, axisMax };
      });
      if (ticks) {
        ok(`every age tick stands on its own value · ${state} @ ${vp.name}`, ticks.worst <= 4, `${Math.round(ticks.worst)}px off over ${ticks.n} ticks`);
        ok(`no age tick leaves the strip · ${state} @ ${vp.name}`, ticks.inside);
      }
      await page.close();
    }
  }
}

/* The axis maximum is derived from the data, so a short account gets a
   short axis and a long tail still fits. A floor typed at 45 forced a
   three-day-old account to draw a six-week ruler. */
{
  for (const state of ["full", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const axis = await page.evaluate(() => {
      const strip = document.querySelector(".strip");
      if (!strip) return null;
      const ages = Array.from(document.querySelectorAll(".dot")).map((d) => Number((d.getAttribute("aria-label").match(/open (\d+)/) || [])[1]));
      const max = Number(strip.dataset.axisMax);
      const rule = document.querySelector(".fortnight");
      return { max, oldest: Math.max(...ages), fortnight: window.LATELY_FIXTURE.fortnight, ruleDrawn: Boolean(rule) };
    });
    if (axis) {
      ok(`the age axis is derived from its own data · ${state}`, axis.max >= axis.oldest && axis.max < axis.oldest + 10,
        `max ${axis.max}, oldest ${axis.oldest}`);
      ok(`the fortnight rule is drawn only where it can be crossed · ${state}`,
        axis.ruleDrawn === (axis.fortnight <= axis.max), `rule ${axis.ruleDrawn}, max ${axis.max}`);
    }
    await page.close();
  }
}

/* first-run-plot-has-no-scale · a mark whose height is a typed literal
   encodes nothing. The single week stands at the pitch it will hold when
   the twelve-week chart arrives, and it says in words what it draws. */
{
  const page = await open({ state: "first-run", reducedMotion: true });
  const plot = await page.evaluate(() => {
    const bar = document.querySelector(".plot .bar");
    const sr = document.querySelector(".chart .sr");
    const f = window.LATELY_FIXTURE;
    return {
      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,
      value: f.weeks[f.weeks.length - 1].v,
      spoken: sr ? sr.textContent : "",
      width: bar ? Math.round(bar.getBoundingClientRect().width) : null,
    };
  });
  ok("the first-run mark's height comes from its value, not a literal", plot.h === 100, `--h ${plot.h}`);
  ok("the first-run chart has a spoken equivalent", /finished/.test(plot.spoken) && plot.spoken.length > 20, plot.spoken.slice(0, 60));
  ok("the first-run mark stands at a real column's width", plot.width !== null && plot.width <= 60, `${plot.width}px`);
  await page.close();
}

/* count-of-one-takes-a-plural-verb · every sentence agrees with its own
   numeral, on screen and in the accessibility tree, at 0, 1 and more. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const grammar = await page.evaluate(() => {
      const bad = [];
      const check = (s, where) => {
        if (!s) return;
        if (/\bjobs\s+(has|is|was)\b/.test(s)) bad.push(`${where}: ${s.slice(0, 60)}`);
        if (/\b1 job\s+(have|are|were|haven't|aren't)\b/.test(s)) bad.push(`${where}: ${s.slice(0, 60)}`);
        if (/\bAll 1 open job\b/.test(s)) bad.push(`${where}: ${s.slice(0, 60)}`);
      };
      for (const el of document.querySelectorAll(".kpi")) {
        check(el.textContent, "card");
        check(el.querySelector(".sr")?.textContent, "card name");
      }
      for (const el of document.querySelectorAll("main p, main span, .sr")) check(el.textContent, "copy");
      return bad;
    });
    ok(`every sentence agrees with its own numeral · ${state}`, grammar.length === 0, grammar.slice(0, 3).join(" | "));
    await page.close();
  }
}

ok("zero console errors across every state and both grounds", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
