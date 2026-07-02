"use client";

/**
 * Tasks hero ticker: Departure Board V2.
 *
 * Product proof is visible on first paint. The split-flap board arrives after
 * that proof and resolves into the Tasks wordmark. The final dot uses the
 * paired completion pulse only, with no decorative success layer.
 *
 * Safety contract:
 * - fully scoped: every class and keyframe uses the `txr-` prefix
 * - in-flow only: no fixed positioning and no global selectors
 * - all timers are cleared on unmount
 * - reduced motion: proof plus settled wordmark, no animation delay
 */

import { useEffect, useState, type CSSProperties } from "react";

const TASKS = [
  { tag: "OWNER", text: "Confirm venue access" },
  { tag: "WAITING", text: "Send guest count" },
  { tag: "READY", text: "Share supplier notes" },
  { tag: "DONE", text: "Close final checklist" },
] as const;

const PROOF_ROWS = [
  {
    task: "Confirm venue access",
    owner: "Venue",
    due: "Today",
    state: "Done",
  },
  {
    task: "Send guest count",
    owner: "Couple",
    due: "Thu",
    state: "Waiting",
  },
  {
    task: "Share supplier notes",
    owner: "Planner",
    due: "Next",
    state: "Ready",
  },
] as const;

type Stage = "proof" | "board" | "wordmark";

function wait(ms: number, timers: ReturnType<typeof setTimeout>[]) {
  return new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    timers.push(id);
  });
}

function splitText(text: string) {
  return Array.from(text);
}

export function TasksHeroTicker() {
  const [stage, setStage] = useState<Stage>("proof");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = window.innerWidth <= 768 ? 6000 : 20000;

    async function run() {
      if (reduced) {
        setStage("wordmark");
        setActiveIndex(TASKS.length - 1);
        return;
      }

      while (!cancelled) {
        setActiveIndex(0);
        setStage("proof");
        await wait(360, timers);
        if (cancelled) return;

        setStage("board");
        for (let i = 0; i < TASKS.length; i += 1) {
          setActiveIndex(i);
          await wait(i === TASKS.length - 1 ? 360 : 280, timers);
          if (cancelled) return;
        }

        setStage("wordmark");
        await wait(hold, timers);
      }
    }

    run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const task = TASKS[activeIndex];

  return (
    <section
      className={`txr-section txr-stage-${stage}`}
      aria-label="Signal Tasks proof and ticker"
    >
      <div className="txr-layout">
        <article className="txr-proof" aria-label="Task proof">
          <div className="txr-proof-head">
            <p>Signal Tasks</p>
            <h2>Today is already clear.</h2>
          </div>

          <div className="txr-proof-list">
            {PROOF_ROWS.map((row) => (
              <div className="txr-proof-row" key={row.task}>
                <p>{row.task}</p>
                <div className="txr-proof-meta">
                  <span>{row.owner}</span>
                  <span>{row.due}</span>
                  <span className="txr-state">{row.state}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="txr-payoff" aria-hidden="true">
          <div className="txr-board" key={`board-${activeIndex}`}>
            <div className="txr-rule" />
            <div className="txr-meta">
              <span>{task.tag}</span>
              <span className="txr-dots">
                {TASKS.map((item, index) => (
                  <span
                    className={index === activeIndex ? "txr-dot txr-dot-active" : "txr-dot"}
                    key={item.text}
                  />
                ))}
              </span>
            </div>
            <div className="txr-board-text" aria-label={task.text}>
              {splitText(task.text).map((char, index) =>
                char === " " ? (
                  <span className="txr-space" key={`${task.text}-${index}`} />
                ) : (
                  <span
                    className="txr-char"
                    data-char={char}
                    key={`${task.text}-${index}`}
                    style={{ "--txr-i": index } as CSSProperties}
                  >
                    {char}
                  </span>
                )
              )}
              <span className="txr-strike" />
            </div>
            <div className="txr-rule" />
          </div>

          <div className="txr-wordmark" key={`wordmark-${stage}`}>
            <div className="txr-wordmark-inner" aria-label="tasks">
              {"tasks".split("").map((char, index) => (
                <span
                  className="txr-word-char"
                  key={`${char}-${index}`}
                  style={{ "--txr-i": index } as CSSProperties}
                >
                  {char}
                </span>
              ))}
              <span className="txr-word-dot" />
            </div>
            <p>work accounted for.</p>
          </div>
        </div>
      </div>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
.txr-section {
  position: relative;
  overflow: hidden;
  background: #ffffff;
  min-height: min(88dvh, 880px);
  padding: 88px 24px 82px;
  display: flex;
  align-items: center;
  color: #111111;
  --txr-ink: #111111;
  --txr-ink-soft: #5f5c55;
  --txr-ink-muted: #8c887e;
  --txr-line: rgba(17, 17, 17, 0.08);
  --txr-panel: #fbfbfa;
  --txr-indigo: #4f46e5;
  --txr-indigo-soft: rgba(79, 70, 229, 0.1);
  --txr-sans: var(--font-geist-sans, 'Geist', system-ui, sans-serif);
  --txr-mono: var(--font-geist-mono, 'Geist Mono', ui-monospace, monospace);
}

.txr-layout {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(300px, 0.92fr) minmax(380px, 1.08fr);
  gap: 56px;
  align-items: center;
}

.txr-proof {
  border: 1px solid var(--txr-line);
  border-radius: 8px;
  background: var(--txr-panel);
  box-shadow: 0 28px 70px rgba(17, 17, 17, 0.08);
  padding: 24px;
}

.txr-proof-head {
  padding-bottom: 20px;
  border-bottom: 1px solid var(--txr-line);
}

.txr-proof-head p {
  margin: 0;
  font-family: var(--txr-mono);
  font-size: 12px;
  line-height: 1;
  color: var(--txr-indigo);
}

.txr-proof-head h2 {
  margin: 10px 0 0;
  font-family: var(--txr-sans);
  font-size: 34px;
  line-height: 1.08;
  font-weight: 570;
  letter-spacing: 0;
  color: var(--txr-ink);
}

.txr-proof-list {
  display: grid;
}

.txr-proof-row {
  display: grid;
  gap: 10px;
  padding: 18px 0;
  border-bottom: 1px solid var(--txr-line);
}

.txr-proof-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.txr-proof-row p {
  margin: 0;
  font-family: var(--txr-sans);
  font-size: 16px;
  line-height: 1.4;
  font-weight: 520;
  color: var(--txr-ink);
}

.txr-proof-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.txr-proof-meta span {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--txr-line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--txr-ink-soft);
  padding: 5px 9px;
  font-family: var(--txr-mono);
  font-size: 11px;
  line-height: 1;
}

.txr-proof-meta .txr-state {
  border-color: rgba(79, 70, 229, 0.2);
  background: var(--txr-indigo-soft);
  color: var(--txr-indigo);
}

.txr-payoff {
  position: relative;
  min-height: 286px;
  display: flex;
  align-items: center;
}

.txr-board,
.txr-wordmark {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: opacity 0.36s ease, transform 0.36s ease;
}

.txr-stage-board .txr-board,
.txr-stage-wordmark .txr-wordmark {
  opacity: 1;
  transform: translateY(0);
}

.txr-rule {
  width: 100%;
  height: 1px;
  background: var(--txr-line);
  transform: scaleX(0);
  transform-origin: left center;
}

.txr-stage-board .txr-rule {
  animation: txr-rule-in 0.32s cubic-bezier(0.5, 0, 0, 1) both;
}

.txr-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 0;
  font-family: var(--txr-mono);
  font-size: 11px;
  line-height: 1;
  color: var(--txr-indigo);
}

.txr-dots {
  display: inline-flex;
  gap: 7px;
  align-items: center;
}

.txr-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #b8b2a3;
  transform: scale(1);
}

.txr-dot-active {
  background: var(--txr-indigo);
  transform: scale(1.25);
}

.txr-board-text {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: max-content;
  max-width: 100%;
  overflow: hidden;
  padding: 14px 0 18px;
  font-family: var(--txr-mono);
  font-size: clamp(34px, 3.6vw, 52px);
  line-height: 1;
  font-weight: 520;
  color: var(--txr-ink);
}

.txr-char {
  display: inline-block;
  animation: txr-char-in 0.5s cubic-bezier(0.22, 0.7, 0.2, 1) both;
  animation-delay: calc(var(--txr-i) * 16ms);
  transform-origin: center;
  backface-visibility: hidden;
}

.txr-space {
  display: inline-block;
  width: 0.32em;
}

.txr-strike {
  position: absolute;
  left: 0;
  top: 50%;
  width: 0;
  height: 3px;
  border-radius: 999px;
  background: var(--txr-indigo);
  transform: translateY(-50%);
  animation: txr-strike-in 0.54s cubic-bezier(0.34, 1.56, 0.64, 1) 0.68s both;
}

.txr-wordmark {
  align-items: center;
  text-align: left;
}

.txr-wordmark-inner {
  display: inline-flex;
  align-items: baseline;
  font-family: var(--txr-sans);
  font-size: 128px;
  font-weight: 560;
  line-height: 0.94;
  letter-spacing: 0;
  color: var(--txr-ink);
}

.txr-word-char {
  display: inline-block;
  animation: txr-word-char-in 0.5s cubic-bezier(0.22, 0.7, 0.2, 1) both;
  animation-delay: calc(var(--txr-i) * 42ms);
  transform-origin: center;
}

.txr-word-dot {
  width: 0.155em;
  height: 0.155em;
  border-radius: 999px;
  background: var(--txr-indigo);
  margin-left: 0.055em;
  align-self: flex-end;
  margin-bottom: 0.09em;
  animation:
    txr-dot-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) 0.44s both,
    txr-dot-deep 0.72s cubic-bezier(0.34, 1.56, 0.64, 1) 1.08s 1 both,
    txr-dot-paired 3.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) 1.92s infinite;
}

.txr-wordmark p {
  margin: 22px 0 0;
  font-family: var(--txr-mono);
  font-size: 12px;
  line-height: 1;
  color: var(--txr-ink-muted);
}

@keyframes txr-rule-in {
  to {
    transform: scaleX(1);
  }
}

@keyframes txr-char-in {
  0% {
    opacity: 0;
    filter: blur(1.5px);
    transform: perspective(420px) rotateX(-82deg) scaleY(0.08);
  }
  34% {
    opacity: 1;
    filter: blur(0);
    transform: perspective(420px) rotateX(18deg) scaleY(1.18);
  }
  58% {
    transform: perspective(420px) rotateX(-7deg) scaleY(0.88);
  }
  100% {
    opacity: 1;
    filter: blur(0);
    transform: perspective(420px) rotateX(0) scaleY(1);
  }
}

@keyframes txr-strike-in {
  0% {
    width: 0;
  }
  100% {
    width: 100%;
  }
}

@keyframes txr-word-char-in {
  0% {
    opacity: 0;
    transform: scaleY(0.05);
  }
  45% {
    opacity: 1;
    transform: scaleY(1.14);
  }
  100% {
    opacity: 1;
    transform: scaleY(1);
  }
}

@keyframes txr-dot-in {
  0% {
    opacity: 0;
    transform: scale(0.18);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes txr-dot-deep {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  38% {
    opacity: 1;
    transform: scale(1.58);
  }
  64% {
    opacity: 1;
    transform: scale(0.86);
  }
}

@keyframes txr-dot-paired {
  0%,
  34%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  6% {
    transform: scale(1.3);
  }
  11% {
    transform: scale(0.92);
  }
  18% {
    transform: scale(1.2);
  }
  24% {
    transform: scale(0.96);
  }
}

@media (max-width: 980px) {
  .txr-section {
    min-height: auto;
    padding: 76px 20px 70px;
  }

  .txr-layout {
    grid-template-columns: 1fr;
    gap: 36px;
  }

  .txr-payoff {
    min-height: 236px;
  }

  .txr-board-text {
    font-size: 58px;
  }

  .txr-wordmark-inner {
    font-size: 104px;
  }
}

@media (max-width: 620px) {
  .txr-proof {
    padding: 18px;
  }

  .txr-proof-head h2 {
    font-size: 28px;
  }

  .txr-payoff {
    min-height: 198px;
  }

  .txr-board-text {
    font-size: 36px;
  }

  .txr-wordmark {
    align-items: flex-start;
  }

  .txr-wordmark-inner {
    font-size: 66px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .txr-board,
  .txr-wordmark,
  .txr-rule,
  .txr-char,
  .txr-strike,
  .txr-word-char,
  .txr-word-dot {
    animation: none !important;
    transition: none !important;
  }

  .txr-stage-wordmark .txr-wordmark {
    opacity: 1;
    transform: none;
  }

  .txr-word-char,
  .txr-word-dot {
    opacity: 1;
    transform: none;
  }
}
`;
