"use client";

/**
 * Tasks hero ticker — departure-board animation.
 *
 * A single task cycles through a split-flap (scaleY squish) flip mechanic:
 * scrambles in character-by-character, struck with an indigo spring line,
 * simultaneous scramble-clear, then out. 4 tasks, then "tasks." assembles
 * via the same mechanic and holds for 20 s desktop / 6 s mobile before
 * looping. First load has no cold-start blank — task 0 is set statically,
 * sequence begins immediately at the strike.
 *
 * SAFETY CONTRACT (loader canon §13):
 *   · Fully scoped — every class and @keyframes prefixed `txr-`.
 *   · In-flow only — no position:fixed, no inset:0, no high z-index.
 *   · All setTimeout IDs collected; cancelled + cleared on unmount.
 *   · prefers-reduced-motion → final settled state rendered immediately,
 *     no animation, no delay.
 */

import { useEffect, useRef } from "react";

const TASKS = [
  { tag: "GUESTS",    text: "Send invites" },
  { tag: "LOGISTICS", text: "Venue visit"  },
  { tag: "CATERING",  text: "Cake tasting" },
  { tag: "MUSIC",     text: "Confirm band" },
] as const;

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ·-";

function rndG() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}
function rndLC() {
  return String.fromCharCode(97 + Math.floor(Math.random() * 26));
}

export function TasksHeroTicker() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = TASKS.length;
    const HOLD = window.innerWidth <= 768 ? 6000 : 20000;

    // ── DOM refs — all scoped within root ───────────────────────────────────
    const sectionEl  = root;
    const panelEl    = root.querySelector<HTMLElement>(".txr-panel")!;
    const ruleTopEl  = root.querySelector<HTMLElement>(".txr-rule-top")!;
    const ruleBotEl  = root.querySelector<HTMLElement>(".txr-rule-bot")!;
    const metaEl     = root.querySelector<HTMLElement>(".txr-meta")!;
    const metaTagEl  = root.querySelector<HTMLElement>(".txr-meta-tag")!;
    const metaDotsEl = root.querySelector<HTMLElement>(".txr-meta-dots")!;
    const flipTextEl = root.querySelector<HTMLElement>(".txr-flip-text")!;
    const strikeEl   = root.querySelector<HTMLElement>(".txr-strike")!;
    const wmEl       = root.querySelector<HTMLElement>(".txr-wm")!;
    const wmInnerEl  = root.querySelector<HTMLElement>(".txr-wm-inner")!;
    const wmdotEl    = root.querySelector<HTMLElement>(".txr-wmdot")!;
    const capEl      = root.querySelector<HTMLElement>(".txr-cap")!;

    if (
      !panelEl || !ruleTopEl || !ruleBotEl || !metaEl || !metaTagEl ||
      !metaDotsEl || !flipTextEl || !strikeEl || !wmEl || !wmInnerEl ||
      !wmdotEl || !capEl
    ) return;

    // ── Reduced motion: skip to final state immediately ─────────────────────
    if (reduced) {
      panelEl.style.display = "none";
      Array.from("tasks").forEach((ch) => {
        const s = document.createElement("span");
        s.className = "txr-wm-ch";
        s.style.cssText = "display:inline-block";
        s.textContent = ch;
        wmInnerEl.insertBefore(s, wmdotEl);
      });
      wmEl.classList.add("txr-vis");
      sectionEl.classList.add("txr-warm");
      wmdotEl.style.cssText = "opacity:1;transform:scale(1)";
      capEl.style.cssText = "opacity:1;transform:translateY(0)";
      return;
    }

    // ── Cancellation + timer tracking ───────────────────────────────────────
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const wait = (ms: number) =>
      new Promise<void>((ok) => {
        const id = setTimeout(() => { if (!cancelled) ok(); }, ms);
        timers.push(id);
      });

    // ── Progress dots — built once ──────────────────────────────────────────
    metaDotsEl.innerHTML = "";
    for (let d = 0; d < N; d++) {
      const dot = document.createElement("span");
      dot.className = "txr-meta-dot";
      metaDotsEl.appendChild(dot);
    }

    function setActiveDot(i: number) {
      metaDotsEl
        .querySelectorAll<HTMLElement>(".txr-meta-dot")
        .forEach((d, di) => d.classList.toggle("txr-act", di === i));
    }

    // ── Single character flip (scaleY squish, 3 cycles) ─────────────────────
    async function flipChar(
      span: HTMLElement,
      target: string,
      lowercase: boolean
    ) {
      span.style.opacity = "1";
      for (let i = 0; i < 3; i++) {
        span.style.transition = "transform 28ms ease-in";
        span.style.transform  = "scaleY(0.04)";
        await wait(30);
        if (cancelled) return;
        span.textContent = i < 2 ? (lowercase ? rndLC() : rndG()) : target;
        span.style.transition = "transform 38ms ease-out";
        span.style.transform  = "scaleY(1)";
        await wait(40);
        if (cancelled) return;
      }
    }

    // ── Build char spans inside .txr-flip-text ──────────────────────────────
    interface CharCell { span: HTMLElement; char: string; isSpace: boolean; }

    function buildChars(text: string): CharCell[] {
      strikeEl.classList.remove("txr-on");
      strikeEl.style.transition = "none";
      strikeEl.style.width = "0";
      flipTextEl.innerHTML = "";
      flipTextEl.appendChild(strikeEl);

      const cells: CharCell[] = [];
      Array.from(text).forEach((ch) => {
        if (ch === " ") {
          const sp = document.createElement("span");
          sp.className = "txr-sp";
          flipTextEl.insertBefore(sp, strikeEl);
          cells.push({ span: sp, char: " ", isSpace: true });
        } else {
          const s = document.createElement("span");
          s.className = "txr-ch";
          s.style.cssText = "display:inline-block;opacity:0";
          s.textContent = rndG();
          flipTextEl.insertBefore(s, strikeEl);
          cells.push({ span: s, char: ch, isSpace: false });
        }
      });
      return cells;
    }

    // ── Flip all chars in (L→R stagger) ────────────────────────────────────
    function flipIn(cells: CharCell[], stagger: number) {
      let idx = 0;
      const ps: Promise<void>[] = [];
      cells.forEach((c) => {
        if (!c.isSpace) {
          const d = idx++ * stagger;
          ps.push(
            wait(d).then(() => {
              if (!cancelled) return flipChar(c.span, c.char, false);
            })
          );
        }
      });
      return Promise.all(ps);
    }

    // ── Simultaneous scramble then staggered exit ───────────────────────────
    async function scrambleAndExit(cells: CharCell[]) {
      const active = cells.filter((c) => !c.isSpace);
      // All chars squish at once — board-clearing chaos
      active.forEach((c) => {
        c.span.style.transition = "transform 20ms ease-in";
        c.span.style.transform  = "scaleY(0.04)";
      });
      await wait(22);
      if (cancelled) return;
      active.forEach((c) => {
        c.span.textContent        = rndG();
        c.span.style.transition   = "transform 26ms ease-out";
        c.span.style.transform    = "scaleY(1)";
      });
      await wait(30);
      if (cancelled) return;
      // Staggered exit wave
      let idx = 0;
      const ps: Promise<void>[] = [];
      cells.forEach((c) => {
        if (!c.isSpace) {
          const d = idx++ * 9;
          ps.push(
            wait(d).then(() => {
              if (cancelled) return;
              c.span.style.transition = "transform 26ms ease-in";
              c.span.style.transform  = "scaleY(0.04)";
              return wait(28).then(() => {
                if (!cancelled) c.span.style.opacity = "0";
              });
            })
          );
        }
      });
      await Promise.all(ps);
    }

    // ── Show one task on the board ──────────────────────────────────────────
    async function showTask(task: (typeof TASKS)[number], i: number) {
      if (cancelled) return;
      const isFirst = i === 0;
      const isLast  = i === N - 1;

      metaTagEl.textContent = task.tag;
      setActiveDot(i);

      if (isFirst) {
        ruleTopEl.classList.add("txr-on");
        await wait(80);  if (cancelled) return;
        ruleBotEl.classList.add("txr-on");
        await wait(140); if (cancelled) return;
      }

      metaEl.style.transition = "opacity .18s ease";
      metaEl.style.opacity    = "1";
      await wait(60); if (cancelled) return;

      const cells = buildChars(task.text);
      await flipIn(cells, 17);
      if (cancelled) return;

      await wait(220); if (cancelled) return;

      // Strike — micro-spring easing makes line feel placed not just drawn
      strikeEl.classList.add("txr-on");
      await wait(520); if (cancelled) return;
      await wait(isLast ? 480 : 200); if (cancelled) return;

      metaEl.style.transition = "opacity .12s ease";
      metaEl.style.opacity    = "0";
      await scrambleAndExit(cells);
      if (cancelled) return;

      // 50ms visual breath between tasks
      if (!isLast) { await wait(50); if (cancelled) return; }
    }

    // ── Wordmark reveal (same flip mechanic, lowercase landing) ────────────
    async function revealWordmark() {
      if (cancelled) return;

      // Warm tint — background shifts from #fff → #fafaf8
      sectionEl.classList.add("txr-warm");

      ruleTopEl.style.transition = "opacity .3s ease";
      ruleTopEl.style.opacity    = "0";
      ruleBotEl.style.transition = "opacity .3s ease";
      ruleBotEl.style.opacity    = "0";
      await wait(320); if (cancelled) return;
      panelEl.style.display = "none";

      // Build letter spans
      while (wmInnerEl.firstChild !== wmdotEl) {
        wmInnerEl.removeChild(wmInnerEl.firstChild!);
      }
      const wmCells: Array<{ span: HTMLElement; char: string }> = [];
      Array.from("tasks").forEach((ch) => {
        const s = document.createElement("span");
        s.className    = "txr-wm-ch";
        s.style.cssText = "display:inline-block;opacity:0";
        s.textContent  = rndG();
        wmInnerEl.insertBefore(s, wmdotEl);
        wmCells.push({ span: s, char: ch });
      });

      wmEl.classList.add("txr-vis");
      await wait(30); if (cancelled) return;

      // 40ms stagger — larger letterforms read more deliberate at slower pace
      let idx = 0;
      const ps = wmCells.map(({ span, char }) => {
        const d = idx++ * 40;
        return wait(d).then(() => {
          if (!cancelled) return flipChar(span, char, true);
        });
      });
      await Promise.all(ps);
      if (cancelled) return;

      await wait(70); if (cancelled) return;
      wmdotEl.classList.add("txr-on");

      await wait(560); if (cancelled) return;
      capEl.classList.add("txr-on");
    }

    // ── Idle hold — keeps the wordmark state feeling alive ──────────────────
    const idleTimers: ReturnType<typeof setTimeout>[] = [];
    function clearIdleTimers() {
      idleTimers.forEach(clearTimeout);
      idleTimers.length = 0;
    }

    async function idleHold(ms: number) {
      clearIdleTimers();
      if (ms >= 12000) {
        // Deep dot pulse at halfway mark
        idleTimers.push(setTimeout(() => {
          if (cancelled) return;
          wmdotEl.style.animation = "txr-dot-deep .8s cubic-bezier(.34,1.56,.64,1)";
          idleTimers.push(setTimeout(() => {
            if (cancelled) return;
            // Explicitly hold opacity:1 — .txr-wmdot base has opacity:0
            wmdotEl.style.opacity   = "1";
            wmdotEl.style.animation = "txr-dot-pulse 2.6s ease-in-out infinite";
          }, 840));
        }, Math.floor(ms * 0.5)));

        // Caption breath at 65% mark — signals patient system, not stalled
        idleTimers.push(setTimeout(() => {
          if (cancelled) return;
          capEl.style.transition = "opacity 1.2s ease";
          capEl.style.opacity    = "0";
          idleTimers.push(setTimeout(() => {
            if (cancelled) return;
            capEl.style.transition = "opacity 1s ease";
            capEl.style.opacity    = "1";
          }, 2800));
        }, Math.floor(ms * 0.65)));
      }
      await wait(ms);
      clearIdleTimers();
    }

    // ── Reset ───────────────────────────────────────────────────────────────
    function reset() {
      clearIdleTimers();
      sectionEl.classList.remove("txr-warm");
      panelEl.style.cssText = "";

      ruleTopEl.classList.remove("txr-on"); ruleTopEl.style.cssText = "";
      ruleBotEl.classList.remove("txr-on"); ruleBotEl.style.cssText = "";
      metaEl.style.cssText = "opacity:0";
      setActiveDot(-1);

      strikeEl.classList.remove("txr-on"); strikeEl.style.cssText = "";
      flipTextEl.innerHTML = "";
      flipTextEl.appendChild(strikeEl);

      wmEl.classList.remove("txr-vis");
      while (wmInnerEl.firstChild !== wmdotEl) {
        wmInnerEl.removeChild(wmInnerEl.firstChild!);
      }
      wmdotEl.classList.remove("txr-on");
      wmdotEl.style.animation = "";
      wmdotEl.style.opacity   = "";

      capEl.classList.remove("txr-on");
      capEl.style.cssText = "";
    }

    // ── Main loop ───────────────────────────────────────────────────────────
    let firstPlay = true;

    async function play() {
      if (cancelled) return;

      if (firstPlay) {
        firstPlay = false;
        const task0 = TASKS[0];

        // Rules drawn immediately — no transition on first paint
        ruleTopEl.style.transform = "scaleX(1)";
        ruleBotEl.style.transform = "scaleX(1)";

        // Meta immediately visible
        metaTagEl.textContent   = task0.tag;
        setActiveDot(0);
        metaEl.style.opacity    = "1";

        // Task 0 text set without flip — chars fade in with L→R stagger
        // so the "already set" state feels deliberate, not a render snap
        const cells0 = buildChars(task0.text);
        let ci = 0;
        cells0.forEach((c) => {
          if (!c.isSpace) {
            c.span.textContent        = c.char;
            c.span.style.opacity      = "0";
            c.span.style.transition   = "opacity 80ms ease";
            const delay = ci++ * 6;
            const id = setTimeout(() => {
              if (!cancelled) c.span.style.opacity = "1";
            }, delay);
            timers.push(id);
          }
        });

        await wait(300); if (cancelled) return;
        strikeEl.classList.add("txr-on");
        await wait(520); if (cancelled) return;
        await wait(480); if (cancelled) return;

        metaEl.style.transition = "opacity .12s ease";
        metaEl.style.opacity    = "0";
        await scrambleAndExit(cells0);
        if (cancelled) return;

        // First visit resolves quickly into the product mark. Later loops can
        // show the full board cycle, but the first hero pass should not make
        // the page wait through every sample row before the identity rests.
      } else {
        // Loops 2+: brief pause then full flip sequence
        await wait(80); if (cancelled) return;
        for (let i = 0; i < N; i++) {
          await showTask(TASKS[i], i);
          if (cancelled) return;
        }
      }

      await revealWordmark();
      if (cancelled) return;
      await idleHold(HOLD);
      if (cancelled) return;

      reset();
      await wait(200); if (cancelled) return;
      play();
    }

    play();

    return () => {
      cancelled = true;
      clearIdleTimers();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="txr-section"
      aria-label="Tasks by Signal Studio"
    >
      {/* Animated well — board + wordmark, aria-hidden (decorative).
          TL wordmark badge removed: the site header already carries the
          signal studio / tasks breadcrumb. */}
      <div className="txr-well" aria-hidden="true">

        {/* Departure board */}
        <div className="txr-panel">
          <div className="txr-rule txr-rule-top" />
          <div className="txr-meta">
            <span className="txr-meta-tag" />
            <span className="txr-meta-dots" />
          </div>
          <div className="txr-text-wrap">
            <div className="txr-flip-text">
              <div className="txr-strike" />
            </div>
          </div>
          <div className="txr-rule txr-rule-bot" />
        </div>

        {/* Wordmark — hidden until board sequence completes */}
        <div className="txr-wm">
          <div className="txr-wm-panel">
            <div className="txr-wm-inner">
              {/* letter spans injected by JS */}
              <span className="txr-wmdot" />
            </div>
            <p className="txr-cap">your list. cleared.</p>
          </div>
        </div>

      </div>

      <style>{CSS}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — fully scoped to txr- prefix
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
/* Section */
.txr-section {
  position: relative;
  overflow: hidden;
  background: var(--bg, #fff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: clamp(500px, 60svh, 700px);
  padding: clamp(72px,10svh,112px) 24px clamp(44px,7svh,72px);
  border-bottom: 1px solid var(--txr-hl);
  transition: background .9s ease;
  --txr-pw: min(86vw, 720px);
  --txr-ink: #111;
  --txr-s4: #b8b2a3;
  --txr-s5: #8c887e;
  --txr-indigo: #4f46e5;
  --txr-hl: rgba(17,17,17,.07);
  --txr-sans: var(--font-geist-sans,'Geist',system-ui,sans-serif);
  --txr-mono: var(--font-geist-mono,'Geist Mono',ui-monospace,monospace);
}
/* Hero stays genuinely white — the warm tint shifted it off-white (#fafaf8)
   and broke white consistency across the suite heroes. Kept the class so the
   JS that toggles it is a harmless no-op. */
.txr-section.txr-warm { background: #ffffff; }

/* Well */
.txr-well {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  transform: translateY(-8px);
}

/* Board panel */
.txr-panel {
  display: flex;
  flex-direction: column;
  width: var(--txr-pw);
}

/* Hairline rules — draw L→R via scaleX */
.txr-rule {
  width: 100%;
  height: 1px;
  background: var(--txr-hl);
  transform: scaleX(0);
  transform-origin: left center;
}
.txr-rule.txr-on {
  transform: scaleX(1);
  transition: transform .32s cubic-bezier(.5,0,0,1);
}

/* Meta row: tag pill + progress dots */
.txr-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  opacity: 0;
}
.txr-meta-tag {
  font-family: var(--txr-mono);
  font-size: 9px;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--txr-indigo);
  background: rgba(79,70,229,.1);
  padding: 3px 10px;
  border-radius: 99px;
  font-weight: 500;
}
.txr-meta-dots { display: flex; gap: 7px; align-items: center; }
.txr-meta-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--txr-s4);
  transition: background .22s ease, transform .22s ease;
}
.txr-meta-dot.txr-act {
  background: var(--txr-indigo);
  transform: scale(1.3);
}

/* Text zone */
.txr-text-wrap { padding: 10px 0 16px; }

/* Flip display — overflow:hidden clips strike spring overshoot */
.txr-flip-text {
  font-family: var(--txr-mono);
  font-size: clamp(42px,9vw,92px);
  font-weight: 500;
  color: var(--txr-ink);
  letter-spacing: .015em;
  line-height: 1;
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  overflow: hidden;
}
.txr-ch { display: inline-block; line-height: 1; will-change: transform; }
.txr-sp { display: inline-block; width: .28em; }

/* Strike — micro-spring easing so line feels placed, not just drawn */
.txr-strike {
  position: absolute;
  left: 0; top: 50%;
  height: 3px; width: 0;
  background: var(--txr-indigo);
  transform: translateY(-50%);
  border-radius: 2px;
  pointer-events: none;
}
.txr-strike.txr-on {
  transition: width .52s cubic-bezier(.34,1.56,.64,1);
  width: 100%;
}

/* Wordmark — intrinsic-width panel, centered in viewport */
.txr-wm {
  display: none;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.txr-wm.txr-vis { display: flex; }
.txr-wm-panel {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
}
.txr-wm-inner {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--txr-sans);
  font-size: clamp(56px,10.8vw,118px);
  font-weight: 500;
  letter-spacing: -.04em;
  line-height: 1;
  color: var(--txr-ink);
}
.txr-wm-ch { display: inline-block; line-height: 1; will-change: transform; }

/* Dot — em units inherit from .txr-wm-inner */
.txr-wmdot {
  width: .155em; height: .155em;
  border-radius: 50%;
  background: var(--txr-indigo);
  margin-left: .05em;
  align-self: flex-end;
  margin-bottom: .09em;
  flex-shrink: 0;
  opacity: 0;
}
.txr-wmdot.txr-on {
  animation:
    txr-dot-in    .44s cubic-bezier(.34,1.56,.64,1) forwards,
    txr-dot-pulse  2.6s ease-in-out            1.3s  infinite;
}
@keyframes txr-dot-in {
  0%   { opacity: 0; transform: scale(.18); }
  100% { opacity: 1; transform: scale(1);   }
}
@keyframes txr-dot-pulse {
  0%,30%,100% { transform: scale(1);    }
  15%          { transform: scale(1.28); }
  22%          { transform: scale(.9);  }
}
@keyframes txr-dot-deep {
  0%   { transform: scale(1);    opacity: 1;  }
  28%  { transform: scale(1.62); opacity: .7; }
  56%  { transform: scale(.8);   opacity: .9; }
  100% { transform: scale(1);    opacity: 1;  }
}

/* Caption */
.txr-cap {
  font-family: var(--txr-mono);
  font-size: 11px;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: var(--txr-s5);
  margin-top: clamp(18px,3vh,28px);
  opacity: 0;
}
.txr-cap.txr-on {
  animation: txr-cap-in .65s cubic-bezier(.22,.7,.2,1) forwards;
}
@keyframes txr-cap-in {
  0%   { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0);   }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .txr-wmdot.txr-on  { animation: none !important; opacity: 1 !important; }
  .txr-cap.txr-on    { animation: none !important; opacity: 1 !important; }
}
@media (max-width: 760px) {
  .txr-section {
    min-height: 58svh;
    padding: 58px 20px 44px;
    --txr-pw: min(88vw, 520px);
  }
  .txr-well { transform: translateY(-4px); }
  .txr-flip-text { font-size: clamp(42px, 15vw, 76px); }
  .txr-wm-inner { font-size: clamp(54px, 15vw, 82px); }
}
`;
