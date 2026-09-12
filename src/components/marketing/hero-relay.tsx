"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The hero relay — three product cards and one line moving between them.
 *
 * A note is written. The one sentence the venue approves is carried out of
 * it and lands as a task with an owner. The date the owner confirms is
 * carried out of the task and goes live on the couple's timeline. Three
 * panes, two carries, one sequence, replayable. Ported from the founder's
 * pick of the 2 September 2026 front-door directions (A · Floor and sheet,
 * `remote-redesign/work/2026-09-02-landing-directions`), with the lane
 * vocabulary this product ships (To do → Moving) and the design-system
 * tokens instead of the direction's local ones.
 *
 * How it runs:
 *   · The server renders the END state (every pane in, 79 days, the task
 *     already Moving). No JavaScript, no crawler, no reduced-motion user
 *     ever sees an empty stage.
 *   · Before first paint the scene takes the stage back to its start and
 *     plays once when a fifth of it is in view, after the fonts are ready.
 *   · Under `prefers-reduced-motion: reduce` — at load or if it flips
 *     mid-scene — the stage jumps to the end state. The carries never
 *     render at all.
 *   · "Play again" appears when the sequence has finished. It is `hidden`
 *     until then so it is never a focus stop for an invisible control.
 *
 * SAFETY CONTRACT (loader canon §13): every class is prefixed `relay-`,
 * nothing is position:fixed, every timer and Web Animation is tracked and
 * cancelled on unmount, and reduced motion renders the settled state with
 * no delay.
 */

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const HOVER_QUERY = "(hover: hover)";
const DAYS_TO_GO = 79;
const LANE_START = "To do";
const LANE_END = "Moving";
const STATE_FLAGS = ["swept", "sent", "moving", "drawn", "live", "is-done"] as const;
/** Parallax depth per pane, in px, once the sequence has settled. */
const DEPTHS = [6, 10, 8] as const;

type Scene = {
  play(): void;
  finish(): void;
  reset(): void;
  dispose(): void;
};

function easeOutCubic(p: number) {
  return 1 - Math.pow(1 - p, 3);
}

function buildScene(stage: HTMLElement): Scene {
  const panes = Array.from(stage.querySelectorAll<HTMLElement>("[data-pane]"));
  const carries = Array.from(stage.querySelectorAll<HTMLElement>("[data-carry]"));
  const count = stage.querySelector<HTMLElement>("[data-count]");
  const lanes = Array.from(stage.querySelectorAll<HTMLElement>("[data-lane-state]"));
  const replay = stage.querySelector<HTMLButtonElement>("[data-replay]");
  const pane = (name: string) => panes.find((el) => el.dataset.pane === name) ?? null;
  const note = pane("note");
  const task = pane("task");
  const time = pane("time");
  const carryOut = carries.find((el) => el.dataset.carry === "note-to-task") ?? null;
  const carryOn = carries.find((el) => el.dataset.carry === "task-to-time") ?? null;

  let timers: number[] = [];
  let anims: Animation[] = [];
  let raf = 0;

  function clear() {
    timers.forEach((id) => window.clearTimeout(id));
    timers = [];
    anims.forEach((a) => {
      try {
        a.cancel();
      } catch {
        // an already-finished animation may refuse; nothing to do
      }
    });
    anims = [];
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function at(ms: number, fn: () => void) {
    timers.push(window.setTimeout(fn, ms));
  }

  function setLane(text: string) {
    lanes.forEach((el) => {
      el.textContent = text;
    });
  }

  function reset() {
    stage.classList.remove(...STATE_FLAGS);
    panes.forEach((p) => {
      p.classList.remove("in", "lit");
      p.style.transform = "";
    });
    carries.forEach((c) => {
      c.getAnimations().forEach((a) => a.cancel());
      c.style.opacity = "0";
    });
    if (count) count.textContent = "0";
    setLane(LANE_START);
    if (replay) replay.hidden = true;
  }

  function settle() {
    stage.classList.add("is-done");
    if (replay) replay.hidden = false;
  }

  function finish() {
    clear();
    reset();
    stage.classList.add(...STATE_FLAGS);
    panes.forEach((p) => p.classList.add("in"));
    if (count) count.textContent = String(DAYS_TO_GO);
    setLane(LANE_END);
    settle();
  }

  /** A line leaves one pane and travels to the next, then fades on landing. */
  function carry(el: HTMLElement | null, dx: number, dy: number) {
    if (!el) return;
    anims.push(
      el.animate(
        [
          { opacity: 0, transform: "translate(0,0) scale(.96)" },
          { opacity: 1, transform: `translate(${dx * 0.08}px,${dy * 0.02}px) scale(1)`, offset: 0.14 },
          { opacity: 1, transform: `translate(${dx * 0.6}px,${dy * 0.55}px) scale(1.02)`, offset: 0.6 },
          { opacity: 1, transform: `translate(${dx}px,${dy}px) scale(1)`, offset: 0.88 },
          { opacity: 0, transform: `translate(${dx}px,${dy + 6}px) scale(.98)` },
        ],
        { duration: 900, easing: EASE, fill: "forwards" },
      ),
    );
  }

  function countTo(startMs: number, duration: number) {
    at(startMs, () => {
      let t0: number | null = null;
      const step = (ts: number) => {
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / duration);
        if (count) count.textContent = String(Math.round(easeOutCubic(p) * DAYS_TO_GO));
        if (p < 1) raf = window.requestAnimationFrame(step);
      };
      raf = window.requestAnimationFrame(step);
    });
  }

  function play() {
    clear();
    reset();
    // 1 · the note arrives, and the approved sentence is swept
    at(150, () => note?.classList.add("in", "lit"));
    at(800, () => stage.classList.add("swept"));
    // 2 · the sentence leaves the note and lands as a task
    at(1500, () => {
      note?.classList.remove("lit");
      carry(carryOut, 64, 186);
    });
    at(2150, () => {
      task?.classList.add("in", "lit");
      stage.classList.add("sent");
    });
    // 3 · the task starts moving
    at(2900, () => {
      stage.classList.add("moving");
      setLane(LANE_END);
    });
    // 4 · a confirmed date leaves the task for the timeline
    at(3300, () => {
      task?.classList.remove("lit");
      carry(carryOn, -30, 200);
    });
    at(3950, () => time?.classList.add("in", "lit"));
    countTo(4100, 1300);
    at(4300, () => stage.classList.add("drawn"));
    at(5200, () => stage.classList.add("live"));
    at(5700, () => time?.classList.remove("lit"));
    at(6100, settle);
  }

  return { play, finish, reset, dispose: clear };
}

export function HeroRelay() {
  const stageRef = useRef<HTMLElement>(null);

  // Layout effect, not effect: the server-rendered end state must be taken
  // back to the start before the first paint, or the settled stage flashes
  // for a frame and then vanishes to be rebuilt. Everything in here is DOM
  // work; React state is not involved in the sequence at all.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const scene = buildScene(stage);
    const reduce = window.matchMedia(REDUCE_QUERY);
    const replay = stage.querySelector<HTMLButtonElement>("[data-replay]");
    const panes = Array.from(stage.querySelectorAll<HTMLElement>("[data-pane]"));
    let played = false;
    let observer: IntersectionObserver | null = null;

    const start = () => {
      if (played) return;
      played = true;
      if (reduce.matches) {
        scene.finish();
        return;
      }
      const ready: Promise<unknown> = document.fonts ? document.fonts.ready : Promise.resolve();
      ready.then(() => {
        if (!reduce.matches) scene.play();
      });
    };

    if (reduce.matches || !("IntersectionObserver" in window)) {
      played = true;
      scene.finish();
    } else {
      // Take the stage back to its start now, before paint; the sequence
      // itself waits until the stage is actually in view.
      scene.reset();
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            start();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(stage);
    }

    const onReduceChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      played = true;
      observer?.disconnect();
      scene.finish();
    };
    reduce.addEventListener("change", onReduceChange);

    const onReplay = () => (reduce.matches ? scene.finish() : scene.play());
    replay?.addEventListener("click", onReplay);

    // The three panes sit at three depths under the pointer, once settled.
    // Hover devices only; never under reduced motion.
    const hover = window.matchMedia(HOVER_QUERY);
    let frame = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      frame = 0;
      if (!stage.classList.contains("is-done")) return;
      panes.forEach((p, i) => {
        const depth = DEPTHS[i] ?? 0;
        p.style.transform = `translate(${-tx * depth}px, ${-ty * depth}px)`;
      });
    };
    const onMove = (event: MouseEvent) => {
      if (reduce.matches) return;
      const rect = stage.getBoundingClientRect();
      tx = (event.clientX - rect.left) / rect.width - 0.5;
      ty = (event.clientY - rect.top) / rect.height - 0.5;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    if (hover.matches) {
      stage.addEventListener("mousemove", onMove);
      stage.addEventListener("mouseleave", onLeave);
    }

    return () => {
      scene.dispose();
      observer?.disconnect();
      reduce.removeEventListener("change", onReduceChange);
      replay?.removeEventListener("click", onReplay);
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <figure
      ref={stageRef}
      id="demo"
      className="relay swept sent moving drawn live is-done scroll-mt-20"
      aria-label="A note becomes a task, then a live date on the couple's timeline."
    >
      <div className="relay-stage">
        {/* ── notes ── */}
        <div className="relay-pane in" data-pane="note">
          <div className="relay-head">
            <span className="relay-head-l">
              <span className="relay-wm">
                notes
                <i aria-hidden="true" />
              </span>
              <span className="relay-kicker">Private to you</span>
            </span>
            <span className="relay-kicker">Mara &amp; Finn</span>
          </div>
          <p className="relay-note">
            <span className="relay-glyph voice" aria-hidden="true" />
            <span>
              Ceremony 2pm in the orchard, drinks on the terrace if it stays
              dry.{" "}
              <span className="relay-approved">
                Confirm marquee sides with the hire company by Thursday.
              </span>
            </span>
          </p>
          <div className="relay-note-foot">
            <span className="relay-voice">
              <i aria-hidden="true" />
              Dictated at the gate · 35 minutes ago
            </span>
            <span className="relay-pill tint">In Tasks</span>
          </div>
        </div>

        <div className="relay-carry" data-carry="note-to-task" aria-hidden="true">
          <span className="relay-dot" />
          Confirm marquee sides with the hire company
        </div>

        {/* ── tasks ── */}
        <div className="relay-pane in" data-pane="task">
          <div className="relay-head">
            <span className="relay-head-l">
              <span className="relay-wm">
                tasks
                <i aria-hidden="true" />
              </span>
              <span className="relay-kicker">The Orchard, events</span>
            </span>
            <span className="relay-kicker" data-lane-state>
              {LANE_END}
            </span>
          </div>
          <div className="relay-task">
            <span className="relay-check" aria-hidden="true" />
            <p className="relay-title">Confirm marquee sides with the hire company</p>
            <p className="relay-desc">
              Mara &amp; Finn, Saturday. Terrace plan if dry, marquee if not.
            </p>
            <div className="relay-meta">
              <u>Mara &amp; Finn</u>
              <span>High</span>
              <span className="relay-comments">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h-1A2.5 2.5 0 0 1 4 13.5z" />
                </svg>
                1
              </span>
            </div>
            <span className="relay-pill soft relay-when">Thu</span>
          </div>
          <div className="relay-lane">
            <span className="relay-dot" aria-hidden="true" />
            <span data-lane-state>{LANE_END}</span>
            <span aria-hidden="true">·</span>
            <span className="relay-av" aria-hidden="true">
              OR
            </span>
            Orla
          </div>
        </div>

        <div className="relay-carry" data-carry="task-to-time" aria-hidden="true">
          <span className="relay-dot" />
          Sat 1 Aug · Menu tasting
        </div>

        {/* ── timeline ── */}
        <div className="relay-pane in" data-pane="time">
          <div className="relay-head">
            <span className="relay-head-l">
              <span className="relay-wm">
                timeline
                <i aria-hidden="true" />
              </span>
              <span className="relay-kicker">Mara &amp; Finn</span>
            </span>
            <span className="relay-kicker">One of three</span>
          </div>
          <div className="relay-time-row">
            <span className="relay-big">
              <span data-count>{DAYS_TO_GO}</span>
              <small>days</small>
            </span>
            <span className="relay-date">
              <b>Saturday 3 October 2026</b>
              <small>Wedding day · today is 16 July</small>
            </span>
          </div>
          <div className="relay-line" aria-hidden="true">
            <span className="ln" />
            <i className="today" style={{ left: "0%" }} />
            <i className="live" style={{ left: "21%" }} />
            <i style={{ left: "46%" }} />
            <i style={{ left: "71%" }} />
            <i style={{ left: "100%" }} />
            <b className="first" style={{ left: "0%" }}>
              Today<small>16 Jul</small>
            </b>
            <b className="lbl" style={{ left: "21%" }}>
              Menu tasting<small>1 Aug</small>
            </b>
            <b className="mid" style={{ left: "46%" }}>
              Dress fitting<small>22 Aug</small>
            </b>
            <b className="mid" style={{ left: "71%" }}>
              Guest numbers<small>5 Sep</small>
            </b>
            <b className="end" style={{ left: "100%" }}>
              Wedding day<small>3 Oct</small>
            </b>
          </div>
          <div className="relay-time-foot">
            <span>Reviewed by Orla before the link changed.</span>
            <span className="relay-live">
              <i aria-hidden="true" />
              Live
            </span>
          </div>
        </div>
      </div>

      <div className="relay-replay-row">
        <button type="button" className="relay-replay" data-replay hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.3-5.7" />
            <path d="M4 4v5h5" />
          </svg>
          Play again
        </button>
      </div>

      <style>{CSS}</style>
    </figure>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles, fully scoped to the relay- prefix. Every colour, radius, shadow,
// duration and curve is a design-system token; the only literals are the
// stage geometry and the two draw curves the direction was built on.
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
.relay {
  position: relative;
  width: 100%;
  max-width: 600px;
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  color: var(--ink);
  text-align: left;
}
@media (min-width: 1024px) { .relay { margin-left: auto; } }

.relay-stage { position: relative; height: 620px; }

/* ── panes ── */
.relay-pane {
  position: absolute;
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  padding: 16px 20px;
  opacity: 0;
  transform: translateY(14px) scale(.985);
  transition:
    opacity var(--motion-slow) var(--ease-out),
    transform 500ms var(--ease-out),
    box-shadow var(--motion-slow) var(--ease-out);
}
.relay-pane.in { opacity: 1; transform: none; }
.relay-pane.lit { box-shadow: var(--shadow-modal); }
.relay.is-done .relay-pane {
  transition: transform 600ms var(--ease-out), box-shadow var(--motion-slow) var(--ease-out);
}
.relay-pane[data-pane="note"] { top: 0; left: 0; right: 64px; }
.relay-pane[data-pane="task"] { top: 212px; left: 64px; right: 0; }
.relay-pane[data-pane="time"] { top: 406px; left: 0; right: 32px; container-type: inline-size; }

.relay-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.relay-head-l { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.relay-wm { display: inline-flex; align-items: baseline; font-weight: 600; font-size: 15px; letter-spacing: -.02em; color: var(--ink); }
.relay-wm i { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); margin-left: 2px; }
.relay-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
  font-weight: 500;
  color: var(--ink-faint);
  white-space: nowrap;
}

/* ── notes ── */
.relay-note {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.relay-glyph {
  position: relative;
  margin-top: 7px;
  width: 10px;
  height: 8px;
  border-top: 1.5px solid var(--ink-ghost);
  border-bottom: 1.5px solid var(--ink-ghost);
}
.relay-glyph::after { content: ""; position: absolute; left: 0; right: 3px; top: 2.5px; border-top: 1.5px solid var(--ink-ghost); }
.relay-glyph.voice::before { content: ""; position: absolute; right: -5px; top: -4px; width: 4px; height: 4px; border-radius: 50%; background: var(--ink); }
.relay-approved {
  background-image: linear-gradient(120deg, transparent 0 2%, var(--accent-soft) 2% 98%, transparent 98%);
  background-size: 0% .85em;
  background-position: 0 78%;
  background-repeat: no-repeat;
  transition: background-size 600ms var(--ease-out);
}
.relay.swept .relay-approved { background-size: 100% .85em; }
.relay-note-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--ink-faint);
}
.relay-voice { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.relay-voice i { position: relative; flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.relay-pane.in .relay-voice i::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1px solid var(--accent);
  animation: relay-ring 1.6s cubic-bezier(.16, 1, .3, 1) 3;
}
@keyframes relay-ring { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(3.2); opacity: 0; } }
.relay-note-foot .relay-pill {
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out);
}
.relay.sent .relay-note-foot .relay-pill { opacity: 1; transform: none; }

/* ── the line that travels ── */
.relay-carry {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-modal);
  padding: 6px 10px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--ink);
}
.relay-carry .relay-dot { background: var(--accent); }
.relay-carry[data-carry="note-to-task"] { left: 18px; top: 60px; }
.relay-carry[data-carry="task-to-time"] { right: 18px; top: 236px; }

/* ── tasks ── */
.relay-task {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 0 12px;
  padding-right: 44px;
}
.relay-check { width: 16px; height: 16px; margin-top: 1px; border-radius: 50%; border: 1.5px solid var(--ink-ghost); }
.relay-title { grid-column: 2; margin: 0; font-size: 14px; font-weight: 600; letter-spacing: -.01em; line-height: 1.35; color: var(--ink); }
.relay-desc { grid-column: 2; margin: 3px 0 0; font-size: 12px; line-height: 1.45; color: var(--ink-soft); }
.relay-meta { grid-column: 2; display: flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 11px; color: var(--ink-soft); }
.relay-meta u { text-decoration: underline; text-decoration-color: var(--ink-ghost); text-underline-offset: 3px; font-weight: 500; color: var(--ink); }
.relay-comments { display: inline-flex; align-items: center; gap: 4px; }
.relay-comments svg { width: 11px; height: 11px; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linejoin: round; }
.relay-when { position: absolute; right: 0; top: -2px; }
.relay-pill {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--hairline);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--ink);
}
.relay-pill.soft { background: var(--paper-deep); border-color: transparent; }
.relay-pill.tint { background: var(--accent-tint); border-color: transparent; color: var(--accent-hover); }
.relay-lane { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: var(--ink-soft); }
.relay-dot { display: inline-block; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--ink-faint); transition: background var(--motion-base) var(--ease-out); }
.relay.moving .relay-lane .relay-dot { background: var(--accent); }
.relay-av {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
  font-size: 7.5px;
  font-weight: 600;
  letter-spacing: .04em;
  margin-right: 2px;
}

/* ── timeline ── */
.relay-time-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
.relay-big {
  display: inline-flex;
  align-items: baseline;
  font-size: 58px;
  font-weight: 600;
  letter-spacing: -.05em;
  line-height: .9;
  font-variant-numeric: tabular-nums;
}
.relay-big small {
  margin-left: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.relay-date { text-align: right; }
.relay-date b { display: block; font-size: 15px; font-weight: 500; letter-spacing: -.01em; }
.relay-date small { display: block; margin-top: 2px; font-size: 11px; color: var(--ink-faint); }
.relay-line { position: relative; height: 44px; margin-top: 22px; }
.relay-line .ln {
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 1px;
  background: var(--ink-ghost);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 900ms cubic-bezier(.65, 0, .35, 1);
}
.relay.drawn .relay-line .ln { transform: scaleX(1); }
.relay-line i {
  position: absolute;
  top: -3.5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--paper);
  border: 1.5px solid var(--ink-ghost);
  transform: translateX(-50%) scale(0);
  transition:
    transform var(--motion-base) var(--ease-out),
    background var(--motion-base) var(--ease-out),
    border-color var(--motion-base) var(--ease-out);
}
.relay.drawn .relay-line i { transform: translateX(-50%) scale(1); }
.relay-line i.today { background: var(--ink); border-color: var(--ink); }
.relay.live .relay-line i.live { background: var(--accent); border-color: var(--accent); }
.relay-line b {
  position: absolute;
  top: 10px;
  width: max-content;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--ink-soft);
  white-space: nowrap;
  opacity: 0;
  transition: opacity var(--motion-slow) var(--ease-out);
}
.relay-line b small { display: block; margin-top: 2px; font-size: 10px; font-weight: 400; color: var(--ink-faint); }
.relay.drawn .relay-line b { opacity: 1; }
.relay-line b.first { transform: none; text-align: left; }
.relay-line b.end { transform: translateX(-100%); text-align: right; }
@container (max-width: 430px) {
  .relay-line b.mid, .relay-line b.first { display: none; }
}
.relay-time-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--ink-faint);
}
.relay-live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity var(--motion-base) var(--ease-out);
  color: var(--accent-hover);
  font-weight: 500;
  white-space: nowrap;
}
.relay-live i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
.relay.live .relay-live { opacity: 1; }

/* ── play again ── */
.relay-replay-row { display: flex; justify-content: flex-end; min-height: 50px; padding-top: 14px; }
.relay-replay {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px 0 10px;
  border-radius: var(--radius-pill);
  background: var(--paper);
  border: 1px solid var(--hairline);
  box-shadow: var(--shadow-float);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-soft);
  cursor: pointer;
  animation: relay-rise var(--motion-base) var(--ease-out) both;
  transition: color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.relay-replay:hover { color: var(--ink); border-color: var(--ink-faint); }
.relay-replay:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.relay-replay svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
@keyframes relay-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (pointer: coarse) { .relay-replay { min-height: 44px; padding: 0 16px 0 14px; } }

/* ── phone: the three cards stack, the carries stay home ── */
@media (max-width: 639px) {
  .relay { max-width: none; }
  .relay-stage { height: auto; display: flex; flex-direction: column; gap: 14px; }
  .relay-pane, .relay-pane[data-pane] { position: relative; top: auto; left: auto; right: auto; }
  .relay-carry { display: none; }
  .relay-big { font-size: 48px; }
}

/* ── reduced motion: the settled state, no delay ── */
@media (prefers-reduced-motion: reduce) {
  .relay-pane, .relay-approved, .relay-line .ln, .relay-line i, .relay-line b,
  .relay-live, .relay-note-foot .relay-pill, .relay-dot, .relay-replay { transition: none !important; }
  .relay-carry { display: none; }
  .relay-pane.in .relay-voice i::after, .relay-replay { animation: none; }
}
`;
