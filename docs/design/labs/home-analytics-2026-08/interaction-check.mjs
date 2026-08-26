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
  /* The scale is stated once, by whichever mark is entitled to state it.
     The ceiling label stands down when the live column already prints that
     number, so a membership test over gridline text alone now fails on a
     correct surface. Both halves are asserted instead, because either one
     on its own passes by construction: the mid gridline must always carry
     a numeral, and the peak must be printed somewhere in the plot. */
  const grid = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll(".gridline"));
    const num = (el) => {
      const m = (el.textContent || "").match(/\d+/);
      return m ? Number(m[0]) : null;
    };
    const max = Math.max(...window.LATELY_FIXTURE.weeks.map((w) => w.v));
    const labelled = lines.map(num).filter((n) => n !== null);
    const live = num(document.querySelector(".plot .colw:last-child .bar-val") ?? document.createElement("i"));
    return { n: lines.length, labelled, live, max, statesPeak: labelled.includes(max) || live === max };
  });
  ok("the chart states its own scale", grid.n >= 2 && grid.labelled.length >= 1 && grid.statesPeak, JSON.stringify(grid));
  ok("and it states it once, not twice at the same height",
    !(grid.labelled.includes(grid.max) && grid.live === grid.max), JSON.stringify(grid));

  /* Provenance: which source answered, and which numbers this lab authored. */
  const cover = await page.evaluate(() => document.querySelector(".coverage")?.textContent ?? "");
  ok("the surface says which sources answered", /Tasks/.test(cover) && /Timeline/.test(cover) && /Notes/.test(cover));
  /* Both halves, and each of them short enough for the stamp voice it
     is set in: which figures the lab authored, and which are bound to
     the shipping fixture. A single sentence carrying both ran to 134
     characters of tracked uppercase mono. */
  /* Case-insensitive, because the strip is SET in uppercase and written in
     sentence case, so which case reaches textContent is a markup detail and
     not the claim. It went red on "Lab-authored" — which is the assertion
     doing its job, and worth recording: it is not one of this round s
     vacuous ones. */
  ok("the surface says which of its numbers are lab-authored", /lab-authored/i.test(cover) && /Bound/i.test(cover) && /reading date/i.test(cover));

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
      /* The reason moved onto the group's own label when the row stopped
         carrying a child sentence it also read aloud. */
      srSaysWhy: na.every((c) => /not available/i.test(c.getAttribute("aria-label") ?? "")),
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
  ok("a true zero draws its meter", zero !== null && zero.meter, JSON.stringify(zero));
  /* The policy the retired half of this assertion was reaching for, stated
     positively so it cannot go vacuous: no card in the row offers a role the
     surface cannot honour. */
  const roles = await page.evaluate(() => ({
    links: document.querySelectorAll(".kpi a, a.kpi, .kpi[role=link]").length,
    stops: Array.from(document.querySelectorAll(".kpi")).filter((c) => c.tabIndex >= 0).length,
  }));
  ok("no card in the row offers a role the surface cannot honour", roles.links === 0 && roles.stops === 0, JSON.stringify(roles));
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
  /* loading is in this loop now. It was the one state the anchored check
     omitted, and it is the state whose entire claim is that it has not
     finished reading — so what it says about the reading instant was the
     least guarded copy on the surface. */
  for (const state of ["full", "partial", "quiet", "first-run", "error", "loading"]) {
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
  await settled.close();

  /* Measured at 150ms, not at 1800. The twelfth column finishes at 1280ms,
     so a sample taken at 1800 reads full height whether the surface settled
     or ran the whole entrance — the check passed on both and proved neither.
     Two pages, one instant, and the difference between them is the claim. */
  const heightAt150 = async (motion) => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const p = await c.newPage();
    const u = new URL(MASTER);
    u.searchParams.set("state", "full");
    u.searchParams.set("v", "light");
    if (motion) u.searchParams.set("motion", motion);
    await p.goto(u.href, { waitUntil: "load" });
    await p.waitForTimeout(150);
    const h = await p.evaluate(() => document.querySelector(".plot .colw .bar").getBoundingClientRect().height);
    await p.close(); await c.close();
    return h;
  };
  const hSettled = await heightAt150(null);
  const hPlaying = await heightAt150("play");
  ok("settled means every column is already at its height",
    hSettled > 8, `${hSettled.toFixed(2)}px at 150ms`);
  ok("and the entrance is the thing settled is measured against",
    hPlaying < hSettled - 8,
    `settled ${hSettled.toFixed(2)}px vs play ${hPlaying.toFixed(2)}px, both at 150ms`);

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
  /* The declared timeline, not a photographed frame. The old test read
     `record opacity rose OR the last bar grew`, and the right-hand half is
     a term of the check two lines above that the entrance runs at all —
     true of any entrance, so the claim could not fail for its own subject.
     The invariant is that the rule finishes after every column has: the
     columns end at 1280ms (i*40 + 340 + 500) and the rule ends at 1700ms
     (1100 + 600). Drop the delay and it goes red. */
  const seq = await p2.evaluate(() => {
    const endOf = (el, name) => {
      const a = el.getAnimations().find((x) => x.animationName === name);
      if (!a) return null;
      const t = a.effect.getComputedTiming();
      return Number(t.delay) + Number(t.activeDuration);
    };
    const bars = Array.from(document.querySelectorAll(".plot .colw .bar"))
      .map((b) => endOf(b, "grow")).filter((n) => n !== null);
    const rec = document.querySelector(".record");
    const tag = document.querySelector(".record-tag");
    return {
      lastColumn: bars.length ? Math.max(...bars) : null,
      record: rec ? endOf(rec, "draw") : null,
      tag: tag ? endOf(tag, "rise") : null,
    };
  });
  ok("the previous best draws last, after the columns have grown",
    seq.lastColumn !== null && seq.record !== null && seq.record > seq.lastColumn,
    JSON.stringify(seq));
  ok("and its tag lands after the rule it labels",
    seq.tag !== null && seq.tag > seq.record, JSON.stringify(seq));
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
      /* The guard s own precondition, asserted where it must hold. The block
         below is keyed on the all-clear sentence existing; nothing else in
         the lab asserts that it does, so a copy edit would have skipped the
         block and taken its assertions with it in silence. */
      if (state === "quiet") {
        ok(`the quiet state still says the all-clear this guard keys on · ${variant}`,
          claim.reassures, JSON.stringify({ reassures: claim.reassures }));
      }
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

/* first-run-plot-has-no-scale · the single week stands at the pitch it
   will hold when the twelve-week chart arrives, and it says in words what
   it draws.

   The height here is 100 for EVERY possible fixture value and must be: a
   solo week is its own maximum, and lately.html:281-285 argues why there is
   no scale to derive it against. So the invariant is not "the height comes
   from the value" — there is no relation to hold down — it is "the solo
   mark fills its plot". This assertion was named for the first and tests
   the second; it is source-sensitive either way (edit 100 to 50 and it goes
   red) but a check whose name and subject disagree is how the vacuous class
   starts. */
{
  const page = await open({ state: "first-run", reducedMotion: true });
  const plot = await page.evaluate(() => {
    const bar = document.querySelector(".plot .bar");
    const sr = document.querySelector(".chart .sr");
    const f = window.LATELY_FIXTURE;
    return {
      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,
      spoken: sr ? sr.textContent : "",
      width: bar ? Math.round(bar.getBoundingClientRect().width) : null,
    };
  });
  ok("the solo mark fills its plot, because one week is its own maximum", plot.h === 100, `--h ${plot.h}`);
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
        /* The name, not the leaf. Round 2 moved this sentence onto the
           group s own label and left the grammar check reading .sr, which
           is null on every status card — so the row s only content check
           was its length. A planted singular verb, a planted plural and a
           falsified denominator all passed. */
        check(el.getAttribute("aria-label"), "card name");
        check(el.querySelector(".sr")?.textContent, "card sr");
      }
      for (const el of document.querySelectorAll("main p, main span, .sr")) check(el.textContent, "copy");
      return bad;
    });
    ok(`every sentence agrees with its own numeral · ${state}`, grammar.length === 0, grammar.slice(0, 3).join(" | "));
    await page.close();
  }
}

/* ══ round 1, batch 3 ═══════════════════════════════════════════════
   Honesty in the headline, the error state and the accessibility tree.
   Written before the fixes and watched failing. */

/* hero-total-folds-the-unfinished-week · the surface quarantines the
   running week everywhere except the one number the whole page is built
   around. Drop the running bucket and the same window reads 19 against
   26 — the printed sign is produced entirely by the unflagged week. */
{
  for (const state of ["full", "partial", "quiet"]) {
    const page = await open({ state, reducedMotion: true });
    const hero = await page.evaluate(() => {
      const f = window.LATELY_FIXTURE;
      const band = document.querySelector('[id^="m1"]')?.closest(".band");
      const label = band?.querySelector(".band-head .t-label")?.textContent ?? "";
      const note = document.querySelector(".hero-note")?.textContent ?? "";
      const last = f.weeks[f.weeks.length - 1];
      return { label, note, partial: Boolean(last.partial), readingShort: f.readingShort, lastStart: last.start };
    });
    if (hero.partial) {
      ok(`the running week is named where the figure is read · ${state}`,
        /still running/.test(hero.note), hero.note.slice(0, 80));
      ok(`the window ends on the reading, not on a week's first day · ${state}`,
        hero.label.includes(hero.readingShort) && !hero.label.trim().endsWith(hero.lastStart), hero.label);
    }
    await page.close();
  }
}

/* error-state-invents-a-last-good-reading · the state built to say the
   reading failed must not stamp a successful one at the instant of the
   failure. The fixture holds no earlier reading, so there is none to print. */
{
  const page = await open({ state: "error", reducedMotion: true });
  const err = await page.evaluate(() => {
    const text = (document.querySelector("main") || document.body).textContent;
    const want = window.LATELY_FIXTURE.readingLong;
    let n = 0, i = 0;
    while ((i = text.indexOf(want, i)) >= 0) { n += 1; i += want.length; }
    return { claimsLastGood: /Last good reading/.test(text), instances: n };
  });
  /* Both halves. The phrase guard is a literal-regression guard and it does
     fail on a verbatim reintroduction — but it was the only predicate here,
     while the count beside it was computed and thrown away. The count is the
     positive statement of the policy: main prints no successful reading in
     the state built to say the reading failed. The header stamp is sanctioned
     and lives outside main, which is why the scope stays. */
  ok("the error state claims no reading it does not hold",
    !err.claimsLastGood && err.instances === 0, `${err.instances} stamps in main`);
  await page.close();
}

/* mark-hit-theft-at-390 · a stacked mark's expander covered its
   neighbour's centre, so a tap on one mark answered with another job's
   name and another day count. Euclidean distance cannot see occlusion. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      await page.locator(".dot").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      const own = await page.evaluate(() => {
        /* elementFromPoint is viewport-relative, so a strip below the fold
           reports every mark as stolen. Scroll it into view first — the
           first version of this check failed 9 of 9 at every width and was
           measuring the fold, not the occlusion. */
        const dots = Array.from(document.querySelectorAll(".dot"));
        const stolen = [];
        for (const d of dots) {
          const r = d.getBoundingClientRect();
          const at = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
          const owner = at ? at.closest(".dot") : null;
          if (owner !== d) stolen.push((d.getAttribute("aria-label") || "").slice(0, 30));
        }
        return { stolen, n: dots.length };
      });
      ok(`every mark owns its own centre · ${state} @ ${vp.name}`, own.stolen.length === 0, `${own.stolen.length} of ${own.n}: ${own.stolen.slice(0, 2).join(" | ")}`);
      await page.close();
    }
  }
}

/* two-capitalisation-rules-in-one-tab-strip · the naming contract names
   the surface the Full Briefing. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll(".tab")).map((t) => t.textContent.trim()));
  ok("the tab strip names every surface the way the contract does",
    JSON.stringify(tabs) === JSON.stringify(["Today’s Signal", "Full Briefing", "Lately"]), tabs.join(" | "));
  await page.close();
}

/* partial-drops-the-best-week-unannounced · a mark may not vanish for a
   reason the screen never gives. Timeline governs due dates; the twelve
   weekly counts and the previous best come from Tasks, which answered. */
{
  const page = await open({ state: "partial", reducedMotion: true });
  const kept = await page.evaluate(() => ({
    record: Boolean(document.querySelector(".record-tag")),
    spoken: /best week/i.test(document.querySelector(".chart .sr")?.textContent ?? ""),
    columns: document.querySelectorAll(".plot .bar").length,
  }));
  ok("a degraded state loses only what its unanswered source fed", kept.record && kept.spoken && kept.columns === 12, JSON.stringify(kept));
  await page.close();
}

/* chart-is-announced-twice · the chart has a written equivalent, and the
   visual furniture beside it is not read out as a second, looser copy —
   including eight x-axis dates that are not on the screen at all. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const heard = await page.evaluate(() => {
      const chart = document.querySelector(".chart");
      if (!chart) return null;
      const leaves = [];
      const walk = (el) => {
        if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return;
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim()) leaves.push(n.textContent.trim());
          else if (n.nodeType === 1) walk(n);
        }
      };
      walk(chart);
      const sr = chart.querySelector(".sr");
      const invisibleText = Array.from(chart.querySelectorAll("*")).filter((el) => {
        const cs = getComputedStyle(el);
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
        return own && parseFloat(cs.opacity) === 0 && cs.visibility !== "hidden" && el.getAttribute("aria-hidden") !== "true";
      }).length;
      return { leaves: leaves.length, spoken: Boolean(sr), invisibleText };
    });
    if (heard) {
      ok(`the chart is announced once · ${state}`, heard.spoken && heard.leaves === 1, `${heard.leaves} text leaves in the tree`);
      ok(`no invisible label carries live text · ${state}`, heard.invisibleText === 0, `${heard.invisibleText}`);
    }
    await page.close();
  }
}

/* terminal-states-lose-their-heading-and-announce-nothing · the two
   states where something has gone wrong are the two a reader navigating
   by heading finds empty, and neither ever announces. */
{
  for (const state of config.states) {
    const page = await open({ state, reducedMotion: true });
    const structure = await page.evaluate(() => {
      const heads = Array.from(document.querySelectorAll("main h1, main h2, main h3"));
      const sections = Array.from(document.querySelectorAll("main section"));
      const unlabelled = sections.filter((s) => {
        const id = s.getAttribute("aria-labelledby");
        return !id || !document.getElementById(id);
      }).length;
      return {
        heads: heads.length,
        unlabelled,
        status: document.querySelectorAll("[role=status]").length,
        alert: document.querySelectorAll("[role=alert]").length,
      };
    });
    ok(`every state offers a heading inside main · ${state}`, structure.heads > 0, `${structure.heads}`);
    ok(`every section names itself · ${state}`, structure.unlabelled === 0, `${structure.unlabelled} unlabelled`);
    if (state === "loading") ok("the loading state announces politely", structure.status === 1 && structure.alert === 0, JSON.stringify(structure));
    if (state === "error") ok("the error state announces assertively", structure.alert === 1 && structure.status === 0, JSON.stringify(structure));
    if (state !== "loading" && state !== "error") {
      ok(`no live region where nothing is happening · ${state}`, structure.status === 0 && structure.alert === 0, JSON.stringify(structure));
    }
    await page.close();
  }
}

/* ══ round 1, batch 4 ═══════════════════════════════════════════════
   Provenance, the twin, the refusals and the tooltip's anchor.
   Written before the fixes and watched failing. */

/* coverage-strip-sits-outside-every-landmark · the surface's provenance
   apparatus is the thing that makes its honesty checkable, and it was the
   one region landmark navigation could not reach. */
{
  for (const state of config.states) {
    const page = await open({ state, reducedMotion: true });
    const marks = await page.evaluate(() => {
      const strip = document.querySelector(".coverage");
      const orphans = Array.from(document.querySelectorAll("header, main, footer, aside, [role]"))
        .length;
      return {
        tag: strip ? strip.tagName.toLowerCase() : null,
        named: strip ? Boolean(strip.getAttribute("aria-label")) : false,
        inMain: strip ? Boolean(strip.closest("main")) : false,
        landmarks: orphans,
      };
    });
    ok(`the provenance strip is a landmark of its own · ${state}`,
      marks.tag === "footer" && marks.named && !marks.inMain, JSON.stringify(marks));
    await page.close();
  }
}

/* dark-denominator-card-is-a-glare-panel · the twin flips the grounds and
   the marks keep their jobs. The denominator plate inverted to pure white
   and became the brightest object on a near-black page, in the middle of
   the row whose actual status marks are 3px meters. */
{
  const page = await open({ state: "full", variant: "dark", reducedMotion: true });
  const lum = await page.evaluate(() => {
    const rel = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const lead = document.querySelector(".kpi.lead");
    const others = Array.from(document.querySelectorAll(".kpi:not(.lead)"));
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const plate = rel(getComputedStyle(lead).backgroundColor);
    const numeral = rel(getComputedStyle(lead.querySelector(".t-num")).color);
    return {
      plate,
      brightest: Math.max(...others.map((o) => rel(getComputedStyle(o).backgroundColor))),
      contrast: ratio(plate, numeral),
    };
  });
  ok("the denominator plate is not the brightest thing on the dark ground", lum.plate < 0.9, `luminance ${lum.plate.toFixed(3)}`);
  ok("the denominator plate still reads as its own kind of surface", Math.abs(lum.plate - lum.brightest) > 0.05, `${lum.plate.toFixed(3)} vs ${lum.brightest.toFixed(3)}`);
  ok("its figure still clears AA on that plate", lum.contrast >= 4.5, `${lum.contrast.toFixed(2)}:1`);
  await page.close();
}

/* stale-tip-strands-on-scroll · the tip is placed once in viewport
   coordinates and the surface scrolls inside its own container, so a
   pinned label ends up naming a mark it no longer points at. A focused
   mark is hidden and restored; only a touch pin is retired. */
{
  const page = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true });
  await page.locator(".dot").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box = await page.locator(".dot").first().boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => document.getElementById("tip").classList.contains("on"));
  /* The document, not .scroll. Round 2 moved scroll ownership to the
     document; .scroll now carries only overflow-x: clip, so scrollBy on it
     is a no-op and this guard has been scrolling nothing ever since. */
  await page.evaluate(() => window.scrollBy(0, 260));
  await page.waitForTimeout(220);
  const after = await page.evaluate(() => {
    const t = document.getElementById("tip");
    if (!t.classList.contains("on")) return { on: false, drift: 0 };
    const anchor = document.querySelector(".dot");
    const a = anchor.getBoundingClientRect();
    const r = t.getBoundingClientRect();
    return { on: true, drift: Math.round(Math.abs(r.bottom - a.top)) };
  });
  ok("a pinned label is dismissed or follows its mark", before && (!after.on || after.drift <= 24), JSON.stringify(after));
  await page.close();
}

/* august-inside-a-july-reading · a refusal that names a month the reading
   has not reached cannot be resolved either way. Every date on the surface
   resolves against the stated instant. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const dates = await page.evaluate(() => {
      const text = (document.querySelector("main") || document.body).innerText;
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const found = [];
      for (const m of months) {
        /* Two source backslashes, not four. Four compile to a literal
           backslash followed by b, which main never contains — the guard
           was structurally empty for four rounds. The lookbehind is the
           refuter s correction: a month preceded by a day-of-month is a
           date ("4 May" in the chart s spoken line), not a bare month, and
           without it the corrected escape turns the gate red on a surface
           that is right. */
        const re = new RegExp("(?<!\\d\\s)\\b" + m + "\\b(?!\\s+\\d{4})", "g");
        if (re.test(text)) found.push(m);
      }
      return found;
    });
    /* The instrument, proved alive on a fixed probe before it is trusted
       on the page. This is the assertion the vacuous-guard class needs:
       not "did it find nothing", but "would it find something". */
    const monthProbe = await page.evaluate(() => {
      /* One construction, three probes, a fresh RegExp per call. Written
         first as two regex literals carrying doubled backslashes — which
         is the defect this whole block exists to close, and would have
         made two of the three cases false whatever they were given. A
         fresh instance each time also keeps the g flag s lastIndex from
         making the answer depend on the order the cases are read. */
      const src = "(?<!\\d\\s)\\bAugust\\b(?!\\s+\\d{4})";
      const hit = (s) => new RegExp(src).test(s);
      return { bare: hit("finished in August, before the week is out"), dated: hit("August 2026"), day: hit("4 August") };
    });
    ok(`the month guard can still see a bare month · ${state}`,
      monthProbe.bare && !monthProbe.dated && !monthProbe.day, JSON.stringify(monthProbe));
    ok(`no month is named without its year · ${state}`, dates.length === 0, dates.join(", "));
    await page.close();
  }
}

/* refusals-written-in-the-studio-vocabulary · the movement that is the
   product's signature was written in the vocabulary of the team that built
   it, and is the only place on the surface that says "we". */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const voice = await page.evaluate(() => {
      const text = (document.querySelector("main") || document.body).innerText;
      const banned = ["snapshot writer", "callers", "recorder", "structured", "accrues", "periods", "provider"];
      const hits = banned.filter((w) => new RegExp("\\b" + w + "\\b", "i").test(text));
      const firstPerson = /\bwe\b/i.test(text);
      const lowerStart = Array.from(document.querySelectorAll("main p"))
        .map((p) => p.textContent.trim())
        .filter((t) => /^(and|but|or|so)\b/i.test(t));
      return { hits, firstPerson, lowerStart };
    });
    ok(`the refusals speak the reader's language · ${state}`, voice.hits.length === 0, voice.hits.join(", "));
    ok(`the surface never says "we" · ${state}`, !voice.firstPerson);
    ok(`no sentence begins as the back half of another · ${state}`, voice.lowerStart.length === 0, voice.lowerStart.join(" | "));
    await page.close();
  }
}

/* ghost-plot-orphaned-from-its-refusal · three refusals with separate
   causes sat above one drawn-but-empty plot that named none of them. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const ghost = await page.evaluate(() => {
    const fig = document.querySelector(".ghost");
    const tiles = Array.from(document.querySelectorAll(".limit .t-head")).map((h) => h.textContent.trim());
    const head = fig?.querySelector(".t-head")?.textContent.trim() ?? "";
    const plot = fig?.querySelector(".ghost-plot");
    const baseline = plot ? getComputedStyle(plot, "::after").content !== "none" : false;
    return { tag: fig ? fig.tagName.toLowerCase() : null, head, tiles, baseline };
  });
  ok("the drawn-but-empty plot names the refusal it draws",
    ghost.tiles.some((t) => ghost.head.includes(t)), `"${ghost.head}" against ${ghost.tiles.join(" | ")}`);
  ok("it is marked up as the figure it is", ghost.tag === "figure");
  ok("its columns stand on a baseline", ghost.baseline);
  await page.close();
}

/* rail-glyphs-outside-the-locked-faces · three of the four rail marks were
   painted by whatever the operating system supplied, because Geist carries
   none of them. The audit reads the authored family, never the painted one. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const rail = await page.evaluate(() => {
    const marks = Array.from(document.querySelectorAll(".rail i"));
    return {
      n: marks.length,
      withText: marks.filter((m) => m.textContent.trim().length > 0).length,
      withSvg: marks.filter((m) => m.querySelector("svg")).length,
    };
  });
  ok("no rail mark is set in a face the lock does not own", rail.withText === 0 && rail.withSvg === rail.n, JSON.stringify(rail));
  await page.close();
}

/* openable-is-a-promise-nothing-keeps · nothing on this surface opens a
   finished job, so the line inviting the reader to try was an affordance
   the screen does not carry. */
{
  for (const state of ["full", "partial", "quiet", "loading"]) {
    const page = await open({ state, reducedMotion: true });
    const claim = await page.evaluate(() => (document.querySelector("main") || document.body).innerText);
    ok(`no sentence advertises a move the surface does not carry · ${state}`, !/openable/i.test(claim));
    await page.close();
  }
}

/* no-pressed-state-anywhere · under a coarse pointer there is no hover, so
   a press is the only channel that can confirm a touch landed on a card. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const press = await page.evaluate(() => {
    const read = (sel, pseudo) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el, pseudo);
      return cs.transform + "|" + cs.backgroundColor + "|" + cs.borderColor;
    };
    const has = (sel) => Array.from(document.styleSheets).some((sh) => {
      let rules; try { rules = sh.cssRules; } catch { return false; }
      return Array.from(rules || []).some((r) => r.selectorText && r.selectorText.includes(sel));
    });
    return {
      kpi: has("a.kpi:active"),
      btn: has(".btn:active"),
      dot: has(".dot:active"),
      cursor: getComputedStyle(document.querySelector(".dot")).cursor,
    };
  });
  ok("the marks invite the pointer", press.cursor === "pointer", press.cursor);
  /* The KPI row is read, not operated: it carries no link role and no press,
     so it is no longer in this roster. The press states that remain are
     measured from what paints, in the batch-5 block below — this selector
     test survives only as a cheap declaration check for the two controls
     that are still controls. */
  ok("every control that is a control acknowledges a press", press.btn && press.dot, JSON.stringify(press));
  await page.close();
}

/* ══ round 2, batch 5 ═══════════════════════════════════════════════
   Two of these replace assertions this gate already had and could not
   fail. Written before the fixes and watched failing. */

/* rise-fill-outranks-every-interaction-rule · the retired assertion
   grepped document.styleSheets for the selector text and never rendered
   anything, so it passed on a rule pinned dead by an animation's fill.
   This one holds a real pointer down and measures what paints. */
{
  for (const mode of [null, "play"]) {
    /* The error state is where the surface's one real control lives. The
       row above it is read, not operated, so its press was retired with its
       link role — this measures a control that is still a control. */
    const page = await open({ raw: mode ? { state: "error", v: "light", motion: mode } : { state: "error", v: "light" } });
    await page.waitForTimeout(mode === "play" ? 2000 : 200);
    const card = page.locator(".btn").first();
    const box = await card.boundingBox();
    const rest = await page.evaluate(() => {
      const el = document.querySelector(".btn");
      const cs = getComputedStyle(el);
      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };
    });
    await page.mouse.move(box.x - 40, box.y - 40);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await page.waitForTimeout(200);
    const hover = await page.evaluate(() => {
      const el = document.querySelector(".btn");
      const cs = getComputedStyle(el);
      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };
    });
    await page.mouse.down();
    await page.waitForTimeout(180);
    const press = await page.evaluate(() => {
      const el = document.querySelector(".btn");
      const cs = getComputedStyle(el);
      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };
    });
    await page.mouse.up();
    const key = (s) => `${s.t}|${s.bg}|${s.bd}`;
    ok(`the entrance releases its elements back to the cascade · motion=${mode ?? "settled"}`,
      await page.evaluate(() => Array.from(document.querySelectorAll(".rise")).every((el) => {
        const f = getComputedStyle(el).animationFillMode;
        return f !== "both" && f !== "forwards";
      })), "a forwards fill outranks every author declaration, permanently");
    ok(`a control acknowledges a press, measured from what paints · motion=${mode ?? "settled"}`,
      key(press) !== key(hover) && key(hover) !== key(rest),
      `rest ${key(rest)} / hover ${key(hover)} / press ${key(press)}`);
    await page.close();
  }
}

/* keyboard-cannot-scroll-the-reading-surface · the primary gesture of a
   reading instrument, on a fresh load, with nothing clicked. */
{
  for (const state of config.states) {
    for (const vp of config.viewports) {
      const page = await open({ state, reducedMotion: true, viewport: { width: vp.width, height: vp.height }, touch: Boolean(vp.isMobile) });
      const has = await page.evaluate(() => {
        const el = document.scrollingElement;
        return { overflow: el.scrollHeight - el.clientHeight, focus: document.activeElement === document.body };
      });
      if (has.overflow > 8) {
        await page.keyboard.press("PageDown");
        await page.waitForTimeout(160);
        const moved = await page.evaluate(() => document.scrollingElement.scrollTop);
        ok(`page down reads the page · ${state} @ ${vp.name}`, moved > 0, `${moved}px of ${has.overflow}, focus on body ${has.focus}`);
      }
      await page.close();
    }
  }
}

/* skeleton-draws-the-data-it-says-it-is-still-reading · a state that says
   it is still reading may not publish the reading. The retired assertions
   built both DOMs from the same fixture in the same frame and compared
   them to each other, so they could not fail. */
{
  const page = await open({ state: "loading", reducedMotion: true });
  const marks = await page.evaluate(() => {
    const bars = Array.from(document.querySelectorAll(".sk-wrap .bar"));
    const meters = Array.from(document.querySelectorAll(".sk-wrap .meter i"));
    const dots = Array.from(document.querySelectorAll(".sk-wrap .dot"));
    const val = (el, p) => el.style.getPropertyValue(p);
    const real = window.LATELY_FIXTURE.scopes.full.jobs.map((j) => j.age);
    const skx = dots.map((d) => Number(val(d, "--x")));
    const realx = real.map((a) => (a / 45) * 100);
    return {
      barHeights: new Set(bars.map((b) => val(b, "--h"))).size,
      meterFills: new Set(meters.map((m) => val(m, "--f"))).size,
      part: document.querySelectorAll(".sk-wrap .bar.part").length,
      zero: document.querySelectorAll(".sk-wrap .meter i.zero").length,
      dotsMatchReal: JSON.stringify(skx.map((n) => Math.round(n))) === JSON.stringify(realx.map((n) => Math.round(n))),
      tagVisible: document.querySelector(".sk-wrap .record-tag")
        ? getComputedStyle(document.querySelector(".sk-wrap .record-tag")).visibility !== "hidden"
        : false,
    };
  });
  ok("the skeleton's columns publish no reading", marks.barHeights === 1, `${marks.barHeights} distinct heights`);
  ok("the skeleton's meters publish no reading", marks.meterFills === 1, `${marks.meterFills} distinct fills`);
  ok("the skeleton draws no partial-week treatment of a week nobody read", marks.part === 0);
  ok("the skeleton draws no zero it has not read", marks.zero === 0);
  ok("the skeleton's marks are not the real ages", !marks.dotsMatchReal);
  ok("the skeleton labels no previous best", !marks.tagVisible);
  await page.close();
}

/* The skeleton must also survive the condition it exists for: a client
   that holds no data at all. */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.addInitScript(() => {
    const strip = () => {
      const f = window.LATELY_FIXTURE;
      if (!f) return;
      f.weeks = [];
      for (const k of Object.keys(f.scopes ?? {})) f.scopes[k].jobs = [];
      f.jobs = [];
    };
    Object.defineProperty(window, "LATELY_FIXTURE", {
      configurable: true,
      set(v) { delete window.LATELY_FIXTURE; window.LATELY_FIXTURE = v; strip(); },
      get() { return undefined; },
    });
  });
  const url = new URL(MASTER);
  url.searchParams.set("state", "loading");
  url.searchParams.set("v", "light");
  await page.goto(url.href, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const ready = await page.evaluate(() => window.__LATELY_READY === true);
  ok("the loading state renders with no reading to draw from", ready && errs.length === 0, errs.slice(0, 2).join(" | "));
  await page.close();
  await context.close();
}

/* loading-frame-is-a-movement-short · the skeleton is the height of the
   page that follows, not two thirds of it. */
{
  for (const vp of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const skel = await open({ state: "loading", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
    const real = await open({ state: "full", reducedMotion: true, viewport: vp, touch: vp.width <= 480 });
    const h = (p) => p.evaluate(() => ({
      sections: document.querySelectorAll("main section").length,
      height: Math.round(document.querySelector("main").getBoundingClientRect().height),
    }));
    const [a, b] = [await h(skel), await h(real)];
    ok(`the loading frame draws every section that arrives @ ${vp.width}`, a.sections === b.sections, `${a.sections} vs ${b.sections}`);
    ok(`the loading frame is the height of the page that follows @ ${vp.width}`, Math.abs(a.height - b.height) <= 8, `${a.height} vs ${b.height}`);
    await skel.close(); await real.close();
  }
}

/* fortnight-label-escapes-its-card · a label that leaves its strip is
   clipped by an ancestor, so the document reports no overflow and every
   width check passes over a destroyed word. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    for (const w of [320, 360, 390, 414, 560, 768, 1024, 1280, 1440]) {
      const page = await open({ state, reducedMotion: true, viewport: { width: w, height: 900 }, touch: w <= 480 });
      const label = await page.evaluate(() => {
        const rule = document.querySelector(".fortnight");
        if (!rule) return null;
        const span = rule.querySelector("span");
        const strip = document.querySelector(".strip").getBoundingClientRect();
        const r = span.getBoundingClientRect();
        const scroll = document.querySelector(".scroll") || document.scrollingElement;
        return {
          inside: r.left >= strip.left - 0.5 && r.right <= strip.right + 0.5,
          clipped: scroll.scrollWidth - scroll.clientWidth,
          right: Math.round(r.right), stripRight: Math.round(strip.right),
        };
      });
      if (label) {
        ok(`the fortnight label stays inside its strip · ${state} @ ${w}`, label.inside, `${label.right} vs ${label.stripRight}`);
        ok(`nothing is clipped away inside the scroller · ${state} @ ${w}`, label.clipped <= 1, `${label.clipped}px`);
      }
      await page.close();
    }
  }
}

/* kpi-cards-announce-their-fact-twice · the row's authored sentence is
   the whole name, not a prefix to itself. */
{
  for (const state of ["full", "partial", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const heard = await page.evaluate(() => {
      const out = [];
      for (const card of document.querySelectorAll(".kpi:not(.lead)")) {
        /* The sentence is the group's own label now, so the card should
           contribute no text leaves of its own and exactly one name. */
        const leaves = [];
        const walk = (el) => {
          if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return;
          for (const n of el.childNodes) {
            if (n.nodeType === 3 && n.textContent.trim()) leaves.push(n.textContent.trim());
            else if (n.nodeType === 1) walk(n);
          }
        };
        walk(card);
        out.push({ leaves: leaves.length, named: (card.getAttribute("aria-label") || "").length > 12 });
      }
      return out;
    });
    ok(`each card in the row says its fact once · ${state}`,
      heard.every((c) => c.leaves === 0 && c.named), JSON.stringify(heard));
    await page.close();
  }
}

/* status-indigo-is-the-only-mark-the-dark-twin-forgets · the status marks
   take the ground flip like every other mark. */
{
  for (const variant of config.variants) {
    const page = await open({ state: "full", variant, reducedMotion: true });
    const glyphs = await page.evaluate(() => {
      const rel = (rgb) => {
        const p = (rgb.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
      };
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const out = [];
      for (const g of document.querySelectorAll(".kpi .glyph")) {
        const shape = g.querySelector("svg [stroke]");
        if (!shape) continue;
        const stroke = getComputedStyle(shape).stroke;
        const plate = getComputedStyle(g).backgroundColor;
        const card = getComputedStyle(g.closest(".kpi")).backgroundColor;
        const comp = (fg, bg) => {
          const f = (fg.match(/[\d.]+/g) || []).map(Number);
          const b = (bg.match(/[\d.]+/g) || []).map(Number);
          const a = f.length > 3 ? f[3] : 1;
          return `rgb(${a * f[0] + (1 - a) * b[0]}, ${a * f[1] + (1 - a) * b[1]}, ${a * f[2] + (1 - a) * b[2]})`;
        };
        out.push({ r: ratio(rel(stroke), rel(comp(plate, card))), stroke });
      }
      return out;
    });
    ok(`every status mark clears the non-text floor · ${variant}`,
      glyphs.length > 0 && glyphs.every((g) => Number(g.r.toFixed(2)) >= 3), glyphs.map((g) => g.r.toFixed(2)).join(" "));
    await page.close();
  }
}

/* ══ round 3, batch 2 ═══════════════════════════════════════════════
   Six surface findings, each written before its fix and watched failing on
   the surface as it stood: the scale stated twice at the same height, a
   0.0px rung, user-select auto with the fixture's own magnitudes in the
   text, a last line 7.6px wide carrying one digit, a mark inked #111111
   after one tap, and a refusal body running to 716px. */

/* axis-max-and-live-week-print-the-same-number · max is Math.max(D.peak,
   D.bestPrior) and D.peak counts the running week, so on any fixture where
   this week is the best week the top gridline and the live column printed
   the same numeral at the same height. The peak must still be stated —
   by exactly one of them. */
{
  for (const state of ["full", "partial", "quiet"]) {
    const page = await open({ state, reducedMotion: true });
    const scale = await page.evaluate(() => {
      const num = (el) => {
        const m = (el?.textContent || "").match(/\d+/);
        return m ? Number(m[0]) : null;
      };
      const labelled = Array.from(document.querySelectorAll(".gridline")).map(num).filter((n) => n !== null);
      const live = num(document.querySelector(".plot .colw:last-child .bar-val"));
      const drawn = document.querySelectorAll(".gridline").length;
      const peak = Math.max(...Array.from(document.querySelectorAll(".plot .colw .bar"))
        .map((b) => Number(b.style.getPropertyValue("--h")) || 0));
      return { labelled, live, drawn, peakIsLive: peak === 100 };
    });
    ok(`the chart states its peak exactly once · ${state}`,
      !(scale.peakIsLive && scale.live !== null && scale.labelled.includes(scale.live)),
      JSON.stringify(scale));
    ok(`and the rule is still drawn where the numeral stood down · ${state}`,
      scale.drawn >= 2, JSON.stringify(scale));
    await page.close();
  }
}

/* the-age-summary-says-one-days · every other age on this surface goes
   through plural(); this one line hard-coded the plural noun. Asserted as
   a concord rule over the whole spoken tree rather than over the one
   string, so the next hard-coded noun is caught where it is written. */
{
  for (const state of ["full", "partial", "quiet", "first-run"]) {
    const page = await open({ state, reducedMotion: true });
    const concord = await page.evaluate(() => {
      const bad = [];
      const nodes = Array.from(document.querySelectorAll("main .sr, main p, main span"));
      for (const el of nodes) {
        const t = el.textContent || "";
        const m = t.match(/\b1 (days|jobs|weeks|hours|marks)\b/);
        if (m) bad.push(`${m[0]} — ${t.slice(0, 50)}`);
      }
      const names = Array.from(document.querySelectorAll("[aria-label]"))
        .map((el) => el.getAttribute("aria-label"))
        .filter((n) => /\b1 (days|jobs|weeks|hours)\b/.test(n));
      return { bad, names };
    });
    ok(`a count of one never takes a plural noun · ${state}`,
      concord.bad.length === 0 && concord.names.length === 0,
      JSON.stringify(concord).slice(0, 160));
    await page.close();
  }
}

/* the-bound-stamp-wraps-and-strands-its-digit · 349px of tracked uppercase
   mono in a 342px content box at 390. Wrapped on a space it left the bare
   digit alone on line two — a number with nothing to say what it counts.
   Measured from a Range over the text, not from the element box: the span
   is a flex item and takes the full row whether its text wraps or not. */
{
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
    const page = await open({ state: "full", viewport: vp, touch: true, reducedMotion: true });
    const stamp = await page.evaluate(() => {
      const out = [];
      for (const s of document.querySelectorAll(".coverage span")) {
        const r = document.createRange();
        r.selectNodeContents(s);
        const rects = Array.from(r.getClientRects());
        if (rects.length < 2) continue;
        const last = rects[rects.length - 1];
        out.push({ w: Math.round(last.width * 10) / 10, text: s.textContent.trim().slice(0, 28) });
      }
      return out;
    });
    ok(`no wrapped stamp strands a lone digit · ${vp.width}`,
      stamp.every((s) => s.w > 40), JSON.stringify(stamp));
    await page.close();
  }
}

/* error-alert-loses-a-rung-the-other-terminal-states-keep · the r1 fix
   wrapped the heading and its sentence in role="alert", which made them
   children of an element with no gap of its own. The three terminal states
   are composed alike and must measure alike. */
{
  for (const variant of config.variants) {
    const gaps = {};
    for (const state of ["empty", "quiet", "error"]) {
      const page = await open({ state, variant, reducedMotion: true });
      gaps[state] = await page.evaluate(() => {
        const c = document.querySelector(".center");
        if (!c) return null;
        /* By role, not by tag. These three states are composed alike and
           marked up differently: empty and error head with an h2.t-sect,
           quiet with a p.t-head. A probe keyed on the tag saw two of the
           three and reported the third as absent. */
        const head = c.querySelector(".t-sect, .t-head, h1, h2, h3");
        if (!head) return null;
        const par = Array.from(head.parentElement.children)
          .find((el) => el !== head && el.matches("p.t-body"));
        if (!par) return null;
        return Math.round((par.getBoundingClientRect().top - head.getBoundingClientRect().bottom) * 10) / 10;
      });
      await page.close();
    }
    const measured = Object.values(gaps).filter((n) => n !== null);
    ok(`the terminal states set the same rung under their heading @ ${variant}`,
      measured.length === 3 && new Set(measured).size === 1 && measured[0] >= 15,
      JSON.stringify(gaps));
  }
}

/* loading-hands-over-the-reading-it-says-it-has-not-made · round 2
   neutralised every magnitude that carries geometry and left every fact in
   the DOM as live text, hidden by color: transparent. The existing skeleton
   block reads custom properties, class names and visibility, so it cannot
   fail on a text leak. This one reads what a real selection returns, and
   drives the magnitudes from the fixture rather than typing them. */
{
  const page = await open({ state: "loading", reducedMotion: true });
  const held = await page.evaluate(() => {
    const wrap = document.querySelector(".sk-wrap");
    return {
      userSelect: wrap ? getComputedStyle(wrap).userSelect : null,
      pointerEvents: wrap ? getComputedStyle(wrap).pointerEvents : null,
    };
  });
  ok("the loading frame hands over nothing it says it has not read",
    held.userSelect === "none" && held.pointerEvents === "none", JSON.stringify(held));

  await page.keyboard.press("ControlOrMeta+a");
  await page.waitForTimeout(120);
  /* Scoped to the skeleton. Select-all returns the header and the coverage
     footer as well, and the footer legitimately carries the bound nine —
     the claim that it should stop saying so was raised this round and
     refuted. What is asserted is the skeleton s own contract: a frame that
     says it has not read the numbers hands none of them over. */
  /* The selection TEXT, not containsNode(). containsNode is DOM-range
     geometry and blind to user-select — measured here, it reports all 41
     skeleton nodes inside the range while the text a person would actually
     copy contains none of their 18 strands. What is claimed is what the
     reader gets, so the text is the subject. The strand count is asserted
     too, so an empty list can never pass this by construction. */
  const selected = await page.evaluate(() => {
    const text = String(window.getSelection() ?? "");
    const strands = Array.from(document.querySelectorAll(".sk-wrap [data-type]"))
      .map((n) => (n.textContent || "").trim())
      .filter((s) => s.length > 6);
    const leaked = strands.filter((s) => text.includes(s));
    return { strands: strands.length, leaked: leaked.length, sample: leaked.slice(0, 2) };
  });
  ok("and a real selection returns nothing the skeleton is holding",
    selected.strands > 0 && selected.leaked === 0, JSON.stringify(selected));
  await page.close();
}

/* tapped-mark-keeps-the-hover-ink-forever · a coarse pointer latches
   :hover onto the last element touched and never releases it. The latch is
   the browser's and cannot be prevented; what can be prevented is a hover
   rule applying to a device that has no hover. One tap, read where it
   lands — a second tap elsewhere moves the latch and hides the defect. */
{
  const page = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true, reducedMotion: true });
  await page.locator(".dot").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const box = await page.locator(".dot").first().boundingBox();
  const rest = await page.evaluate(() => getComputedStyle(document.querySelector(".dot")).getPropertyValue("--disc").trim());
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => {
    const d = document.querySelector(".dot");
    const tabs = Array.from(document.querySelectorAll(".tab")).map((t) => getComputedStyle(t).color);
    return { latched: d.matches(":hover"), disc: getComputedStyle(d).getPropertyValue("--disc").trim(), tabs };
  });
  ok("a tapped mark keeps the ink it had at rest",
    after.disc === rest, `rest ${rest}, after a tap ${after.disc}, browser latch ${after.latched}`);
  await page.close();

  const strip = await open({ state: "full", viewport: { width: 390, height: 844 }, touch: true, reducedMotion: true });
  const tabBox = await strip.locator(".tab").first().boundingBox();
  const tabsRest = await strip.evaluate(() => Array.from(document.querySelectorAll(".tab")).map((t) => getComputedStyle(t).color));
  await strip.touchscreen.tap(tabBox.x + tabBox.width / 2, tabBox.y + tabBox.height / 2);
  await strip.waitForTimeout(200);
  const tabsAfter = await strip.evaluate(() => Array.from(document.querySelectorAll(".tab")).map((t) => getComputedStyle(t).color));
  ok("and a tapped tab does not join the current one at full ink",
    JSON.stringify(tabsRest) === JSON.stringify(tabsAfter),
    `${JSON.stringify(tabsRest)} then ${JSON.stringify(tabsAfter)}`);
  await strip.close();
}

/* refusal-copy-has-no-measure-ceiling · .limits collapses to one column at
   900 and the refusal bodies had no bound at all, so a paragraph that reads
   at 49-55 characters in three columns ran to 121 at 900px. Asserted at the
   widths where the grid has collapsed, which is where the defect lives. */
{
  for (const width of [900, 793, 768]) {
    const page = await open({ state: "full", viewport: { width, height: 1024 }, reducedMotion: true });
    const measure = await page.evaluate(() => {
      const bodies = Array.from(document.querySelectorAll(".limit .t-small"));
      const widths = bodies.map((b) => Math.round(b.getBoundingClientRect().width));
      const chars = bodies.map((b) => {
        const r = document.createRange();
        r.selectNodeContents(b);
        const lines = r.getClientRects().length;
        return lines ? Math.ceil((b.textContent || "").trim().length / lines) : 0;
      });
      return { widths, chars, cap: bodies.length ? getComputedStyle(bodies[0]).maxWidth : "n/a" };
    });
    ok(`the refusal bodies hold a measure · ${width}`,
      measure.cap !== "none" && measure.widths.every((w) => w <= 340) && measure.chars.every((c) => c <= 70),
      JSON.stringify(measure));
    await page.close();
  }
}

/* ══ round 3, batch 3 ═══════════════════════════════════════════════
   The last seven confirmed findings of the closing round. Every one of
   these was watched failing on the surface before its fix landed. */

/* denominator-plate-keeps-a-portrait-layout-in-a-banner-box · at 1440 the
   lead card is a portrait tile and exactly right. Below 900 the row goes
   two-up and the card spans both columns — a box more than twice as wide
   holding the identical stacked composition. Asserted as a relationship
   between the box and its contents, not as a typed breakpoint. */
{
  for (const width of [1440, 768, 390]) {
    const page = await open({
      state: "full",
      viewport: { width, height: width <= 480 ? 844 : 1024 },
      touch: width <= 480,
      reducedMotion: true,
    });
    const plate = await page.evaluate(() => {
      const lead = document.querySelector(".kpi.lead");
      if (!lead) return null;
      const cs = getComputedStyle(lead);
      const box = lead.getBoundingClientRect();
      const kids = Array.from(lead.children).map((k) => k.getBoundingClientRect());
      const inkRight = kids.length ? Math.max(...kids.map((k) => k.right)) : box.left;
      const inkLeft = kids.length ? Math.min(...kids.map((k) => k.left)) : box.right;
      return {
        direction: cs.flexDirection,
        ratio: Math.round((box.width / box.height) * 100) / 100,
        fill: Math.round(((inkRight - inkLeft) / box.width) * 100),
      };
    });
    /* A tile stacks; a banner lies down. The card must not be a banner in
       shape and a tile in composition — which is measured here as ink that
       fails to reach across a box wide enough to need it. */
    ok(`the denominator plate is composed like the box it is in · ${width}`,
      plate !== null && (plate.ratio < 1.8 ? plate.direction === "column" : plate.direction === "row"),
      JSON.stringify(plate));
    await page.close();
  }
}

/* nothing-balances-a-last-line · text-wrap computed to wrap on every
   element on the surface, and forty-two line boxes across the seven states
   ended on a single word — identical on both grounds, so not a ground
   artefact. Measured from Ranges over the text, because the element box
   says nothing about where the words landed. */
{
  const lastLine = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = Array.from(r.getClientRects());
    if (rects.length < 2) return { lines: rects.length, w: null };
    return { lines: rects.length, w: Math.round(rects[rects.length - 1].width) };
  };

  for (const width of [1440, 1280, 768]) {
    const page = await open({ state: "full", viewport: { width, height: 1024 }, reducedMotion: true });
    const caption = await page.evaluate(
      new Function(`return (${lastLine.toString()})(".ghost-say .t-head")`),
    );
    ok(`the refusal caption does not end on a lone word · ${width}`,
      caption !== null && (caption.lines === 1 || caption.w > 60), JSON.stringify(caption));
    await page.close();
  }

  /* The first-run note is the pair that must land together: `pretty` on its
     own moved the break INTO the date — "Yours arrive on 10 / August 2026." —
     which is worse than the widow it replaced. The date is bound, so the
     break can only fall between words that are allowed to part. */
  const page = await open({ state: "first-run", reducedMotion: true });
  const note = await page.evaluate(() => {
    /* The note that carries the date, not the first .hero-note: first-run
       has two and the other one is about the count. */
    const el = Array.from(document.querySelectorAll(".hero-note"))
      .find((n) => /arrive on/.test(n.textContent || ""));
    if (!el) return null;
    const text = el.textContent || "";
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = Array.from(r.getClientRects());
    return {
      lines: rects.length,
      last: rects.length ? Math.round(rects[rects.length - 1].width) : null,
      dateIsBound: / /.test(text),
      text: text.slice(-40),
    };
  });
  ok("the first-run comparison date cannot be broken across lines",
    note !== null && note.dateIsBound, JSON.stringify(note));
  await page.close();
}

/* the-lab-stamp-repeats-its-own-key · five of the six provenance stamps
   read as key plus value; this one repeated its key inside its value, and
   offered a garden path where the key could be read as the subject of the
   verb that followed. Asserted over every stamp, not the one that had it. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const stamps = await page.evaluate(() => {
    const out = [];
    for (const s of document.querySelectorAll(".coverage span")) {
      const key = s.querySelector("b")?.textContent?.trim() ?? "";
      const value = (s.textContent || "").replace(key, "").trim();
      const stem = key.toLowerCase().split("-")[0];
      out.push({ key, repeats: stem.length > 2 && value.toLowerCase().includes(stem) });
    }
    return out;
  });
  ok("no provenance stamp repeats its own key inside its value",
    stamps.length > 0 && stamps.every((s) => !s.repeats), JSON.stringify(stamps));
  await page.close();
}

/* one-of-four-labels-drops-the-verb-the-others-keep · the plural string was
   doing two jobs — the card's own sentence, which wants a finite verb, and
   the noun phrase inside "Jobs ___: not available", which cannot have one.
   One card carried the noun phrase in both places. Asserted as concord
   across the row, so the next card to lose its verb is caught too. */
{
  /* full and partial. The quiet state has no status row at all — it shows
     the all-clear instead — so a concord check keyed on four cards there
     was asserting the absence of a thing that is absent by design. */
  for (const state of ["full", "partial"]) {
    const page = await open({ state, reducedMotion: true });
    const row = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".kpi:not(.lead)"));
      return cards.map((c) => {
        const phrase = c.querySelector(".t-small")?.textContent?.trim() ?? "";
        return { phrase, finite: /^(are|is|have|has|haven|hasn|aren|isn)\b/i.test(phrase) };
      });
    });
    /* The unavailable card prints its noun phrase by design, so it is the
       one card excused — and the count is asserted separately, so excusing
       it cannot quietly excuse the row. */
    ok(`every status card leads with a finite verb · ${state}`,
      row.length === 4 && row.filter((c) => c.finite).length >= 3, JSON.stringify(row.map((c) => c.phrase)));
    await page.close();
  }

  /* And the unavailable card keeps the noun phrase its construction needs:
     "Jobs past the day they were due: not available" — never "Jobs are past
     the day they were due: not available". */
  const page = await open({ state: "partial", reducedMotion: true });
  const na = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll(".kpi")).find((c) => c.querySelector(".na"));
    return card ? card.getAttribute("aria-label") : null;
  });
  ok("the unavailable card names itself with a noun phrase, not a sentence",
    na !== null && /not available/i.test(na) && !/^Jobs (are|is|have|has)\b/i.test(na), String(na));
  await page.close();
}

/* tab-strip-activates-into-a-dead-history-entry · the current tab is an
   anchor to a bare #, so activating it pushed a history entry and snapped
   the document to the top while aria-current never moved. The two siblings
   are deliberately left alone — they carry real routes after the port. */
{
  const page = await open({ state: "full", reducedMotion: true });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(120);
  const before = await page.evaluate(() => ({ len: history.length, y: Math.round(window.scrollY), hash: location.hash }));
  /* Dispatched in the page. locator.click() scrolls its target into view
     first, so driving it from outside moves the document and then reads the
     movement back as the defect. */
  await page.evaluate(() => document.querySelector('.tab[aria-current="page"]').click());
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ len: history.length, y: Math.round(window.scrollY), hash: location.hash }));
  ok("the current tab does not re-navigate to itself",
    after.len === before.len && Math.abs(after.y - before.y) <= 2 && after.hash === before.hash,
    `${JSON.stringify(before)} then ${JSON.stringify(after)}`);
  await page.close();
}

/* tooltip-text-stays-in-the-accessibility-tree · the tip is hidden with
   opacity and never cleared, so after a blur the last mark's title and day
   count stayed in the tree — a second, stale copy of a name the mark
   already carries. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const tip = await page.evaluate(() => {
    const t = document.getElementById("tip");
    if (!t) return null;
    return {
      ariaHidden: t.getAttribute("aria-hidden"),
      described: document.querySelectorAll('[aria-describedby="tip"]').length,
      focusable: t.querySelectorAll("a, button, input, [tabindex]").length,
    };
  });
  ok("the tooltip is a visual echo and stays out of the tree",
    tip !== null && tip.ariaHidden === "true" && tip.described === 0 && tip.focusable === 0,
    JSON.stringify(tip));
  await page.close();
}

/* focused-mark-loses-its-name-to-a-pointer-leave · hide() guarded the touch
   pin and not focus, so a pointer crossing any mark and leaving took the tip
   away from a mark that was still focused and still ringed — and the mark's
   title lives nowhere else on the screen. */
{
  const page = await open({ state: "full", reducedMotion: true });
  const marks = page.locator(".dot");
  await marks.nth(2).scrollIntoViewIfNeeded();
  await marks.nth(2).focus();
  await page.waitForTimeout(150);
  const held = await page.evaluate(() => ({
    on: document.getElementById("tip").classList.contains("on"),
    text: document.getElementById("tip").textContent,
    ring: document.activeElement.matches(":focus-visible"),
  }));

  /* Cross a sibling and leave. This is the exact gesture that took the name
     away: the pointer never touched the focused mark. */
  const other = await marks.nth(5).boundingBox();
  await page.mouse.move(other.x + other.width / 2, other.y + other.height / 2);
  await page.waitForTimeout(120);
  await page.mouse.move(other.x + 500, other.y - 200);
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => ({
    on: document.getElementById("tip").classList.contains("on"),
    text: document.getElementById("tip").textContent,
    stillFocused: document.activeElement.classList.contains("dot"),
  }));
  ok("a focused mark keeps its name when a pointer crosses its neighbours",
    held.on && after.stillFocused && after.on && after.text === held.text,
    `${JSON.stringify(held)} then ${JSON.stringify(after)}`);
  await page.close();
}

ok("zero console errors across every state and both grounds", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
process.stdout.write(`\n${results.length} assertions, ${failures} failing\n`);
process.exit(failures ? 1 : 0);
