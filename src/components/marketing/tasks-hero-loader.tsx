"use client";

/**
 * Tasks hero loader — v2, combined split-flap.
 *
 * Real task copy scrambles in character by character (departure-board
 * mechanism) on the white canvas — no dark box, just type on paper. Both
 * rows strike through in indigo, then a board wipe scatters the chars.
 * "tasks" reassembles at full wordmark scale using the identical mechanism:
 * same physics, different size, Geist Mono → Geist. The font shift at that
 * larger scale is the brand crystallisation moment.
 *
 * SAFETY CONTRACT (loader canon §13):
 *   · Fully scoped — every class and @keyframes prefixed `txl-`.
 *   · In-flow only — no position:fixed, no inset:0, no high z-index.
 *   · All setTimeout IDs collected; cancelled + cleared on unmount.
 *   · prefers-reduced-motion → final settled state rendered immediately,
 *     no animation, no delay.
 */

import { useEffect, useRef } from "react";

const SC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·–/";
const SN = 3;    // scramble steps before landing
const FM = 54;   // ms per scramble frame
const QST = 27;  // queue char stagger ms
const WST = 44;  // wordmark char stagger ms (heavier weight)

function rc() {
  return SC[Math.floor(Math.random() * SC.length)];
}

export function TasksHeroLoader() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Element refs (! justified — we own the JSX) ──
    const queueEl = root.querySelector<HTMLElement>(".txl-queue")!;
    const qr1     = root.querySelector<HTMLElement>(".txl-qr1")!;
    const qr2     = root.querySelector<HTMLElement>(".txl-qr2")!;
    const qt1     = root.querySelector<HTMLElement>(".txl-qt1")!;
    const qt2     = root.querySelector<HTMLElement>(".txl-qt2")!;
    const qx1     = root.querySelector<HTMLElement>(".txl-qx1")!;
    const qx2     = root.querySelector<HTMLElement>(".txl-qx2")!;
    const wmsEl   = root.querySelector<HTMLElement>(".txl-wm-stage")!;
    const wmcEl   = root.querySelector<HTMLElement>(".txl-wm-chars")!;
    const wmdEl   = root.querySelector<HTMLElement>(".txl-wm-dot")!;
    const capEl   = root.querySelector<HTMLElement>(".txl-caption")!;

    // Runtime safety guard
    if (!queueEl || !qr1 || !qr2 || !qt1 || !qt2 || !qx1 || !qx2 ||
        !wmsEl   || !wmcEl || !wmdEl || !capEl) return;

    // ── Reduced motion: skip to final state ──────
    if (reduced) {
      buildChars(wmcEl, "tasks", "txl-wc").forEach(({ span, ch }) => {
        if (ch !== " ") span.textContent = ch;
      });
      queueEl.classList.add("txl-hidden");
      wmsEl.classList.add("txl-on");
      wmdEl.classList.add("txl-on");
      capEl.classList.add("txl-on");
      return;
    }

    // ── Cancellation + timer tracking ────────────
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const defer = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
    };
    const wait = (ms: number) =>
      new Promise<void>((ok) => {
        const id = setTimeout(ok, ms);
        timers.push(id);
      });

    // ── DOM helpers ───────────────────────────────
    interface Cell { span: HTMLSpanElement; ch: string; }

    function buildChars(el: HTMLElement, text: string, cls: string): Cell[] {
      el.innerHTML = "";
      return [...text].map((ch) => {
        const span = document.createElement("span");
        span.className = cls + (ch === " " ? " txl-sp" : "");
        span.textContent = " ";
        el.appendChild(span);
        return { span, ch };
      });
    }

    function animSpan(span: HTMLSpanElement, target: string, startAt: number) {
      return new Promise<void>((ok) => {
        if (target === " ") {
          const id = setTimeout(ok, startAt + FM);
          timers.push(id);
          return;
        }
        let n = 0;
        function tick() {
          if (cancelled) { ok(); return; }
          span.classList.remove("txl-flip", "txl-snap", "txl-wipe");
          void span.offsetWidth;
          if (n < SN) {
            span.textContent = rc();
            span.classList.add("txl-flip");
            n++;
            defer(tick, FM);
          } else {
            span.textContent = target;
            span.classList.add("txl-snap");
            const id = setTimeout(ok, 68);
            timers.push(id);
          }
        }
        defer(tick, startAt);
      });
    }

    function animText(
      el: HTMLElement,
      text: string,
      cls: string,
      stagger: number
    ) {
      const cells = buildChars(el, text, cls);
      return Promise.all(
        cells.map(({ span, ch }, i) => animSpan(span, ch, i * stagger))
      );
    }

    function strikeRow(rowEl: HTMLElement) {
      return new Promise<void>((ok) => {
        rowEl.classList.add("txl-struck");
        const id = setTimeout(ok, 320);
        timers.push(id);
      });
    }

    function wipeChars(el: HTMLElement) {
      [...el.querySelectorAll<HTMLElement>(".txl-c")].forEach((s) => {
        const jitter = Math.floor(Math.random() * 28);
        defer(() => {
          s.classList.remove("txl-flip", "txl-snap", "txl-wipe");
          void s.offsetWidth;
          s.classList.add("txl-wipe");
          defer(() => {
            s.textContent = " ";
            s.classList.remove("txl-wipe");
          }, 50);
        }, jitter);
      });
      return new Promise<void>((ok) => {
        const id = setTimeout(ok, 110);
        timers.push(id);
      });
    }

    // ── Main sequence ─────────────────────────────
    async function play() {
      // Row 1: tag on, chars assemble
      await wait(320);
      if (cancelled) return;
      qt1.classList.add("txl-on");
      await animText(qx1, "BREGMAN · EDIT R2", "txl-c", QST);
      if (cancelled) return;
      await wait(230);
      if (cancelled) return;
      await strikeRow(qr1);

      // Row 2: tag on, chars assemble
      await wait(160);
      if (cancelled) return;
      qt2.classList.add("txl-on");
      await animText(qx2, "COOMBE · FINAL DLVR", "txl-c", QST);
      if (cancelled) return;
      await wait(230);
      if (cancelled) return;
      await strikeRow(qr2);

      // Board wipe: tags fade, chars scatter, queue hides
      await wait(320);
      if (cancelled) return;
      qt1.style.opacity = "0";
      qt2.style.opacity = "0";
      await Promise.all([wipeChars(qx1), wipeChars(qx2)]);
      if (cancelled) return;
      queueEl.classList.add("txl-hidden");

      // Wordmark assembles using same split-flap mechanism
      await wait(60);
      if (cancelled) return;
      wmsEl.classList.add("txl-on");
      await animText(wmcEl, "tasks", "txl-wc", WST);
      if (cancelled) return;

      // Dot materialises
      await wait(130);
      if (cancelled) return;
      wmdEl.style.animation = "";
      void wmdEl.offsetWidth;
      wmdEl.classList.add("txl-on");

      // Caption
      await wait(500);
      if (cancelled) return;
      capEl.classList.add("txl-on");
    }

    play();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <section className="txl-hero-section" ref={rootRef} aria-label="Signal Tasks">

      {/* Corner chrome */}
      <div className="txl-chrome txl-chrome-tl">
        <span className="txl-wm-badge">
          signal studio
          <span className="txl-badge-dot" />
          <span className="txl-sep">/</span>tasks
        </span>
      </div>
      <div className="txl-chrome txl-chrome-tr">
        <span className="txl-pip" aria-hidden />
        queue · live
      </div>

      {/* Animated stage — queue and wordmark share this center */}
      <div className="txl-stage" aria-hidden>

        {/* Task queue rows — populated by JS */}
        <div className="txl-queue">
          <div className="txl-qrow txl-qr1">
            <span className="txl-qtag txl-qt1">WEDDING</span>
            <span className="txl-qtext txl-qx1" />
          </div>
          <div className="txl-qrow txl-qr2">
            <span className="txl-qtag txl-qt2">DELIVERY</span>
            <span className="txl-qtext txl-qx2" />
          </div>
        </div>

        {/* Wordmark — hidden until queue clears, chars injected by JS */}
        <div className="txl-wm-stage">
          <div className="txl-wm-chars" />
          <div className="txl-wm-dot" />
        </div>

      </div>

      {/* Caption */}
      <p className="txl-caption">every task. done.</p>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
/* ── Section ──────────────────────────────────── */
.txl-hero-section {
  position: relative;
  overflow: hidden;
  background: var(--bg, #ffffff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(88vh, 900px);
  padding: clamp(80px,12vh,160px) 24px clamp(64px,10vh,128px);
}

/* ── Design tokens ────────────────────────────── */
.txl-hero-section {
  --txl-ink:        #111111;
  --txl-stone-400:  #b8b2a3;
  --txl-stone-500:  #8c887e;
  --txl-indigo:     #4f46e5;
  --txl-hairline:   rgba(17,17,17,0.05);
  --txl-font:       var(--font-geist-sans,'Geist',system-ui,sans-serif);
  --txl-mono:       var(--font-geist-mono,'Geist Mono',ui-monospace,monospace);
  --txl-wm-size:    clamp(58px,10vw,108px);
}

/* ── Chrome ───────────────────────────────────── */
.txl-chrome {
  position: absolute;
  font-family: var(--txl-mono);
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--txl-stone-500);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.txl-chrome-tl { top: 28px; left: 32px; }
.txl-chrome-tr { top: 28px; right: 32px; }
.txl-wm-badge {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--txl-font);
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -.025em;
  line-height: .95;
  color: var(--txl-ink);
  text-transform: none;
}
.txl-badge-dot {
  width: .16em; height: .16em;
  border-radius: 50%;
  background: var(--txl-indigo);
  margin-left: .06em;
  align-self: flex-end;
  margin-bottom: .06em;
  flex: 0 0 auto;
}
.txl-sep { color: var(--txl-stone-500); margin: 0 .4em; font-weight: 300; }
.txl-pip {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--txl-indigo);
  display: inline-block;
  animation: txl-pip-blink 1.6s cubic-bezier(.45,.05,.55,.95) infinite;
}
@keyframes txl-pip-blink { 0%,100%{opacity:1} 50%{opacity:.35} }

/* ── Stage ────────────────────────────────────── */
.txl-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: var(--txl-wm-size);
}

/* ── Queue ────────────────────────────────────── */
.txl-queue {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: clamp(6px,1.2vw,12px);
  align-items: flex-start;
  transition: opacity .18s ease;
}
.txl-queue.txl-hidden {
  opacity: 0;
  pointer-events: none;
}

.txl-qrow + .txl-qrow {
  border-top: 1px solid var(--txl-hairline);
  padding-top: clamp(6px,1.2vw,12px);
}

.txl-qrow {
  display: flex;
  align-items: center;
  gap: clamp(8px,1.4vw,14px);
}

.txl-qtag {
  font-family: var(--txl-mono);
  font-size: 9px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--txl-indigo);
  background: rgba(79,70,229,.1);
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 500;
  white-space: nowrap;
  flex: 0 0 auto;
  min-width: 72px;
  text-align: center;
  opacity: 0;
  transition: opacity .22s ease;
}
.txl-qtag.txl-on { opacity: 1; }

/* Strike line on text region */
.txl-qtext {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  position: relative;
}
.txl-qtext::after {
  content: '';
  position: absolute;
  left: 0; top: 50%;
  height: 1.5px; width: 0;
  background: var(--txl-indigo);
  transform: translateY(-50%);
  transition: width .3s cubic-bezier(.55,.06,.68,.19);
  pointer-events: none;
}
.txl-qrow.txl-struck .txl-qtext::after { width: 100%; }
.txl-qrow.txl-struck .txl-c {
  color: var(--txl-stone-400) !important;
  transition: color .18s ease .06s;
}

/* ── Queue char cells ─────────────────────────── */
.txl-c {
  display: inline-block;
  font-family: var(--txl-mono);
  font-size: clamp(14px,2.4vw,19px);
  font-weight: 500;
  color: var(--txl-ink);
  width: 1ch;
  text-align: center;
  line-height: 1.3;
  position: relative;
}
.txl-c.txl-sp { width: .52ch; }

/* Hinge line — the split-flap tell */
.txl-c:not(.txl-sp)::after {
  content: '';
  position: absolute;
  top: calc(50% + .5px);
  left: 1px; right: 1px;
  height: 1px;
  background: rgba(17,17,17,.07);
  pointer-events: none;
}

/* ── Wordmark stage ───────────────────────────── */
.txl-wm-stage {
  position: absolute;
  display: inline-flex;
  align-items: baseline;
  font-size: var(--txl-wm-size);
  opacity: 0;
}
.txl-wm-stage.txl-on { opacity: 1; }

.txl-wm-chars {
  display: inline-flex;
  align-items: baseline;
  font-size: 1em;
}

/* Wordmark char cells — Geist sans, large scale */
.txl-wc {
  display: inline-block;
  font-family: var(--txl-font);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: -.04em;
  color: var(--txl-ink);
  line-height: .95;
}

/* Dot — em units inherit from .txl-wm-stage font-size */
.txl-wm-dot {
  width: .155em; height: .155em;
  border-radius: 50%;
  background: var(--txl-indigo);
  margin-left: .045em;
  align-self: flex-end;
  margin-bottom: .075em;
  flex: 0 0 auto;
  opacity: 0;
}
.txl-wm-dot.txl-on {
  animation:
    txl-dot-in   .44s cubic-bezier(.34,1.56,.64,1)    forwards,
    txl-dot-pulse 2.6s ease-in-out               1.3s infinite;
}
@keyframes txl-dot-in {
  0%   { opacity: 0; transform: scale(.25); }
  100% { opacity: 1; transform: scale(1);   }
}
@keyframes txl-dot-pulse {
  0%,30%,100% { transform: scale(1);    opacity: 1; }
  15%         { transform: scale(1.26); opacity: 1; }
  22%         { transform: scale(.92);  opacity: 1; }
}

/* ── Shared char animations ───────────────────── */
@keyframes txl-flip {
  0%   { transform: scaleY(1);    }
  38%  { transform: scaleY(.04);  }
  100% { transform: scaleY(1);    }
}
@keyframes txl-snap {
  0%   { transform: scaleY(.04);  }
  66%  { transform: scaleY(1.07); }
  100% { transform: scaleY(1);    }
}
@keyframes txl-wipe {
  0%   { transform: scaleY(1); opacity: 1; }
  100% { transform: scaleY(0); opacity: 0; }
}
.txl-c.txl-flip,
.txl-wc.txl-flip { animation: txl-flip 52ms ease          forwards; }
.txl-c.txl-snap,
.txl-wc.txl-snap { animation: txl-snap 60ms cubic-bezier(.34,1.4,.64,1) forwards; }
.txl-c.txl-wipe,
.txl-wc.txl-wipe { animation: txl-wipe 45ms ease          forwards; }

/* ── Caption ──────────────────────────────────── */
.txl-caption {
  font-family: var(--txl-mono);
  font-size: 11px;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--txl-stone-500);
  opacity: 0;
  margin-top: clamp(28px,5vh,48px);
}
.txl-caption.txl-on {
  animation: txl-caption-in .65s cubic-bezier(.22,.7,.2,1) forwards;
}
@keyframes txl-caption-in {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0);   }
}

/* ── Reduced motion ───────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .txl-queue.txl-hidden     { opacity: 0 !important; }
  .txl-wm-stage.txl-on      { opacity: 1 !important; }
  .txl-wm-dot.txl-on        { opacity: 1 !important; animation: none !important; }
  .txl-caption.txl-on       { opacity: 1 !important; animation: none !important; }
  .txl-pip                  { animation: none !important; }
}

/* ── Responsive chrome ────────────────────────── */
@media (max-width: 600px) {
  .txl-chrome-tl { top: 18px; left: 20px; }
  .txl-chrome-tr { top: 18px; right: 20px; font-size: 10px; }
}
@media (max-width: 420px) {
  .txl-chrome-tr { display: none; }
}
`;
