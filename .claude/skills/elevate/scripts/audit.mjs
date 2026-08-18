// The measured gate — the panel's automated seat.
//
//   node audit.mjs --lab=<dir>            # all config states, default variant
//   node audit.mjs --lab=<dir> --json --states=a,b --v=x --viewport=1280x900
//
// Reads computed styles out of a real browser and checks the things opinion
// is bad at. Everything it enforces comes from the lab's elevate.config.json:
//
//   1. Palette lock  every colour that actually paints must be one of the
//                    config colours at some alpha. Judged on the DECLARED
//                    value; contrast is judged on the composited one.
//   2. Weights       only the config's weights.
//   3. Families      only the config's families.
//   4. Contrast      every text node against its real composited backdrop,
//                    at the WCAG AA threshold for its size and weight.
//   5. Targets       interactive hit areas, measured as the union of the
//                    box and any absolutely-positioned pseudo expander.
//   6. Radii         the declared ladder, nothing off it.
//   7. Motion        the declared duration and easing ladders.
//   8. Type ramp     every font size on the declared ramp (skipped while
//                    ladders.typeRamp is empty — fill it at the lock).
//   9. Leading       no text element whose computed line-height is
//                    'normal'. Leading is a decision; the browser choosing
//                    it means nobody did.
//
// Exit code 1 on any hard failure, so this can gate.
import { chromium } from "@playwright/test";
import { parseArgs, loadLab, masterUrl, hexToRgb, launch } from "./lib.mjs";

const args = parseArgs();
const { lab, config } = await loadLab(args);

const VARIANT = args.get("v") ?? config.defaultVariant;
const STATES = (args.get("states") ?? config.states.join(",")).split(",");
const VIEWPORT = args.get("viewport") ?? "1440x960";
const AS_JSON = args.get("json") === "true";

const ALLOWED = config.palette.map((p) => ({ name: p.name, rgb: hexToRgb(p.hex) }));
const ALLOWED_RADII = config.ladders?.radii ?? [];
const ALLOWED_WEIGHTS = config.weights ?? [400, 600];
const ALLOWED_DURATIONS = config.ladders?.durations ?? [];
const ALLOWED_EASINGS = config.ladders?.easings ?? [];
const FAMILY_PATTERN = (config.families ?? ["Geist", "Geist Mono"])
  .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const TYPE_RAMP = config.ladders?.typeRamp ?? [];

const AUDIT = `(() => {
  const out = { colors: [], weights: [], families: [], contrast: [], targets: [], radii: [], motion: [], ramp: [], leading: [], leadingLadder: [], tracking: [], trackingLadder: [], counts: {} };
  const tracks = new Map();

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

  /* A ground painted as a single-colour gradient IS a ground. Only
     one-colour gradients are composited: a real multi-stop gradient has
     no single backdrop, and guessing one would be worse than saying so,
     so those are reported as unmeasured rather than scored. */
  const groundOf = (cs) => {
    const flat = parse(cs.backgroundColor);
    const stops = cs.backgroundImage.match(/rgba?\\([^)]+\\)/g) || [];
    if (!stops.length) return flat;
    const first = stops[0];
    if (!stops.every((c) => c === first)) return flat;
    const wash = parse(first);
    if (!wash) return flat;
    return flat && flat.a > 0 ? over(wash, flat) : wash;
  };

  const backdropOf = (el) => {
    let node = el, stack = [];
    while (node && node !== document.documentElement) {
      const bg = groundOf(getComputedStyle(node));
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

  /* Read off the page, so the gate grades what the file declares rather
     than a list copied into the script. A lab with no ladder declared
     simply skips both checks. */
  const rootCs = getComputedStyle(document.documentElement);
  const ladder = (prefix) => {
    const found = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of Array.from(rules || [])) {
        if (!rule.style) continue;
        for (const name of Array.from(rule.style)) {
          if (name.indexOf(prefix) === 0) found.push(name);
        }
      }
    }
    return Array.from(new Set(found))
      .map((name) => parseFloat(rootCs.getPropertyValue(name)))
      .filter((v) => Number.isFinite(v));
  };
  const LEAD = ladder("--lead-");
  const TRACK = ladder("--track-");
  out.counts.ladders = { leading: LEAD.length, tracking: TRACK.length };

  const all = Array.from(document.querySelectorAll("*"));
  out.counts.elements = all.length;

  /* Only colours that actually paint. An inherited black on a zero-width
     border has never been on screen, and reporting it buries the real
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
    const rect = { width: r0.width, height: r0.height };
    const visible = rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length);

    /* 1. palette lock */
    for (const prop of colorProps) {
      /* text colour only paints where text paints; an inherited default on
         html/head/meta has never been on screen. */
      if (prop === "color" && !(hasText && visible)) continue;
      if (!paints(el, cs, prop)) continue;
      const c = parse(cs[prop]);
      if (!c || c.a === 0) continue;
      if (!near(c)) out.colors.push({ el: describe(el), prop, value: cs[prop] });
    }
    for (const prop of ["boxShadow", "backgroundImage"]) {
      const raw = cs[prop];
      if (!raw || raw === "none") continue;
      for (const found of raw.match(/rgba?\\([^)]+\\)/g) || []) {
        const c = parse(found);
        if (c && c.a > 0 && !near(c)) out.colors.push({ el: describe(el), prop, value: found });
      }
    }

    /* 2 + 3 + 4 + 8 + 9: text checks */
    /* A placeholder is text a person reads, and it was invisible to
       this gate: the pseudo scan below is for hit-target expanders, and
       nothing else looked at ::placeholder. It failed AA on a shipped
       room for a whole round because of it. */
    if (el.matches("input, textarea")) {
      const ps = getComputedStyle(el, "::placeholder");
      const pc = parse(ps.color);
      if (pc && pc.a > 0 && el.getAttribute("placeholder")) {
        if (!near(pc)) out.colors.push({ el: describe(el) + "::placeholder", prop: "color", value: ps.color });
        const pbg = backdropOf(el);
        const pcomp = over(pc, pbg);
        const psize = parseFloat(ps.fontSize) || parseFloat(cs.fontSize);
        const pweight = parseInt(ps.fontWeight, 10) || parseInt(cs.fontWeight, 10);
        const plarge = psize >= 24 || (psize >= 18.66 && pweight >= 600);
        const pgot = ratio(pcomp, pbg);
        if (pgot < (plarge ? 3 : 4.5)) {
          out.contrast.push({
            el: describe(el) + "::placeholder", text: el.getAttribute("placeholder").slice(0, 36),
            size: psize, weight: pweight, ratio: Math.round(pgot * 100) / 100, need: plarge ? 3 : 4.5,
          });
        }
      }
    }

    if (hasText && visible) {
      const weight = parseInt(cs.fontWeight, 10);
      if (!${JSON.stringify(ALLOWED_WEIGHTS)}.includes(weight)) out.weights.push({ el: describe(el), weight, text: el.textContent.trim().slice(0, 32) });
      const family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      if (!/^(${FAMILY_PATTERN})$/.test(family)) out.families.push({ el: describe(el), family });

      const size = parseFloat(cs.fontSize);
      const RAMP = ${JSON.stringify(TYPE_RAMP)};
      if (RAMP.length && !RAMP.some((step) => Math.abs(size - step) < 0.35)) {
        out.ramp.push({ el: describe(el), size, text: el.textContent.trim().slice(0, 32) });
      }
      if (cs.lineHeight === "normal") {
        out.leading.push({ el: describe(el), text: el.textContent.trim().slice(0, 32) });
      }
      /* And a declared leading still has to be ON the declared ladder.
         Comparing each family and size only with itself let a seventh
         undeclared value ship clean, and it could never see the same
         object carrying two baselines on two different states. */
      else if (LEAD.length && size > 0) {
        const furniture0 = el.closest(".tl-caption") || cs.clipPath !== "none";
        const ratioNow = parseFloat(cs.lineHeight) / size;
        if (!furniture0 && Number.isFinite(ratioNow)
          && !LEAD.some((v) => Math.abs(v - ratioNow) < 0.015)) {
          out.leadingLadder.push({
            el: describe(el),
            size: Math.round(size * 10) / 10,
            lead: Math.round(ratioNow * 1000) / 1000,
            text: el.textContent.trim().slice(0, 24),
          });
        }
      }

      /* One size, one letterfit. A tracking ladder that is declared and
         then applied by hand drifts: the same face at the same size ends
         up rendering at two different values on two surfaces, and no
         reader can name why one of them feels wrong. */
      /* Lab furniture and screen-reader-only text are not the artifact:
         a caption naming the frame, and a span that exists to speak a
         unit, must not decide the system's letterfit. */
      const furniture = el.closest(".tl-caption") || cs.clipPath !== "none";
      /* The same for tracking: on the ladder, not merely self-consistent
         within one state. */
      if (!furniture && TRACK.length && size > 0) {
        const spaceNow = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing);
        if (Number.isFinite(spaceNow)
          && !TRACK.some((em) => Math.abs(em * size - spaceNow) < 0.02)) {
          out.trackingLadder.push({
            el: describe(el),
            size: Math.round(size * 10) / 10,
            track: Math.round((spaceNow / size) * 10000) / 10000 + "em",
            text: el.textContent.trim().slice(0, 24),
          });
        }
      }
      const trackKey = furniture ? null : family + "|" + Math.round(size * 10) / 10;
      if (trackKey !== null) {
      const space = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      if (!tracks.has(trackKey)) tracks.set(trackKey, new Map());
      if (!tracks.get(trackKey).has(space)) {
        tracks.get(trackKey).set(space, describe(el) + ' "' + el.textContent.trim().slice(0, 20) + '"');
      }
      }

      const fg = parse(cs.color);
      if (fg && fg.a > 0) {
        const bg = backdropOf(el);
        const composited = over(fg, bg);
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

    /* 5. hit targets — a control may carry a larger hit area than its
       drawn box via an absolutely positioned pseudo-element with negative
       insets; that is the correct technique, so measure the union. */
    const interactive = el.matches("button, a, summary, [tabindex], input, textarea, select");
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
      const w = rect.width + grow * 2, h = rect.height + grow * 2;
      if (Math.min(w, h) < 28) out.targets.push({ el: describe(el), w: Math.round(w), h: Math.round(h), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28) });
    }

    if (visible) {
      /* 6. radii */
      const LADDER = ${JSON.stringify(ALLOWED_RADII)};
      if (LADDER.length) {
        for (const corner of ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"]) {
          const raw = cs[corner];
          if (!raw || raw.includes("%")) continue;
          const px = Math.round(parseFloat(raw) * 10) / 10;
          if (!Number.isFinite(px)) continue;
          const okStep = LADDER.some((step) => Math.abs(px - step) < 0.6) || px >= 100;
          if (!okStep) out.radii.push({ el: describe(el), corner, px });
        }
      }

      /* 7. motion */
      const DUR = ${JSON.stringify(ALLOWED_DURATIONS)};
      if (DUR.length) {
        for (const d of cs.transitionDuration.split(",").map((x) => parseFloat(x))) {
          if (!Number.isFinite(d) || d === 0) continue;
          if (!DUR.some((step) => Math.abs(d - step) < 0.005)) out.motion.push({ el: describe(el), duration: d, kind: "duration" });
        }
      }
      const EASE = ${JSON.stringify(ALLOWED_EASINGS)};
      if (EASE.length) {
        for (const e of cs.transitionTimingFunction.split(/,(?![^(]*\\))/).map((x) => x.trim())) {
          if (e === "ease" || e === "linear" || e === "ease-in-out" || e === "ease-out") continue;
          if (!EASE.some((allowed) => e.replace(/\\s+/g, "") === allowed.replace(/\\s+/g, ""))) {
            out.motion.push({ el: describe(el), easing: e, kind: "easing" });
          }
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
  out.ramp = dedupe(out.ramp, (i) => i.el + i.size);
  out.leading = dedupe(out.leading, (i) => i.el);
  out.leadingLadder = dedupe(out.leadingLadder, (i) => i.el + i.lead);
  out.trackingLadder = dedupe(out.trackingLadder, (i) => i.el + i.track);
  for (const [key, seen] of tracks) {
    if (seen.size < 2) continue;
    out.tracking.push({
      key,
      values: Array.from(seen.keys()).join(" vs "),
      where: Array.from(seen.values()).join(" | ").slice(0, 120),
    });
  }
  return out;
})()`;

const [w, h] = VIEWPORT.split("x").map(Number);
const browser = await launch(chromium);
const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = { lab, variant: VARIANT, viewport: VIEWPORT, states: {} };

for (const state of STATES) {
  await page.goto(masterUrl(lab, config, { state, variant: VARIANT }), { waitUntil: "load" });
  await page.waitForTimeout(400);
  report.states[state] = await page.evaluate(AUDIT);
}
await browser.close();

const KEYS = ["colors", "weights", "families", "contrast", "targets", "radii", "motion", "ramp", "leading", "leadingLadder", "tracking", "trackingLadder"];
const totals = Object.fromEntries(KEYS.map((k) => [k, 0]));
for (const state of Object.keys(report.states)) {
  for (const key of KEYS) totals[key] += report.states[state][key].length;
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
    line("type ramp", r.ramp, (i) => `${i.el} ${i.size}px  "${i.text}"`);
    line("leading", r.leading, (i) => `${i.el} line-height normal  "${i.text}"`);
    line("lead ladder", r.leadingLadder, (i) => `${i.el} ${i.size}px at ${i.lead}  "${i.text}"`);
    line("tracking", r.tracking, (i) => `${i.key} → ${i.values}   ${i.where}`);
    line("track ladder", r.trackingLadder, (i) => `${i.el} ${i.size}px at ${i.track}  "${i.text}"`);
  }
  process.stdout.write(`\nTOTALS  ${JSON.stringify(totals)}\n`);
  if (!TYPE_RAMP.length) process.stdout.write(`note: type-ramp check skipped — fill ladders.typeRamp at the palette lock\n`);
}

process.exit(KEYS.reduce((sum, k) => sum + totals[k], 0) > 0 ? 1 : 0);
