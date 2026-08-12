"use client";

/**
 * Arrival settle — the loading boundary's hand-off to the surface it held.
 *
 * THE DEFECT. Entering a product was the most-seen motion moment in the app
 * and it ended on a hard cut: the wordmark choreography played, the boundary
 * yielded, and the finished board simply replaced it. The loader built a
 * rhythm and then threw it away (wave-6 panel, Motion seat, material).
 *
 * WHAT THIS IS. One whole-surface opacity settle on the surface that replaces
 * the loader — 0.6 → 1 at --motion-fast on --ease-out, on the product canvas
 * itself. Not a per-card stagger (forbidden: page-load card staggers), not a
 * slide, not a second choreography. One dominant movement, and the movement
 * is the surface finishing its arrival.
 *
 * IT RIDES THE REPLACEMENT, IT DOES NOT GATE IT. The contract's budget is
 * "route and representation changes are immediate", so the settle is applied
 * AFTER the swap has already landed in the DOM, to an element that is fully
 * interactive from its first frame: an opacity animation takes no pointer
 * events, holds no layout, and delays no input. Kill it mid-flight and
 * nothing about the surface changes except that it is already opaque.
 *
 * TWO WAYS IN, ONE MOVEMENT, BECAUSE THERE ARE TWO WAYS OUT. A loading
 * boundary is torn down by two different mechanics and only one of them is
 * React's:
 *
 *   Cold document load — the boundary is server-streamed and React's own
 *     inline script swaps it out BEFORE the fallback subtree is hydrated.
 *     Measured on this build: the /app/tasks boot boundary yields at ~500ms,
 *     long before that. No component mounted, so no effect can fire; only a
 *     parse-time script is already running. It watches for its own removal —
 *     a MutationObserver callback is a microtask, so the settle starts in the
 *     same frame the swap lands in, with no flash at full opacity first.
 *
 *   Client-side navigation — React renders the fallback on the client, and
 *     an inline script it inserts is NOT executed (measured: zero settles on
 *     a Tasks → Notes jump when the script was the only path). Here the
 *     component IS mounted, so the unmount cleanup of a layout effect is the
 *     signal, and it runs in the commit that removes the fallback, before
 *     the browser paints.
 *
 * Both call the same `playSurfaceSettle`, and every value they could drift on
 * — the surface selector, the animation id, the opacity floor — is a shared
 * constant. If both fire, the second cancels the first and the viewer still
 * sees exactly one settle.
 *
 * REDUCED MOTION. Absolute: both paths return before they animate anything,
 * so the instant swap reduced-motion users have today is untouched. The
 * duration is read from --motion-fast, which tokens.css already zeroes under
 * reduced motion, so a second guard would have to fail as well.
 *
 * Render it inside a loading boundary, beside the loader's own markup.
 */

import { useLayoutEffect } from "react";

/** The product canvas — the same element on all four /app products. */
const SURFACE = "main#app-main-content,[data-product-canvas]";
/** Tags the settle so a second one can cancel the first. */
const SETTLE_ID = "surface-arrival";
/** Where the surface resolves from. Paper-toned, not a fade-in from nothing. */
const FROM_OPACITY = 0.6;

/**
 * The settle, for the path where a component is mounted to run it.
 *
 * The duration is read from the token rather than typed, so it can never
 * drift from --motion-fast. Read it in whatever unit the stylesheet pipeline
 * hands back, though: the authored `140ms` reaches the browser as the
 * computed string ".14s", and a bare parseFloat of that is 0.14 — an
 * animation 0.14 MILLISECONDS long, which is a cut wearing the costume of a
 * settle. Measured on this build, not assumed.
 */
function playSurfaceSettle(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const target = document.querySelector<HTMLElement>(SURFACE);
  if (!target?.animate) return;
  const tokens = getComputedStyle(document.documentElement);
  const raw = tokens.getPropertyValue("--motion-fast").trim();
  let duration = parseFloat(raw) || 0;
  if (duration && raw.slice(-2) !== "ms") duration *= 1000;
  if (!raw) duration = 140;
  if (!(duration > 0)) return;
  const easing = tokens.getPropertyValue("--ease-out").trim() || "ease-out";
  for (const running of target.getAnimations()) {
    if (running.id === SETTLE_ID) running.cancel();
  }
  const settle = target.animate([{ opacity: FROM_OPACITY }, { opacity: 1 }], {
    duration,
    easing,
  });
  settle.id = SETTLE_ID;
}

/**
 * The same settle, for the path where nothing is mounted yet. Kept as one
 * line — it is inlined into the document verbatim — and built from the
 * constants above so the two forms cannot disagree about what they animate.
 *
 * `document.currentScript` is the script itself, and its parent is the
 * container the boundary's fallback lives in; that container outlives the
 * fallback, which is what makes a childList observation on it the exact
 * signal for "the loader has been replaced".
 */
const ARRIVAL_SETTLE_SCRIPT = `(function(){var s=document.currentScript,p=s&&s.parentNode;if(!p||!window.matchMedia||matchMedia("(prefers-reduced-motion:reduce)").matches)return;var o=new MutationObserver(function(){if(s.isConnected)return;o.disconnect();var t=document.querySelector("${SURFACE}");if(!t||!t.animate)return;var c=getComputedStyle(document.documentElement),v=c.getPropertyValue("--motion-fast").trim(),d=parseFloat(v)||0,e=c.getPropertyValue("--ease-out").trim()||"ease-out";if(d&&v.slice(-2)!=="ms")d*=1000;if(!v)d=140;if(!(d>0))return;t.getAnimations().forEach(function(a){if(a.id==="${SETTLE_ID}")a.cancel()});var a=t.animate([{opacity:${FROM_OPACITY}},{opacity:1}],{duration:d,easing:e});a.id="${SETTLE_ID}"});o.observe(p,{childList:true})})();`;

export function ArrivalSettle() {
  // The cleanup, not the effect: this component only ever exists inside a
  // loading fallback, so its unmount IS the arrival of the real surface.
  useLayoutEffect(() => () => playSurfaceSettle(), []);
  return <script dangerouslySetInnerHTML={{ __html: ARRIVAL_SETTLE_SCRIPT }} />;
}
