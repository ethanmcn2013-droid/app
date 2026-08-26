// Measured-evidence audit for the Notes design master.
//
//   node scripts/design/notes-audit.mjs                 # all states, locked room
//   node scripts/design/notes-audit.mjs --v=press --json
//
// A sibling of scripts/design/audit.mjs, which belongs to the Tasks
// exploration and is not edited by this programme. Same seven checks, same
// idiom, pointed at docs/design/labs/notes-2026-08/notebook.html and its ten
// states.
//
// This exists BEFORE the first panel round, not after it. The Tasks
// programme learned at round 5 that grading frames instead of driving the
// file costs three seats; the seats here are told what this already proves so
// no finding is spent restating one.
//
// This is the measured seat of the panel. It reads computed styles out of a
// real browser and checks the things opinion is bad at:
//
//   1. Palette lock  every colour that reaches the screen must be Ink,
//                    Indigo or White at some alpha. Any other hue fails.
//   2. Weights       Geist at 400 and 600 only.
//   3. Families      Geist and Geist Mono only.
//   4. Contrast      every text node against its real composited backdrop,
//                    at the WCAG AA threshold for its size and weight.
//   5. Targets       interactive hit areas.
//   6. Radii         the declared ladder, no seventh step.
//   7. Motion        one duration, one curve.
//
// Exit code is 1 when any hard check fails, so this can gate.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const LAB = path.resolve("docs/design/labs/notes-2026-08");
const VARIANT = args.get("v") ?? "locked";
const STATES = (args.get("states") ??
  "notebook,capture,voice,readback,review,seam,search,pressure,nothing,not-yet").split(",");
const VIEWPORT = args.get("viewport") ?? "1440x960";
const AS_JSON = args.get("json") === "true";

/* The only three colours allowed on screen, as RGB triples. */
const ALLOWED = [
  { name: "Ink", rgb: [17, 17, 17] },
  { name: "Indigo", rgb: [79, 70, 229] },
  { name: "White", rgb: [255, 255, 255] },
];
/* The Notes ladder. Ten steps and no eleventh: two decorative, six for
   controls and paper, two for the sheet-scale rooms, and the pill. Every
   radius in master.css is one of these, including the ones the room
   presets redefine. */
const ALLOWED_RADII = [0, 2, 4, 6, 8, 12, 14, 16, 20, 24, 999];
const ALLOWED_WEIGHTS = [400, 600];
/* The type ramp. Eight steps and no ninth. Declared here as well as in
   master.css so the gate fails when a size drifts off it rather than when
   somebody notices. Before this the file ran eighteen ad-hoc sizes, eleven
   of them inside the 10 to 15 band on half-pixel increments. */
const ALLOWED_SIZES = [11, 12, 13, 15, 17, 20, 27, 34];
/* One duration, one exit, one settle. The settle is the direction's own
   signature — paper coming to rest — and it is declared in master.css
   rather than being an accident. */
const ALLOWED_DURATIONS = [0, 0.05, 0.14, 0.22];

/* The leading and tracking ladders are not written down here. They are
   read out of the master's own :root, so this gate grades the file
   against what the file declares and cannot drift from it — the exact
   failure it exists to catch, which is a comment claiming three declared
   leadings over eleven ratios written by hand. A stylesheet loaded over
   file:// is opaque to the page's own CSSOM, so the read happens here. */
const MASTER_CSS = readFileSync(path.join(LAB, "master.css"), "utf8");
const declaredSteps = (prefix) => {
  const found = [...MASTER_CSS.matchAll(new RegExp("--" + prefix + "[a-z0-9-]+:\\s*(-?[0-9.]+)e?m?;", "g"))]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
  const uniq = [...new Set(found)];
  if (!uniq.length) throw new Error(`no --${prefix}* steps declared in master.css`);
  return uniq;
};
const ALLOWED_LEADING = declaredSteps("lh-");
const ALLOWED_TRACKING = declaredSteps("tr-");

const AUDIT = `(() => {
  const out = { colors: [], weights: [], families: [], contrast: [], targets: [], radii: [], motion: [], sizes: [], leading: [], measure: [], counts: {} };
  const LADDER = ${JSON.stringify(ALLOWED_LEADING)};
  const CURVE = ${JSON.stringify(ALLOWED_TRACKING)};

  const parse = (value) => {
    const m = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((n) => parseFloat(n.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const ALLOWED = ${JSON.stringify(ALLOWED)};
  const near = (c) => ALLOWED.some((allowed) =>
    Math.abs(c.r - allowed.rgb[0]) <= 1 && Math.abs(c.g - allowed.rgb[1]) <= 1 && Math.abs(c.b - allowed.rgb[2]) <= 1);

  /* An alpha colour composited over its ancestors. Colour-lock is judged on
     the DECLARED value; contrast is judged on the composited one. */
  const over = (fg, bg) => ({
    r: fg.a * fg.r + (1 - fg.a) * bg.r,
    g: fg.a * fg.g + (1 - fg.a) * bg.g,
    b: fg.a * fg.b + (1 - fg.a) * bg.b,
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const backdropOf = (el) => {
    let node = el, stack = [];
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) { stack.push(bg); if (bg.a === 1) break; }
      node = node.parentElement;
    }
    if (!stack.length) return { r: 255, g: 255, b: 255, a: 1 };
    let base = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i--) base = over(stack[i], base);
    return base;
  };

  const describe = (el) => {
    const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + cls;
  };

  const all = Array.from(document.querySelectorAll("*"));
  out.counts.elements = all.length;

  /* Only colours that actually paint. An inherited black on a border with
     zero width has never been on screen, and reporting it buries the real
     findings under noise. */
  const SHAPES = "path, circle, rect, line, polygon, polyline, ellipse";
  const paints = (el, cs, prop) => {
    if (prop === "color" || prop === "backgroundColor") return true;
    if (prop.startsWith("border")) {
      const side = prop.replace("border", "").replace("Color", "");
      return parseFloat(cs["border" + side + "Width"]) > 0 && cs["border" + side + "Style"] !== "none";
    }
    if (prop === "outlineColor") return parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== "none";
    if (prop === "textDecorationColor") return cs.textDecorationLine !== "none";
    if (prop === "fill" || prop === "stroke") return el.matches(SHAPES) && cs[prop] !== "none";
    return true;
  };
  const colorProps = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "fill", "stroke", "textDecorationColor"];

  for (const el of all) {
    const cs = getComputedStyle(el);
    const r0 = el.getBoundingClientRect();
    const rect = { x: r0.x, y: r0.y, width: r0.width, height: r0.height, right: r0.right, bottom: r0.bottom };
    /* A screen-reader live region is 1px, clipped to nothing and never
       painted, so grading its contrast, its type size or its leading
       measures something that does not exist. It became reachable in
       round 8 only because the dictation floor now announces itself on
       a direct load, which is the fix, not a violation. */
    const announced = el.closest(".sr") !== null || el.classList.contains("sr");
    const visible =
      !announced && rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";

    /* 1. palette lock */
    for (const prop of colorProps) {
      if (!paints(el, cs, prop)) continue;
      const c = parse(cs[prop]);
      if (!c || c.a === 0) continue;
      if (!near(c)) out.colors.push({ el: describe(el), prop, value: cs[prop] });
    }
    const shadow = cs.boxShadow;
    if (shadow && shadow !== "none") {
      const found = shadow.match(/rgba?\\([^)]+\\)/g) || [];
      for (const raw of found) {
        const c = parse(raw);
        if (c && c.a > 0 && !near(c)) out.colors.push({ el: describe(el), prop: "boxShadow", value: raw });
      }
    }
    const bgImage = cs.backgroundImage;
    if (bgImage && bgImage !== "none") {
      const found = bgImage.match(/rgba?\\([^)]+\\)/g) || [];
      for (const raw of found) {
        const c = parse(raw);
        if (c && c.a > 0 && !near(c)) out.colors.push({ el: describe(el), prop: "backgroundImage", value: raw });
      }
    }

    /* 2 + 3. weights and families */
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length);
    if (hasText && visible) {
      const weight = parseInt(cs.fontWeight, 10);
      if (!${JSON.stringify(ALLOWED_WEIGHTS)}.includes(weight)) out.weights.push({ el: describe(el), weight, text: el.textContent.trim().slice(0, 32) });
      const family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      if (!/^Geist( Mono)?$/.test(family)) out.families.push({ el: describe(el), family });

      /* 8. the type ramp */
      const size = Math.round(parseFloat(cs.fontSize) * 10) / 10;
      if (!${JSON.stringify(ALLOWED_SIZES)}.some((step) => Math.abs(size - step) < 0.6)) {
        out.sizes.push({ el: describe(el), size, text: el.textContent.trim().slice(0, 28) });
      }

      /* 9. leading. A text-bearing element computing line-height: normal
         is an element whose leading the browser chose, which is how a
         baseline drifts by a pixel between a note's words and the facts
         beside them on every row of a list.

         And a ratio that is declared nowhere is the same defect written
         by hand: the file carried a comment saying "three leadings,
         declared" over eleven raw ratios. The ladder is read off :root at
         run time, so the check cannot fall out of step with the tokens
         it governs. Tracking is held to its own declared curve for the
         same reason — a var() with a fallback is a token that does not
         exist. */
      if (cs.lineHeight === "normal") {
        out.leading.push({ el: describe(el), text: el.textContent.trim().slice(0, 28), why: "line-height: normal" });
      } else {
        const ratio = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
        if (Number.isFinite(ratio) && !LADDER.some((step) => Math.abs(ratio - step) < 0.012)) {
          out.leading.push({
            el: describe(el),
            text: el.textContent.trim().slice(0, 28),
            why: "line-height ratio " + ratio.toFixed(3) + " is on no declared --lh-* step",
          });
        }
      }
      /* 10. the measure.
         The file had a leading rule and no measure rule at all, so the
         one measure declared in ch — 62ch on the legally required voice
         disclosure — sailed through at about ninety characters a line,
         the smallest type in the room set as the longest line in it.
         32em is the ceiling the file's own comment argues for (Geist's
         average glyph is about 0.45em, so 31em lands near 68
         characters). Prose only: an element with a real sentence in it
         and no element child carrying that sentence instead. */
      const words = (el.textContent || "").trim();
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 40);
      if (visible && ownText && words.length > 40 && /s/.test(words)) {
        const emSize = parseFloat(cs.fontSize);
        const ems = emSize > 0 ? rect.width / emSize : 0;
        /* A measure governs how far the eye travels before it has to
           find the next line. An index row is one clamped line with no
           next line to find, so its width is a column width, not a
           measure, and holding it to 32em would be holding a list to a
           rule written for paragraphs. Only prose that actually wraps
           is judged. */
        const lh = parseFloat(cs.lineHeight) || emSize * 1.4;
        const wraps = lh > 0 && rect.height > lh * 1.5;
        if (wraps && ems > 32.5) {
          out.measure.push({
            el: describe(el),
            ems: Math.round(ems * 10) / 10,
            px: Math.round(rect.width),
            size: Math.round(emSize * 10) / 10,
            text: words.slice(0, 28),
          });
        }
      }

      const track = parseFloat(cs.letterSpacing);
      const em = parseFloat(cs.fontSize);
      if (Number.isFinite(track) && em > 0 && !CURVE.some((step) => Math.abs(track - step * em) < 0.08)) {
        out.leading.push({
          el: describe(el),
          text: el.textContent.trim().slice(0, 28),
          why: "letter-spacing " + (track / em).toFixed(4) + "em is on no declared --tr-* step",
        });
      }

      /* 4. contrast, against the real composited backdrop */
      const fg = parse(cs.color);
      if (fg && fg.a > 0) {
        const bg = backdropOf(el);
        const composited = over(fg, bg);
        const size = parseFloat(cs.fontSize);
        const large = size >= 24 || (size >= 18.66 && weight >= 600);
        const need = large ? 3 : 4.5;
        const got = ratio(composited, bg);
        if (got < need) {
          out.contrast.push({
            el: describe(el), text: el.textContent.trim().slice(0, 36),
            size, weight, ratio: Math.round(got * 100) / 100, need,
          });
        }
      }
    }

    /* 5. hit targets.
       A control may legitimately carry a larger hit area than its drawn box
       via an absolutely positioned pseudo-element with negative insets. That
       is the correct technique for a small circular control, so the audit
       measures the union rather than punishing it. */
    const interactive = el.matches("button, a, [tabindex], input, textarea, select");
    if (interactive && visible && rect.width >= 1) {
      /* PER AXIS, not one symmetric number. This took the MINIMUM of the
         four negative insets, so an expander that grows only vertically
         -- inset: -4px 0, the correct shape for a round control in a row
         of butted siblings, where growing sideways would put a tap meant
         for Notes on Tasks -- computed a growth of zero and the control
         was reported at its drawn size. The rule could not express the
         technique the file is required to use. */
      let growX = 0;
      let growY = 0;
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo);
        if (!ps || ps.content === "none" || ps.position !== "absolute") continue;
        if (ps.pointerEvents === "none") continue;
        const [top, right, bottom, left] = [ps.top, ps.right, ps.bottom, ps.left].map(parseFloat);
        if ([top, right, bottom, left].some((v) => !Number.isFinite(v) || v > 0)) continue;
        growY = Math.max(growY, Math.min(-top, -bottom));
        growX = Math.max(growX, Math.min(-left, -right));
      }
      rect.width += growX * 2;
      rect.height += growY * 2;
      /* The coarse pass gates HEIGHT, which is what the coarse block
         actually guarantees. Width on the merged dock is a stated
         trade, not an oversight: the rail tiles sit at a 0px gap, so a
         symmetric 44-wide union on butted siblings would overlap and a
         tap on the edge of Notes would land on Tasks. Capture is the
         three-second promise and outranks a navigation tile, so the
         field is never squeezed to buy the width either. Widths are
         printed for the record; heights are the gate. */
      const min = window.__TARGET_AXIS === "height" ? rect.height : Math.min(rect.width, rect.height);
      if (min < (window.__TARGET_FLOOR || 28)) out.targets.push({ el: describe(el), w: Math.round(rect.width), h: Math.round(rect.height), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28) });
    }

    /* 6. radii */
    if (visible) {
      for (const corner of ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"]) {
        const raw = cs[corner];
        if (!raw || raw.includes("%")) continue;
        const px = Math.round(parseFloat(raw) * 10) / 10;
        if (!Number.isFinite(px)) continue;
        const ok = ${JSON.stringify(ALLOWED_RADII)}.some((step) => Math.abs(px - step) < 0.6) || px >= 100;
        if (!ok) out.radii.push({ el: describe(el), corner, px });
      }

      /* 7. motion */
      const durations = cs.transitionDuration.split(",").map((d) => parseFloat(d));
      for (const d of durations) {
        if (!Number.isFinite(d) || d === 0) continue;
        if (!${JSON.stringify(ALLOWED_DURATIONS)}.some((step) => Math.abs(d - step) < 0.005)) {
          out.motion.push({ el: describe(el), duration: d, kind: "duration" });
        }
      }
      const easings = cs.transitionTimingFunction.split(/,(?![^(]*\\))/).map((e) => e.trim());
      for (const e of easings) {
        if (e === "ease" || e === "linear" || e === "ease-in-out" || e === "ease-out") continue;
        if (!/cubic-bezier\\(0\\.23, 1, 0\\.32, 1\\)|cubic-bezier\\(0\\.77, 0, 0\\.175, 1\\)/.test(e)) {
          out.motion.push({ el: describe(el), easing: e, kind: "easing" });
        }
      }
    }
  }

  const dedupe = (list, keyOf) => {
    const seen = new Map();
    for (const item of list) {
      const k = keyOf(item);
      if (!seen.has(k)) seen.set(k, { ...item, n: 0 });
      seen.get(k).n += 1;
    }
    return Array.from(seen.values());
  };
  out.colors = dedupe(out.colors, (i) => i.el + i.prop + i.value);
  out.weights = dedupe(out.weights, (i) => i.el + i.weight);
  out.families = dedupe(out.families, (i) => i.family);
  out.radii = dedupe(out.radii, (i) => i.el + i.px);
  out.motion = dedupe(out.motion, (i) => i.kind + (i.duration ?? i.easing));
  out.targets = dedupe(out.targets, (i) => i.el + i.w + "x" + i.h);
  out.measure = dedupe(out.measure, (i) => i.el + i.ems);
  out.contrast = dedupe(out.contrast, (i) => i.el + i.ratio);
  out.sizes = dedupe(out.sizes, (i) => i.el + i.size);
  out.leading = dedupe(out.leading, (i) => i.el);
  return out;
})()`;

async function run() {
  const [w, h] = VIEWPORT.split("x").map(Number);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const report = { variant: VARIANT, viewport: VIEWPORT, states: {} };

  for (const state of STATES) {
    const url = `${pathToFileURL(path.join(LAB, "notebook.html")).href}?v=${VARIANT}&state=${state}`;
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(400);
    report.states[state] = await page.evaluate(AUDIT);
  }

  /* THE COARSE PASS.
     The @media (pointer: coarse) block was dead code in both gates: this
     audit measured at 1440 with a mouse, and the behaviour check opened
     390 without hasTouch, so nothing ever evaluated the branch that
     governs the one surface the locked architecture singles out — the
     phone, where the capsule and the dock merge. A finger needs 44px,
     so the coarse pass asserts against 44 rather than 28, on the union
     including pseudo-element expanders, at the three phone widths. */
  const coarse = { floor: 44, widths: [360, 390, 430], states: {} };
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const tp = await touch.newPage();
  for (const cw of coarse.widths) {
    await tp.setViewportSize({ width: cw, height: 844 });
    for (const state of STATES) {
      const url = `${pathToFileURL(path.join(LAB, "notebook.html")).href}?v=${VARIANT}&state=${state}`;
      await tp.goto(url, { waitUntil: "load" });
      await tp.waitForTimeout(360);
      await tp.evaluate(() => {
        window.__TARGET_FLOOR = 44;
        window.__TARGET_AXIS = "height";
      });
      const r = await tp.evaluate(AUDIT);
      /* Contrast at phone widths too, not just targets. Round 11 moved
         the readback into the ink overlay and left every line wearing
         its light-room tint: .saidHead, .saidHint and .pieceField all at
         contrast 1.00 against rgb(17,17,17) — the person's own dictated
         words, invisible — and this file could not see it, because the
         contrast pass only ever ran at 1440 where that room is a white
         sheet. Whole rooms only exist below 720px; they have to be
         measured there. */
      const bad = [...r.targets, ...r.contrast];
      if (bad.length) coarse.states[`${cw}/${state}`] = bad;
    }
  }
  await touch.close();
  report.coarse = coarse;

  await browser.close();

  const totals = { colors: 0, weights: 0, families: 0, contrast: 0, targets: 0, radii: 0, motion: 0, sizes: 0, leading: 0, measure: 0 };
  for (const state of Object.keys(report.states)) {
    for (const key of Object.keys(totals)) totals[key] += report.states[state][key].length;
  }
  report.totals = totals;

  if (AS_JSON) {
    process.stdout.write(JSON.stringify(report, null, 2));
  } else {
    const line = (label, list, format) => {
      process.stdout.write(`  ${label.padEnd(14)}${list.length === 0 ? "pass" : list.length + " to fix"}\n`);
      for (const item of list.slice(0, 8)) process.stdout.write(`      ${format(item)}\n`);
    };
    for (const state of Object.keys(report.states)) {
      const r = report.states[state];
      process.stdout.write(`\n${state}  (${r.counts.elements} elements)\n`);
      line("palette", r.colors, (i) => `${i.el} ${i.prop}: ${i.value}  ×${i.n}`);
      line("weights", r.weights, (i) => `${i.el} weight ${i.weight}  "${i.text}"`);
      line("families", r.families, (i) => `${i.el} ${i.family}`);
      line("contrast", r.contrast, (i) => `${i.el} ${i.ratio}:1 (needs ${i.need}) ${i.size}px/${i.weight}  "${i.text}"`);
      line("targets", r.targets, (i) => `${i.el} ${i.w}×${i.h}  "${i.label}"`);
      line("radii", r.radii, (i) => `${i.el} ${i.px}px`);
      line("motion", r.motion, (i) => (i.kind === "duration" ? `${i.el} ${i.duration}s` : `${i.el} ${i.easing}`));
      line("type ramp", r.sizes, (i) => `${i.el} ${i.size}px  "${i.text}"`);
      line("leading", r.leading, (i) => `${i.el} ${i.why}  "${i.text}"`);
      line("measure", r.measure, (i) => `${i.el} ${i.ems}em at ${i.size}px (${i.px}px)  "${i.text}"`);
    }
    process.stdout.write(`\nTOTALS  ${JSON.stringify(totals)}\n`);
    const misses = Object.entries(report.coarse.states);
    const under = misses.reduce((n, [, v]) => n + v.length, 0);
    process.stdout.write(
      `COARSE  44px height floor + AA contrast, real touch pointer, ${report.coarse.widths.join("/")}px × ${STATES.length} states · ${under} failing
`,
    );
    for (const [where, items] of misses) {
      /* Targets and contrast are different shapes; print each as what it
         is rather than as undefined×undefined. */
      for (const i of items) {
        const what = i.ratio !== undefined ? `${i.ratio}:1 (needs ${i.needs})` : `${i.w}×${i.h}`;
        process.stdout.write(`  ${where}  ${i.el} ${what}  "${i.label ?? i.text ?? ""}"
`);
      }
    }
  }

  const coarseMisses = Object.values(report.coarse.states).reduce((n, v) => n + v.length, 0);
  const hard =
    totals.colors + totals.weights + totals.families + totals.contrast + totals.radii + totals.motion +
    totals.sizes + totals.leading + totals.measure + coarseMisses;
  process.exit(hard > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
