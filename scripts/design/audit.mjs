// Measured-evidence audit for the Tasks design master.
//
//   node scripts/design/audit.mjs                 # all states, default variant
//   node scripts/design/audit.mjs --v=a --json
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
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

const LAB = path.resolve("docs/design/labs/tasks-2026-08");
const VARIANT = args.get("v") ?? "locked";
const STATES = (args.get("states") ?? "board,cards,dense,empty,planning").split(",");
const VIEWPORT = args.get("viewport") ?? "1440x960";
const AS_JSON = args.get("json") === "true";

/* The only three colours allowed on screen, as RGB triples. */
const ALLOWED = [
  { name: "Ink", rgb: [17, 17, 17] },
  { name: "Indigo", rgb: [79, 70, 229] },
  { name: "White", rgb: [255, 255, 255] },
];
const ALLOWED_RADII = [0, 1.5, 4, 5, 6, 8, 12, 16, 24, 999];
const ALLOWED_WEIGHTS = [400, 600];
const ALLOWED_DURATIONS = [0, 0.05, 0.08, 0.14, 0.22, 0.4];

const AUDIT = `(() => {
  const out = { colors: [], weights: [], families: [], contrast: [], targets: [], radii: [], motion: [], counts: {} };

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
    const visible = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";

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
      let grow = 0;
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo);
        if (!ps || ps.content === "none" || ps.position !== "absolute") continue;
        if (ps.pointerEvents === "none") continue;
        const insets = [ps.top, ps.right, ps.bottom, ps.left].map(parseFloat);
        if (insets.some((v) => !Number.isFinite(v) || v > 0)) continue;
        grow = Math.max(grow, Math.min(...insets.map((v) => -v)));
      }
      rect.width += grow * 2;
      rect.height += grow * 2;
      const min = Math.min(rect.width, rect.height);
      if (min < 28) out.targets.push({ el: describe(el), w: Math.round(rect.width), h: Math.round(rect.height), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28) });
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
  out.contrast = dedupe(out.contrast, (i) => i.el + i.ratio);
  return out;
})()`;

async function run() {
  const [w, h] = VIEWPORT.split("x").map(Number);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const report = { variant: VARIANT, viewport: VIEWPORT, states: {} };

  for (const state of STATES) {
    const url = `${pathToFileURL(path.join(LAB, "floor.html")).href}?v=${VARIANT}&state=${state}`;
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(400);
    report.states[state] = await page.evaluate(AUDIT);
  }

  await browser.close();

  const totals = { colors: 0, weights: 0, families: 0, contrast: 0, targets: 0, radii: 0, motion: 0 };
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
    }
    process.stdout.write(`\nTOTALS  ${JSON.stringify(totals)}\n`);
  }

  const hard = totals.colors + totals.weights + totals.families + totals.contrast + totals.radii + totals.motion;
  process.exit(hard > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(2);
});
