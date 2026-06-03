"use client";

/**
 * Tasks hero rolodex — physical card-flip sequence.
 *
 * Three task cards flip through on a central horizontal axis (rotateX
 * perspective flip) — the physical Rolodex mechanic at card scale. Each card
 * carries a real task from the queue. After the final card clears, the deck
 * gives way to the "tasks." wordmark — identity crystallising from work.
 *
 * SAFETY CONTRACT (loader canon §13):
 *   · Fully scoped — every class and @keyframes prefixed `rxl-`.
 *   · In-flow only — no position:fixed, no inset:0, no high z-index.
 *   · All setTimeout IDs collected; cancelled + cleared on unmount.
 *   · prefers-reduced-motion → final settled state rendered immediately.
 */

import { useEffect, useRef } from "react";

const CARDS = [
  { tag: "WEDDING",  text: "BREGMAN · EDIT R2",      num: "01" },
  { tag: "DELIVERY", text: "COOMBE · FINAL DLVR",    num: "02" },
  { tag: "BRIEF",    text: "VENUE · MORNING CHECK",  num: "03" },
];

export function TasksHeroRolodex() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cardEl  = root.querySelector<HTMLElement>(".rxl-card")!;
    const tagEl   = root.querySelector<HTMLElement>(".rxl-card-tag")!;
    const textEl  = root.querySelector<HTMLElement>(".rxl-card-text")!;
    const numEl   = root.querySelector<HTMLElement>(".rxl-card-num")!;
    const wmsEl   = root.querySelector<HTMLElement>(".rxl-wm-stage")!;
    const wmdEl   = root.querySelector<HTMLElement>(".rxl-wm-dot")!;
    const capEl   = root.querySelector<HTMLElement>(".rxl-caption")!;

    if (!cardEl || !tagEl || !textEl || !numEl || !wmsEl || !wmdEl || !capEl) return;

    // ── Reduced motion: skip to final state ──────
    if (reduced) {
      cardEl.style.display = "none";
      wmsEl.classList.add("rxl-on");
      wmdEl.classList.add("rxl-on");
      capEl.classList.add("rxl-on");
      return;
    }

    // ── Cancellation + timer tracking ────────────
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((ok) => {
        if (cancelled) { ok(); return; }
        const id = setTimeout(() => { if (!cancelled) ok(); }, ms);
        timers.push(id);
      });

    // ── Card flip helpers ─────────────────────────
    async function flipOut() {
      cardEl.classList.remove("rxl-flip-in");
      void cardEl.offsetWidth;
      cardEl.classList.add("rxl-flip-out");
      await wait(260);
      cardEl.classList.remove("rxl-flip-out");
    }

    async function flipIn() {
      void cardEl.offsetWidth;
      cardEl.classList.add("rxl-flip-in");
      await wait(340);
    }

    // ── Main sequence ─────────────────────────────
    async function play() {
      await wait(280);
      if (cancelled) return;

      for (let i = 0; i < CARDS.length; i++) {
        const card = CARDS[i];
        tagEl.textContent  = card.tag;
        textEl.textContent = card.text;
        numEl.textContent  = card.num;

        await flipIn();
        if (cancelled) return;

        await wait(1300);
        if (cancelled) return;

        await flipOut();
        if (cancelled) return;

        await wait(55);
        if (cancelled) return;
      }

      // Wordmark reveal
      cardEl.style.display = "none";
      wmsEl.classList.add("rxl-on");

      await wait(130);
      if (cancelled) return;
      wmdEl.classList.add("rxl-on");

      await wait(480);
      if (cancelled) return;
      capEl.classList.add("rxl-on");
    }

    play();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <section className="rxl-section" ref={sectionRef} aria-label="Signal Tasks">

      {/* Corner chrome */}
      <div className="rxl-chrome rxl-chrome-tl">
        <span className="rxl-wm-badge">
          signal studio
          <span className="rxl-badge-dot" />
          <span className="rxl-sep">/</span>tasks
        </span>
      </div>
      <div className="rxl-chrome rxl-chrome-tr">
        <span className="rxl-pip" aria-hidden />
        queue · live
      </div>

      {/* Stage */}
      <div className="rxl-stage" aria-hidden>

        {/* Physical card */}
        <div className="rxl-card">
          <div className="rxl-card-inner">
            <div className="rxl-card-header">
              <span className="rxl-card-tag">WEDDING</span>
              <span className="rxl-card-num">01</span>
            </div>
            <div className="rxl-card-body">
              <span className="rxl-card-text">BREGMAN · EDIT R2</span>
            </div>
          </div>
        </div>

        {/* Wordmark — hidden until cards clear */}
        <div className="rxl-wm-stage">
          <span className="rxl-wm-text">tasks</span>
          <span className="rxl-wm-dot" />
        </div>

      </div>

      {/* Caption */}
      <p className="rxl-caption">every task. done.</p>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
/* ── Section ──────────────────────────────────── */
.rxl-section {
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
.rxl-section {
  --rxl-ink:       #111111;
  --rxl-stone-400: #b8b2a3;
  --rxl-stone-500: #8c887e;
  --rxl-indigo:    #4f46e5;
  --rxl-hairline:  rgba(17,17,17,0.05);
  --rxl-font:      var(--font-geist-sans,'Geist',system-ui,sans-serif);
  --rxl-mono:      var(--font-geist-mono,'Geist Mono',ui-monospace,monospace);
  --rxl-wm-size:   clamp(58px,10vw,108px);
}

/* ── Chrome ───────────────────────────────────── */
.rxl-chrome {
  position: absolute;
  font-family: var(--rxl-mono);
  font-size: 11px;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--rxl-stone-500);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.rxl-chrome-tl { top: 28px; left: 32px; }
.rxl-chrome-tr { top: 28px; right: 32px; }
.rxl-wm-badge {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--rxl-font);
  font-weight: 500;
  font-size: 14px;
  letter-spacing: -.025em;
  line-height: .95;
  color: var(--rxl-ink);
  text-transform: none;
}
.rxl-badge-dot {
  width: .16em; height: .16em;
  border-radius: 50%;
  background: var(--rxl-indigo);
  margin-left: .06em;
  align-self: flex-end;
  margin-bottom: .06em;
  flex: 0 0 auto;
}
.rxl-sep { color: var(--rxl-stone-500); margin: 0 .4em; font-weight: 300; }
.rxl-pip {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--rxl-indigo);
  display: inline-block;
  animation: rxl-pip-blink 1.6s cubic-bezier(.45,.05,.55,.95) infinite;
}
@keyframes rxl-pip-blink { 0%,100%{opacity:1} 50%{opacity:.35} }

/* ── Stage ────────────────────────────────────── */
.rxl-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: clamp(140px, 20vh, 200px);
}

/* ── Card ─────────────────────────────────────── */
.rxl-card {
  width: clamp(260px, 56vw, 400px);
  background: #ffffff;
  border: 1px solid rgba(17,17,17,0.09);
  box-shadow:
    0 4px 16px rgba(0,0,0,0.06),
    0 1px 3px  rgba(0,0,0,0.04);
  border-radius: 4px;
  opacity: 0;
}

/* Flip in — card rises from below */
.rxl-card.rxl-flip-in {
  animation: rxl-flip-in 340ms cubic-bezier(.16,1,.3,1) forwards;
}
/* Flip out — card lifts away upward */
.rxl-card.rxl-flip-out {
  animation: rxl-flip-out 260ms cubic-bezier(.7,0,.84,0) forwards;
}

@keyframes rxl-flip-in {
  from { transform: perspective(760px) rotateX(68deg); opacity: 0; }
  to   { transform: perspective(760px) rotateX(0deg);  opacity: 1; }
}
@keyframes rxl-flip-out {
  from { transform: perspective(760px) rotateX(0deg);   opacity: 1; }
  to   { transform: perspective(760px) rotateX(-68deg); opacity: 0; }
}

/* ── Card inner ───────────────────────────────── */
.rxl-card-inner {
  position: relative;
  padding: clamp(18px,3.2vh,30px) clamp(20px,3.6vw,30px);
}

/* Physical hinge line — spindle reference at card midpoint */
.rxl-card-inner::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 1px;
  background: var(--rxl-hairline);
  pointer-events: none;
}

/* ── Card header ──────────────────────────────── */
.rxl-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: clamp(14px,2.4vh,22px);
}

.rxl-card-tag {
  font-family: var(--rxl-mono);
  font-size: 9px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--rxl-indigo);
  background: rgba(79,70,229,.1);
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 500;
}

.rxl-card-num {
  font-family: var(--rxl-mono);
  font-size: 9px;
  letter-spacing: .08em;
  color: var(--rxl-stone-400);
}

/* ── Card body ────────────────────────────────── */
.rxl-card-body {
  display: flex;
  align-items: center;
}

.rxl-card-text {
  font-family: var(--rxl-mono);
  font-size: clamp(15px, 2.5vw, 20px);
  font-weight: 500;
  color: var(--rxl-ink);
  letter-spacing: .025em;
  line-height: 1.2;
}

/* ── Wordmark stage ───────────────────────────── */
.rxl-wm-stage {
  position: absolute;
  display: inline-flex;
  align-items: baseline;
  font-size: var(--rxl-wm-size);
  opacity: 0;
  transition: opacity .28s ease;
}
.rxl-wm-stage.rxl-on { opacity: 1; }

.rxl-wm-text {
  font-family: var(--rxl-font);
  font-size: 1em;
  font-weight: 500;
  letter-spacing: -.04em;
  color: var(--rxl-ink);
  line-height: .95;
}

/* Dot */
.rxl-wm-dot {
  width: .155em; height: .155em;
  border-radius: 50%;
  background: var(--rxl-indigo);
  margin-left: .045em;
  align-self: flex-end;
  margin-bottom: .075em;
  flex: 0 0 auto;
  opacity: 0;
}
.rxl-wm-dot.rxl-on {
  animation:
    rxl-dot-in    .44s cubic-bezier(.34,1.56,.64,1)    forwards,
    rxl-dot-pulse 2.6s ease-in-out               1.3s  infinite;
}
@keyframes rxl-dot-in {
  0%   { opacity: 0; transform: scale(.25); }
  100% { opacity: 1; transform: scale(1);   }
}
@keyframes rxl-dot-pulse {
  0%,30%,100% { transform: scale(1);    opacity: 1; }
  15%         { transform: scale(1.26); opacity: 1; }
  22%         { transform: scale(.92);  opacity: 1; }
}

/* ── Caption ──────────────────────────────────── */
.rxl-caption {
  font-family: var(--rxl-mono);
  font-size: 11px;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--rxl-stone-500);
  opacity: 0;
  margin-top: clamp(28px,5vh,48px);
}
.rxl-caption.rxl-on {
  animation: rxl-caption-in .65s cubic-bezier(.22,.7,.2,1) forwards;
}
@keyframes rxl-caption-in {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0);   }
}

/* ── Reduced motion ───────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .rxl-card             { display: none !important; }
  .rxl-wm-stage.rxl-on  { opacity: 1 !important; }
  .rxl-wm-dot.rxl-on    { opacity: 1 !important; animation: none !important; }
  .rxl-caption.rxl-on   { opacity: 1 !important; animation: none !important; }
  .rxl-pip              { animation: none !important; }
}

/* ── Responsive chrome ────────────────────────── */
@media (max-width: 600px) {
  .rxl-chrome-tl { top: 18px; left: 20px; }
  .rxl-chrome-tr { top: 18px; right: 20px; font-size: 10px; }
}
@media (max-width: 420px) {
  .rxl-chrome-tr { display: none; }
}
`;
