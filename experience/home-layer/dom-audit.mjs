/**
 * Home operating-layer evidence harness · the in-page probes.
 *
 * Every function here is SERIALISED INTO THE BROWSER by Playwright, so each one
 * must be entirely self-contained: no import, no closure over module scope, no
 * reference to anything outside its own arguments. If a probe reaches for an
 * identifier defined in this file it will throw `x is not defined` inside the
 * page, and the message will not say why. They are grouped in one module so the
 * capture pipeline and the Playwright specs run the same code rather than two
 * implementations that drift.
 *
 * These probes RETURN FACTS AND NEVER VERDICTS. Whether a fact is a failure is
 * decided in Node, by `harness.mjs`, against the thresholds declared in
 * `capture-contract.json`. That split is deliberate: a probe that decided for
 * itself would have to carry the thresholds into the page, and the page is the
 * one place we cannot diff.
 *
 * A probe that cannot measure something reports `null` and a reason. It never
 * reports zero. A zero here would travel all the way to a review sheet as
 * "no overflow", "no console error", "no violations" — the exact false clear
 * this programme exists to make impossible.
 */

/**
 * Structure, overflow, landmarks, headings and nested-interactive facts.
 *
 * @param {{ overflowExemptSelector: string, overflowTolerancePx: number,
 *           nestedInteractiveSelector: string, nestedInteractiveChildSelector: string,
 *           focusableSelector: string }} options
 */
export function structureProbe(options) {
  const {
    overflowExemptSelector,
    overflowTolerancePx,
    nestedInteractiveSelector,
    nestedInteractiveChildSelector,
    focusableSelector,
  } = options;

  const visible = (el) => {
    if (!(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || el.getClientRects().length > 0;
  };

  /** A short, stable, human-readable path. Used to name an offender in a report. */
  const describe = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth += 1) {
      let part = node.tagName.toLowerCase();
      const testId = node.getAttribute("data-testid");
      if (node.id) part += `#${node.id}`;
      else if (testId) part += `[data-testid="${testId}"]`;
      else if (typeof node.className === "string" && node.className.trim()) {
        part += `.${node.className.trim().split(/\s+/).slice(0, 2).join(".")}`;
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ").slice(0, 200);
  };

  const accessibleName = (el) => {
    const label = el.getAttribute("aria-label");
    if (label && label.trim()) return label.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (text) return text.slice(0, 120);
    }
    return null;
  };

  const root = document.documentElement;
  const body = document.body;

  // ── Horizontal overflow ───────────────────────────────────────────────────
  // Measured three ways, because each alone can lie. scrollWidth can exceed
  // clientWidth on a page that cannot actually scroll, and a page that CAN
  // scroll is the thing a person feels. So the authoritative signal is the
  // third one: ask the document to scroll right and see whether it moved.
  const documentOverflowPx = root.scrollWidth - root.clientWidth;
  const bodyOverflowPx = body ? body.scrollWidth - root.clientWidth : null;

  const scrollBefore = root.scrollLeft || body?.scrollLeft || 0;
  window.scrollTo(99999, window.scrollY);
  const reachableScrollLeft = Math.round(
    Math.max(root.scrollLeft || 0, body?.scrollLeft || 0),
  );
  window.scrollTo(scrollBefore, window.scrollY);

  const clientWidth = root.clientWidth;
  const offenders = [];
  if (documentOverflowPx > overflowTolerancePx || reachableScrollLeft > overflowTolerancePx) {
    for (const el of Array.from(document.querySelectorAll("*"))) {
      if (offenders.length >= 12) break;
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      const spill = Math.round(rect.right - clientWidth);
      if (spill <= overflowTolerancePx) continue;
      // Exempt: the element itself, or any ancestor, is a declared scroller.
      let exempt = false;
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (overflowExemptSelector && node.matches(overflowExemptSelector)) {
          exempt = true;
          break;
        }
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") {
          exempt = true;
          break;
        }
      }
      if (exempt) continue;
      offenders.push({
        path: describe(el),
        spillPx: spill,
        rectRight: Math.round(rect.right),
        clientWidth,
      });
    }
  }

  // ── Landmarks and headings ────────────────────────────────────────────────
  const mains = Array.from(document.querySelectorAll("main, [role='main']")).filter(visible);
  const headings = Array.from(
    document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading']"),
  )
    .filter(visible)
    .map((el) => ({
      level: el.hasAttribute("aria-level")
        ? Number(el.getAttribute("aria-level"))
        : /^H[1-6]$/.test(el.tagName)
          ? Number(el.tagName[1])
          : null,
      text: (el.textContent ?? "").trim().slice(0, 120),
    }));
  const h1s = headings.filter((heading) => heading.level === 1);

  const navigations = Array.from(
    document.querySelectorAll("nav, [role='navigation']"),
  )
    .filter(visible)
    .map((el) => ({ name: accessibleName(el), links: el.querySelectorAll("a[href]").length }));

  const ariaCurrent = Array.from(document.querySelectorAll("[aria-current]"))
    .filter(visible)
    .map((el) => ({
      value: el.getAttribute("aria-current"),
      text: (el.textContent ?? "").trim().slice(0, 60),
      href: el.getAttribute("href"),
    }));

  // ── Nested interactive controls inside a wrapping link ────────────────────
  const nested = [];
  for (const link of Array.from(document.querySelectorAll(nestedInteractiveSelector))) {
    const inner = Array.from(link.querySelectorAll(nestedInteractiveChildSelector));
    if (!inner.length) continue;
    nested.push({
      link: describe(link),
      href: link.getAttribute("href"),
      children: inner.slice(0, 5).map((child) => describe(child)),
      childCount: inner.length,
    });
    if (nested.length >= 10) break;
  }

  const focusables = Array.from(document.querySelectorAll(focusableSelector)).filter(visible);

  return {
    title: document.title,
    url: location.pathname + location.search,
    lang: root.getAttribute("lang"),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    overflow: {
      clientWidth,
      documentScrollWidth: root.scrollWidth,
      documentOverflowPx,
      bodyOverflowPx,
      reachableScrollLeft,
      offenders,
    },
    landmarks: {
      mainCount: mains.length,
      mainNames: mains.map(accessibleName),
      navigations,
      bannerCount: document.querySelectorAll("header, [role='banner']").length,
      contentInfoCount: document.querySelectorAll("footer, [role='contentinfo']").length,
    },
    headings: { total: headings.length, h1Count: h1s.length, h1Text: h1s.map((h) => h.text), all: headings.slice(0, 40) },
    ariaCurrent,
    nestedInteractiveInsideLink: nested,
    focusableCount: focusables.length,
    liveRegions: Array.from(document.querySelectorAll("[aria-live], [role='status'], [role='alert']"))
      .filter(visible)
      .map((el) => ({
        role: el.getAttribute("role"),
        live: el.getAttribute("aria-live"),
        text: (el.textContent ?? "").trim().slice(0, 120),
      })),
  };
}

/**
 * Every visible busy indicator, with an identity stable enough to compare
 * across two samples. Sampled twice with a gap; an indicator present in both
 * samples with the same identity is indefinite.
 *
 * @param {{ busySelector: string }} options
 */
export function busyProbe(options) {
  const { busySelector } = options;
  const visible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const identify = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 5; depth += 1) {
      const parent = node.parentElement;
      const index = parent ? Array.prototype.indexOf.call(parent.children, node) : 0;
      parts.unshift(`${node.tagName.toLowerCase()}:${index}`);
      node = parent;
    }
    return parts.join("/");
  };

  return Array.from(document.querySelectorAll(busySelector))
    .filter(visible)
    .slice(0, 20)
    .map((el) => ({
      identity: identify(el),
      role: el.getAttribute("role"),
      ariaBusy: el.getAttribute("aria-busy"),
      ariaValueNow: el.getAttribute("aria-valuenow"),
      ariaLabel: el.getAttribute("aria-label"),
      // A determinate progress bar is not an indefinite spinner. Recorded so
      // the Node-side verdict can tell the two apart instead of guessing.
      determinate: el.getAttribute("aria-valuenow") !== null,
      text: (el.textContent ?? "").trim().slice(0, 80),
    }));
}

/**
 * Reads `document.activeElement` after a real Tab press and reports whether the
 * focus indicator is visible and whether the focused box is obscured.
 *
 * "Visible" is decided by comparison, not by looking for an outline: the probe
 * is given the unfocused computed style of the same element and reports which
 * properties changed. A design that shows focus with a background shift or an
 * inset shadow passes; a design that shows nothing fails. Checking only for
 * `outline-width > 0` would fail half the good designs and pass any design that
 * left a transparent outline behind.
 *
 * "Unobscured" is `elementFromPoint` at five points of the focused box: if the
 * element that answers is neither the focused element nor inside it at any of
 * them, something is on top.
 */
export function focusProbe() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return { ok: false, reason: "no-element-focused", path: null };
  }

  const describe = (node) => {
    const parts = [];
    let current = node;
    for (let depth = 0; current && current.nodeType === 1 && depth < 4; depth += 1) {
      let part = current.tagName.toLowerCase();
      if (current.id) part += `#${current.id}`;
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ").slice(0, 160);
  };

  const style = getComputedStyle(el);
  const snapshot = {
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    outlineColor: style.outlineColor,
    outlineOffset: style.outlineOffset,
    boxShadow: style.boxShadow,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    textDecorationLine: style.textDecorationLine,
    filter: style.filter,
  };

  const rect = el.getBoundingClientRect();
  const fullyInViewport =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight + 1 &&
    rect.right <= window.innerWidth + 1;
  // A tall row or a wide table cell can legitimately exceed the viewport while
  // its focus ring is perfectly visible, so "fully inside" is recorded but not
  // the test. The test is whether a usable amount of the focused box is on
  // screen at all: a control parked at y = -40 is focused and invisible, which
  // is the failure this is looking for.
  const overlapWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
  const overlapHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
  const visibleInViewport = overlapWidth >= 4 && overlapHeight >= 4;

  const samplePoints = rect.width > 0 && rect.height > 0
    ? [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + 2, rect.top + 2],
        [rect.right - 2, rect.top + 2],
        [rect.left + 2, rect.bottom - 2],
        [rect.right - 2, rect.bottom - 2],
      ]
    : [];

  const covers = [];
  for (const [x, y] of samplePoints) {
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      covers.push({ x: Math.round(x), y: Math.round(y), state: "outside-viewport" });
      continue;
    }
    const hit = document.elementFromPoint(x, y);
    if (!hit) {
      covers.push({ x: Math.round(x), y: Math.round(y), state: "nothing-hit" });
    } else if (hit === el || el.contains(hit) || hit.contains(el)) {
      covers.push({ x: Math.round(x), y: Math.round(y), state: "self" });
    } else {
      covers.push({ x: Math.round(x), y: Math.round(y), state: "covered", by: describe(hit) });
    }
  }

  let matchesFocusVisible = null;
  try {
    matchesFocusVisible = el.matches(":focus-visible");
  } catch {
    matchesFocusVisible = null; // engine without :focus-visible support — unknown, not false
  }

  return {
    ok: true,
    path: describe(el),
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role"),
    name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
    href: el.getAttribute("href"),
    matchesFocusVisible,
    style: snapshot,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    visibleInViewport,
    fullyInViewport,
    visibleOverlapPx: { width: Math.round(overlapWidth), height: Math.round(overlapHeight) },
    covers,
    // Identity for wrap detection. `path` alone collides constantly — a nav of
    // twelve links produces twelve identical "div > header > nav > a" strings,
    // and a sweep that stops at the first repeat would test two of them and
    // report a pass. Name and position separate them.
    identity: `${describe(el)}|${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60)}|${Math.round(rect.x)},${Math.round(rect.y)}`,
  };
}

/**
 * Reads the unfocused computed style of the element a given Tab press will
 * land on. Called with an index so the Node side can pair "before" and
 * "after" for the same element without holding a handle across a navigation.
 *
 * @param {{ focusableSelector: string, index: number }} options
 */
export function restingStyleProbe(options) {
  const { focusableSelector, index } = options;
  const visible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const list = Array.from(document.querySelectorAll(focusableSelector)).filter(visible);
  const el = list[index];
  if (!el) return null;
  const style = getComputedStyle(el);
  return {
    outlineStyle: style.outlineStyle,
    outlineWidth: style.outlineWidth,
    outlineColor: style.outlineColor,
    outlineOffset: style.outlineOffset,
    boxShadow: style.boxShadow,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    borderWidth: style.borderWidth,
    textDecorationLine: style.textDecorationLine,
    filter: style.filter,
  };
}
