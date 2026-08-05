#!/usr/bin/env node
/**
 * Contrast gate — walks every rendered text node on a live page and fails
 * on genuine WCAG 2.1 SC 1.4.3 (AA) contrast violations: 4.5:1 for normal
 * text, 3:1 for large text (>=24px at any weight, or >=18.66px at >=700
 * weight — the standard "14pt bold / 18pt regular" large-text definition).
 *
 * Written because `axe-core` marked the exact nodes that violate this
 * design's translucent "glass" panels and dimmed ancestors as "incomplete"
 * rather than "failed" ("background color could not be determined because
 * it is overlapped", "content is too short to determine if it is actual
 * text content") — so a clean axe run proves nothing here. This gate
 * computes the ratio itself instead of trusting axe's verdict.
 *
 * What it does that a naive rgb()-only checker won't:
 *
 *  - Resolves `color(srgb r g b [/ a])` — the form this design's
 *    `color-mix(in srgb, ...)` tokens compute to in Chromium (confirmed
 *    empirically: `color-mix(in srgb, white 94%, transparent)` computes to
 *    `color(srgb 1 1 1 / 0.94)`, never `rgba()`). A prior harness matched
 *    only rgb()/rgba() and silently skipped every one of these.
 *  - Composites each ancestor's own `opacity` down the chain before
 *    comparing, so a dimmed wrapper (e.g. `opacity: .78`) lands in the
 *    text's *effective* colour, not just its authored one.
 *  - Resolves the true backdrop by alpha-compositing every ancestor's
 *    `background-color` from <html> down to the text, so a translucent
 *    panel sitting over another panel (or the page canvas) lands on the
 *    right base colour instead of stopping at the first non-transparent
 *    layer it meets.
 *
 * Known limitations (shared with axe-core and every other static checker):
 * cannot see through `background-image` (photos/gradients) or simulate
 * `backdrop-filter` blur, and cannot inspect ::before/::after generated
 * content (not real DOM text nodes). None of the three findings this gate
 * was written for involved either.
 *
 * Usage: node scripts/check-contrast.mjs [url]
 *   url defaults to http://localhost:3499/app/tasks and is the only
 *   accepted positional argument.
 *
 * Exits non-zero on any AA violation, and also on any computed colour it
 * could not parse — an unparseable colour is a blind spot, not a pass.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "http://localhost:3499/app/tasks";
// Matches the "desktop" project in experience/browser-contract.json, this
// repo's own reference viewport for production-representative captures.
const VIEWPORT = { width: 1280, height: 900 };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Resolve Playwright against *this worktree's* package.json rather than
// relying on ambient module resolution, so this script always launches the
// browser this project actually declares/installs, regardless of the
// invoking shell's cwd.
const require = createRequire(path.join(REPO_ROOT, "package.json"));
const { chromium } = require("@playwright/test");

// ────────────────────────────────────────────────────────────────────────
// Browser-side evaluation. Runs inside the page via page.evaluate — no
// access to anything above this point; must be fully self-contained.
// ────────────────────────────────────────────────────────────────────────

function collectContrastFindings() {
  /** @param {string} raw */
  function parseColor(raw) {
    if (!raw) return null;
    const str = raw.trim();
    if (str === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

    // Legacy rgb()/rgba() — getComputedStyle's normal form for anything
    // authored as a plain sRGB colour (hex, named, rgb(), rgba()).
    let m = str.match(
      /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i,
    );
    if (m) {
      const a = m[4] === undefined ? 1 : parsePercentOrFloat(m[4]);
      return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
    }

    // CSS Color 4 `color(srgb r g b [/ a])` — what `color-mix(in srgb, …)`
    // resolves to. Channels here are 0–1 floats, not 0–255.
    m = str.match(
      /^color\(\s*srgb\s+([\d.]+|none)\s+([\d.]+|none)\s+([\d.]+|none)\s*(?:\/\s*([\d.]+%?|none))?\s*\)$/i,
    );
    if (m) {
      const chan = (v) => (v === "none" ? 0 : parseFloat(v)) * 255;
      const a = m[4] === undefined || m[4] === "none" ? 1 : parsePercentOrFloat(m[4]);
      return { r: chan(m[1]), g: chan(m[2]), b: chan(m[3]), a };
    }

    return null; // unparseable — reported, never silently treated as a pass
  }

  function parsePercentOrFloat(v) {
    return v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
  }

  function clamp255(v) {
    return Math.max(0, Math.min(255, v));
  }

  /** Standard "source-over" alpha composite of fg onto an opaque bg. */
  function compositeOver(fg, bg) {
    const a = Math.max(0, Math.min(1, fg.a));
    return {
      r: clamp255(fg.r * a + bg.r * (1 - a)),
      g: clamp255(fg.g * a + bg.g * (1 - a)),
      b: clamp255(fg.b * a + bg.b * (1 - a)),
    };
  }

  function srgbChannelToLinear(c) {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(rgb) {
    return (
      0.2126 * srgbChannelToLinear(rgb.r) +
      0.7152 * srgbChannelToLinear(rgb.g) +
      0.0722 * srgbChannelToLinear(rgb.b)
    );
  }

  function contrastRatio(rgbA, rgbB) {
    const lA = relativeLuminance(rgbA);
    const lB = relativeLuminance(rgbB);
    const lighter = Math.max(lA, lB);
    const darker = Math.min(lA, lB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Element style cache — many text nodes on a page share ancestors, no
  // need to re-read getComputedStyle for the same element repeatedly.
  const styleCache = new Map();
  function styleOf(el) {
    let s = styleCache.get(el);
    if (!s) {
      const cs = getComputedStyle(el);
      s = { opacity: parseFloat(cs.opacity), backgroundColor: cs.backgroundColor };
      styleCache.set(el, s);
    }
    return s;
  }

  /**
   * Walks the ancestor chain from <html> down to (and including) `el`,
   * alpha-compositing every ancestor's own background-color (each dimmed
   * by the opacity accumulated up to and including that ancestor) onto a
   * white canvas base, and multiplying every ancestor's own opacity into
   * one running product. Root-to-leaf order matches real paint order:
   * parents paint first, children paint over them.
   */
  function resolveBackdropAndOpacity(el) {
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.unshift(node);

    let cumulativeOpacity = 1;
    let backdrop = { r: 255, g: 255, b: 255 }; // page canvas fallback

    for (const node of chain) {
      const s = styleOf(node);
      if (!Number.isNaN(s.opacity)) cumulativeOpacity *= s.opacity;
      const bg = parseColor(s.backgroundColor);
      if (bg && bg.a > 0) {
        const layerAlpha = Math.min(1, bg.a * cumulativeOpacity);
        if (layerAlpha > 0) {
          backdrop = compositeOver({ r: bg.r, g: bg.g, b: bg.b, a: layerAlpha }, backdrop);
        }
      }
    }
    return { backdrop, opacityProduct: cumulativeOpacity };
  }

  function isLargeText(fontSizePx, fontWeight) {
    // WCAG 1.4.3 "large-scale text": >=18pt (24px) at any weight, or
    // >=14pt (18.66px) at bold (>=700).
    return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  }

  function isRendered(el) {
    const cs = getComputedStyle(el);
    if (cs.display === "none") return { ok: false, reason: "display:none" };
    if (cs.visibility === "hidden" || cs.visibility === "collapse") {
      return { ok: false, reason: "visibility:hidden" };
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { ok: false, reason: "zero-size" };
    return { ok: true, reason: null };
  }

  function cssPath(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(`${part}#${node.id}`);
        break;
      }
      if (typeof node.className === "string" && node.className.trim()) {
        const cls = node.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) part += "." + cls.join(".");
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
    }
    return parts.join(" > ");
  }

  // Group every non-empty text node by its direct parent element — that
  // element's computed style is what actually paints the glyphs.
  const byElement = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.trim() === "") return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "NOSCRIPT") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let textNode;
  while ((textNode = walker.nextNode())) {
    const el = textNode.parentElement;
    if (!byElement.has(el)) byElement.set(el, textNode.nodeValue.trim());
  }

  const results = [];
  const skipped = { "display:none": 0, "visibility:hidden": 0, "zero-size": 0, "empty-text": 0 };
  const unparseable = [];

  for (const [el, sampleText] of byElement) {
    if (!sampleText) {
      skipped["empty-text"] += 1;
      continue;
    }
    const rendered = isRendered(el);
    if (!rendered.ok) {
      skipped[rendered.reason] += 1;
      continue;
    }

    const cs = getComputedStyle(el);
    const textColor = parseColor(cs.color);
    if (!textColor) {
      unparseable.push({ selector: cssPath(el), text: sampleText.slice(0, 60), raw: cs.color });
      continue;
    }

    const fontSizePx = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const large = isLargeText(fontSizePx, fontWeight);
    const threshold = large ? 3.0 : 4.5;

    const { backdrop, opacityProduct } = resolveBackdropAndOpacity(el);
    const effectiveAlpha = Math.max(0, Math.min(1, textColor.a * opacityProduct));
    const effectiveTextRGB = compositeOver(
      { r: textColor.r, g: textColor.g, b: textColor.b, a: effectiveAlpha },
      backdrop,
    );
    const ratio = contrastRatio(effectiveTextRGB, backdrop);

    results.push({
      selector: cssPath(el),
      text: sampleText.slice(0, 60),
      fontSizePx,
      fontWeight,
      large,
      threshold,
      ratio,
      pass: ratio >= threshold - 1e-6,
      rawColor: cs.color,
      rawBackground: cs.backgroundColor,
      effectiveTextRGB,
      backdropRGB: backdrop,
      opacityProduct,
    });
  }

  return { results, skipped, unparseable, scannedElements: byElement.size };
}

// ────────────────────────────────────────────────────────────────────────
// Node-side orchestration + reporting.
// ────────────────────────────────────────────────────────────────────────

function fmtRGB(rgb) {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

async function main() {
  const url = process.argv[2] || DEFAULT_URL;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.emulateMedia({ colorScheme: "light" });
    // Next's dev server keeps an HMR websocket (and dev-only polling) open
    // indefinitely, so `networkidle` never resolves against `next dev` —
    // wait for `load` and then a generous hydration/paint settle instead.
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1500);

    const { results, skipped, unparseable, scannedElements } = await page.evaluate(
      collectContrastFindings,
    );

    const failures = results.filter((r) => !r.pass);
    const skipTotal = Object.values(skipped).reduce((a, b) => a + b, 0);

    console.log(`Contrast gate — ${url}`);
    console.log(
      `Scanned ${scannedElements} text-bearing elements (${results.length} evaluated, ` +
        `${skipTotal} skipped, ${unparseable.length} unparseable).`,
    );
    console.log(
      `  skipped: display:none=${skipped["display:none"]}, visibility:hidden=${skipped["visibility:hidden"]}, ` +
        `zero-size=${skipped["zero-size"]}, empty-text=${skipped["empty-text"]}`,
    );
    console.log("");

    if (unparseable.length > 0) {
      console.log(`COULD NOT EVALUATE (${unparseable.length}) — unparseable computed colour:`);
      for (const u of unparseable) {
        console.log(`  ${u.selector}`);
        console.log(`    text: "${u.text}"`);
        console.log(`    color: ${u.raw}`);
      }
      console.log("");
    }

    if (failures.length > 0) {
      console.log(`FAIL — ${failures.length} AA contrast violation(s):`);
      console.log("");
      for (const f of failures) {
        console.log(
          `  ${f.ratio.toFixed(2)}:1 (needs ${f.threshold.toFixed(1)}:1) — ` +
            `${f.large ? "large" : "normal"} text, ${f.fontSizePx.toFixed(1)}px/${f.fontWeight}`,
        );
        console.log(`    selector: ${f.selector}`);
        console.log(`    text: "${f.text}"`);
        console.log(
          `    color:      ${f.rawColor}  →  effective ${fmtRGB(f.effectiveTextRGB)}` +
            (f.opacityProduct < 1 ? ` (opacity chain × ${f.opacityProduct.toFixed(3)})` : ""),
        );
        console.log(`    background: ${f.rawBackground}  →  resolved ${fmtRGB(f.backdropRGB)}`);
        console.log("");
      }
    }

    const ok = failures.length === 0 && unparseable.length === 0;
    if (ok) {
      console.log(`PASS — ${results.length} text nodes checked, 0 AA violations.`);
    } else {
      console.log(
        `${failures.length} contrast failure(s), ${unparseable.length} unparseable colour(s). ` +
          `Threshold: 4.5:1 normal text / 3:1 large text (>=24px any weight, >=18.66px bold).`,
      );
    }
    process.exitCode = ok ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("check-contrast: fatal error");
  console.error(err);
  process.exitCode = 1;
});
