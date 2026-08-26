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

ok("zero console errors across every state and both grounds", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
