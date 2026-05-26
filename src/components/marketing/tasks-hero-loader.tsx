"use client";

/**
 * Tasks hero loader — the product's identity moment.
 *
 * The dot rolls in left → right, assembling "tasks" as it passes each
 * letter. It lands, squishes on impact, then a strikethrough draws across
 * the word — done. A fresh "tasks" rises below, its dot entering a slow
 * continuous pulse: the queue is alive.
 *
 * SAFETY CONTRACT (post-2026-05-18 SEV-0 loader canon):
 *   · Fully scoped — every class and @keyframes is prefixed `txl-`.
 *   · In-flow only — no position:fixed, no inset:0, no high z-index.
 *   · rAF loop runs only during the roll then cancels itself.
 *   · prefers-reduced-motion → renders final settled state immediately.
 */

import { useEffect, useRef } from "react";

export function TasksHeroLoader() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const firstWordEl = root.querySelector<HTMLElement>(".txl-word-done");
    const dotEl = root.querySelector<HTMLElement>(".txl-dot");
    const composerDoneEl = root.querySelector<HTMLElement>(".txl-composer-done");

    if (!firstWordEl || !dotEl || !composerDoneEl) return;

    const letterEls = [...firstWordEl.querySelectorAll<HTMLElement>(".txl-letter")];

    if (reduced) {
      letterEls.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        el.style.color = "var(--txl-stone-400)";
      });
      root.classList.add("txl-settled");
      return;
    }

    const ROLL_MS = 2600;
    const RISE_MS = 280;
    const RISE_LEAD = 80;

    const start = performance.now();
    let risenAt: Array<number | null> = new Array(letterEls.length).fill(null);
    let centers: number[] = [];
    let raf = 0;

    const measure = () => {
      const cl = composerDoneEl.getBoundingClientRect().left;
      centers = letterEls.map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2 - cl;
      });
    };

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const frame = () => {
      const elapsed = performance.now() - start;
      if (elapsed > ROLL_MS) {
        letterEls.forEach((el) => {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        });
        return;
      }

      const cl = composerDoneEl.getBoundingClientRect().left;
      const dr = dotEl.getBoundingClientRect();
      const dotX = dr.left + dr.width / 2 - cl;
      const dotOpacity = parseFloat(getComputedStyle(dotEl).opacity);

      letterEls.forEach((el, i) => {
        const lx = centers[i];
        if (lx === undefined) return;
        if (risenAt[i] === null && dotOpacity > 0.2 && lx - dotX < RISE_LEAD) {
          risenAt[i] = elapsed;
        }
        if (risenAt[i] === null) {
          el.style.opacity = "0";
          el.style.transform = "translateY(115%)";
          return;
        }
        let p = Math.min(1, Math.max(0, (elapsed - risenAt[i]!) / RISE_MS));
        p = easeOutCubic(p);
        el.style.opacity = p.toString();
        el.style.transform = `translateY(${(1 - p) * 115}%)`;
      });

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(() => {
      measure();
      raf = requestAnimationFrame(frame);
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section className="txl-hero-section" aria-label="Signal Tasks">
      {/* Corner chrome */}
      <div className="txl-chrome txl-chrome-tl">
        <span className="txl-wm">
          signal studio<span className="txl-dot-static" />
          <span className="txl-sep">/</span>tasks
        </span>
      </div>
      <div className="txl-chrome txl-chrome-tr">
        <span className="txl-pip" aria-hidden />
        queue · live
      </div>

      {/* Stage */}
      <div className="txl-stage" ref={rootRef} aria-hidden>
        <div className="txl-composer-stack">
          {/* First wordmark: rolls in, gets struck through */}
          <div className="txl-composer txl-composer-done">
            <span className="txl-word txl-word-done">
              {"tasks".split("").map((ch, i) => (
                <span key={i} className="txl-letter">{ch}</span>
              ))}
            </span>
            <span className="txl-trail txl-t1" />
            <span className="txl-trail txl-t2" />
            <span className="txl-trail txl-t3" />
            <span className="txl-ripple-slow" />
            <span className="txl-ripple" />
            <span className="txl-dot" />
            <span className="txl-strike" />
          </div>

          {/* Fresh wordmark: the next task */}
          <div className="txl-composer txl-composer-fresh">
            <span className="txl-word txl-word-fresh">
              {"tasks".split("").map((ch, i) => (
                <span key={i} className="txl-letter-fresh">{ch}</span>
              ))}
            </span>
            <span className="txl-dot-fresh" />
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="txl-caption">the live queue</p>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
.txl-hero-section{
  position:relative;
  overflow:hidden;
  background:var(--bg, #ffffff);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  min-height:min(88vh,900px);
  padding:clamp(80px,12vh,160px) 24px clamp(64px,10vh,128px);
}

/* ─── CSS custom props ─────────────────────── */
.txl-hero-section{
  --txl-ink:#111111;
  --txl-stone-400:#b8b2a3;
  --txl-stone-500:#8c887e;
  --txl-indigo:#4f46e5;
  --txl-indigo-300:#a5b4fc;
  --txl-hairline:rgba(17,17,17,0.06);
  --txl-wm-size:clamp(56px,12vw,168px);
  --txl-roll:calc(var(--txl-wm-size) * 8);
  --txl-font:var(--font-geist-sans,'Geist',system-ui,sans-serif);
  --txl-mono:var(--font-geist-mono,'Geist Mono',ui-monospace,monospace);
}

/* ─── Chrome ───────────────────────────────── */
.txl-chrome{
  position:absolute;
  font-family:var(--txl-mono);
  font-size:11px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:var(--txl-stone-500);
  display:inline-flex;
  align-items:center;
  gap:10px;
}
.txl-chrome-tl{top:28px;left:32px;}
.txl-chrome-tr{top:28px;right:32px;}
.txl-wm{
  display:inline-flex;align-items:baseline;
  font-family:var(--txl-font);font-weight:500;
  font-size:14px;letter-spacing:-.025em;line-height:.95;
  color:var(--txl-ink);text-transform:none;
}
.txl-dot-static{
  width:.16em;height:.16em;border-radius:50%;
  background:var(--txl-indigo);margin-left:.06em;
  align-self:flex-end;margin-bottom:.06em;flex:0 0 auto;
}
.txl-sep{color:var(--txl-stone-500);margin:0 .4em;font-weight:300;}
.txl-pip{
  width:6px;height:6px;border-radius:50%;
  background:var(--txl-indigo);display:inline-block;
  animation:txl-pip-blink 1.6s cubic-bezier(.45,.05,.55,.95) infinite;
}
@keyframes txl-pip-blink{0%,100%{opacity:1}50%{opacity:.35}}

/* ─── Stage ────────────────────────────────── */
.txl-stage{
  display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  width:100%;
}
.txl-composer-stack{
  position:relative;
  display:flex;flex-direction:column;
  align-items:center;
  gap:0;
}
.txl-composer{
  position:relative;
  display:inline-flex;align-items:baseline;
  font-family:var(--txl-font);font-weight:500;
  font-size:var(--txl-wm-size);line-height:.95;
  letter-spacing:-.03em;color:var(--txl-ink);
  padding-bottom:calc(var(--txl-wm-size) * .25);
}
.txl-composer::before{
  content:'';position:absolute;
  left:calc(-1 * var(--txl-wm-size) * 3.2);
  right:calc(-1 * var(--txl-wm-size) * 1.2);
  bottom:calc(var(--txl-wm-size) * .15);
  height:1px;background:var(--txl-hairline);
}
.txl-word,.txl-word-done,.txl-word-fresh{
  display:inline-flex;gap:0;position:relative;z-index:1;
}
.txl-letter{
  display:inline-block;opacity:0;
  transform:translateY(115%);
  color:var(--txl-ink);will-change:opacity,transform;
}

/* ─── Roll dot (done) ──────────────────────── */
.txl-dot{
  position:relative;width:.16em;height:.16em;border-radius:50%;
  background:var(--txl-indigo);margin-left:.06em;align-self:flex-end;
  margin-bottom:.06em;transform-origin:center bottom;z-index:3;
  animation:
    txl-roll  2.6s cubic-bezier(.34,1.56,.64,1) 0s 1 forwards,
    txl-done  .5s  cubic-bezier(.22,.7,.2,1)    2.96s 1 forwards;
}
@keyframes txl-roll{
  0%  {transform:translate(calc(-1 * var(--txl-roll)),0) scale(1,1);opacity:0}
  8%  {transform:translate(calc(-1 * var(--txl-roll)),0) scale(1,1);opacity:1}
  63% {transform:translate(calc(-.03 * var(--txl-wm-size)),0) scale(1,1);opacity:1}
  67% {transform:translate(0,0) scale(1,1);opacity:1}
  73% {transform:translate(0,0) scale(1.55,.55);opacity:1}
  78% {transform:translate(0,0) scale(1.96,.4);opacity:1}
  82% {transform:translate(0,0) scale(1.88,.43);opacity:1}
  88% {transform:translate(0,calc(-.075 * var(--txl-wm-size))) scale(.74,1.34);opacity:1}
  93% {transform:translate(0,0) scale(1.24,.82);opacity:1}
  96% {transform:translate(0,0) scale(.96,1.05);opacity:1}
  100%{transform:translate(0,0) scale(1,1);opacity:1}
}
@keyframes txl-done{
  0%  {background:var(--txl-indigo);opacity:1}
  100%{background:var(--txl-stone-400);opacity:.85}
}

/* ─── Trails ───────────────────────────────── */
.txl-trail{
  position:absolute;width:.16em;height:.16em;border-radius:50%;
  background:var(--txl-indigo);align-self:flex-end;margin-bottom:.06em;
  margin-left:.06em;opacity:0;z-index:2;
}
.txl-t1{animation:txl-ghost1 2.6s cubic-bezier(.34,1.56,.64,1) 0s 1 forwards;}
.txl-t2{animation:txl-ghost2 2.6s cubic-bezier(.34,1.56,.64,1) 0s 1 forwards;}
.txl-t3{animation:txl-ghost3 2.6s cubic-bezier(.34,1.56,.64,1) 0s 1 forwards;}
@keyframes txl-ghost1{
  0%,10%{transform:translate(calc(-1 * var(--txl-roll)),0);opacity:0}
  27%{transform:translate(calc(-.85 * var(--txl-roll)),0);opacity:.5}
  50%{transform:translate(calc(-.2 * var(--txl-roll)),0);opacity:.26}
  63%,100%{transform:translate(calc(-.1 * var(--txl-roll)),0);opacity:0}
}
@keyframes txl-ghost2{
  0%,13%{transform:translate(calc(-1 * var(--txl-roll)),0);opacity:0}
  30%{transform:translate(calc(-.78 * var(--txl-roll)),0);opacity:.36}
  50%{transform:translate(calc(-.28 * var(--txl-roll)),0);opacity:.18}
  63%,100%{transform:translate(calc(-.16 * var(--txl-roll)),0);opacity:0}
}
@keyframes txl-ghost3{
  0%,17%{transform:translate(calc(-1 * var(--txl-roll)),0);opacity:0}
  34%{transform:translate(calc(-.7 * var(--txl-roll)),0);opacity:.24}
  50%{transform:translate(calc(-.35 * var(--txl-roll)),0);opacity:.11}
  63%,100%{transform:translate(calc(-.24 * var(--txl-roll)),0);opacity:0}
}

/* ─── Impact ripples ───────────────────────── */
.txl-ripple,.txl-ripple-slow{
  position:absolute;width:.16em;height:.16em;border-radius:50%;
  background:transparent;align-self:flex-end;margin-bottom:.06em;
  margin-left:.06em;opacity:0;transform:scale(1);z-index:1;
}
.txl-ripple{border:1px solid var(--txl-indigo);animation:txl-rip-fast 2.6s cubic-bezier(.22,.7,.2,1) 0s 1 forwards;}
.txl-ripple-slow{border:1px solid var(--txl-indigo-300);animation:txl-rip-slow 2.6s cubic-bezier(.22,.7,.2,1) 0s 1 forwards;}
@keyframes txl-rip-fast{0%,75%{transform:scale(1);opacity:0}78%{transform:scale(1);opacity:.7}100%{transform:scale(11);opacity:0}}
@keyframes txl-rip-slow{0%,75%{transform:scale(1);opacity:0}78%{transform:scale(1);opacity:.45}100%{transform:scale(22);opacity:0}}

/* ─── Strikethrough ────────────────────────── */
.txl-strike{
  position:absolute;left:0;top:50%;height:.07em;width:0;
  background:var(--txl-indigo);transform:translateY(-15%);
  pointer-events:none;z-index:2;
  animation:txl-strike-draw .36s cubic-bezier(.55,.06,.68,.19) 2.6s 1 forwards;
}
@keyframes txl-strike-draw{0%{width:0}100%{width:100%}}

/* done fade — letters + dot */
.txl-composer-done .txl-letter{
  animation:txl-letter-done .5s cubic-bezier(.22,.7,.2,1) 2.96s 1 forwards;
}
@keyframes txl-letter-done{
  0%  {color:var(--txl-ink);opacity:1}
  100%{color:var(--txl-stone-400);opacity:.85}
}

/* ─── Fresh wordmark ───────────────────────── */
.txl-composer-fresh{
  margin-top:calc(var(--txl-wm-size) * -.05);
  opacity:0;
  animation:txl-fresh-in .8s cubic-bezier(.22,.7,.2,1) 3.5s 1 forwards;
}
@keyframes txl-fresh-in{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}

.txl-letter-fresh{
  display:inline-block;opacity:0;transform:translateY(115%);
  animation:txl-fresh-letter .5s cubic-bezier(.22,.7,.2,1) forwards;
}
.txl-word-fresh .txl-letter-fresh:nth-child(1){animation-delay:3.6s}
.txl-word-fresh .txl-letter-fresh:nth-child(2){animation-delay:3.66s}
.txl-word-fresh .txl-letter-fresh:nth-child(3){animation-delay:3.72s}
.txl-word-fresh .txl-letter-fresh:nth-child(4){animation-delay:3.78s}
.txl-word-fresh .txl-letter-fresh:nth-child(5){animation-delay:3.84s}
@keyframes txl-fresh-letter{
  0%  {opacity:0;transform:translateY(115%)}
  100%{opacity:1;transform:translateY(0)}
}

.txl-dot-fresh{
  width:.16em;height:.16em;border-radius:50%;
  background:var(--txl-indigo);margin-left:.06em;align-self:flex-end;
  margin-bottom:.06em;transform-origin:center;opacity:0;
  animation:
    txl-dot-fresh-in  .4s  cubic-bezier(.22,.7,.2,1)    4s   1        forwards,
    txl-dot-pulse     2.6s cubic-bezier(.45,.05,.55,.95) 4.5s infinite;
}
@keyframes txl-dot-fresh-in{0%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}
@keyframes txl-dot-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.78);opacity:.62}}

/* ─── Caption ──────────────────────────────── */
.txl-caption{
  font-family:var(--txl-mono);
  font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--txl-stone-500);
  opacity:0;margin-top:48px;
  animation:txl-caption-in .7s cubic-bezier(.22,.7,.2,1) 4.4s 1 forwards;
}
@keyframes txl-caption-in{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}

/* ─── Reduced motion ───────────────────────── */
@media(prefers-reduced-motion:reduce){
  .txl-dot,.txl-trail,.txl-ripple,.txl-ripple-slow,
  .txl-strike,.txl-letter,.txl-composer-fresh,
  .txl-letter-fresh,.txl-dot-fresh,.txl-caption,
  .txl-pip{animation:none!important}
  .txl-dot{opacity:.85;transform:none;background:var(--txl-stone-400)}
  .txl-strike{width:100%}
  .txl-letter{opacity:.85;transform:none;color:var(--txl-stone-400)}
  .txl-trail,.txl-ripple,.txl-ripple-slow{display:none}
  .txl-composer-fresh{opacity:1;transform:none}
  .txl-letter-fresh{opacity:1;transform:none}
  .txl-dot-fresh{opacity:1;transform:scale(1)}
  .txl-caption{opacity:1}
}

/* ─── Responsive chrome ────────────────────── */
@media(max-width:600px){
  .txl-chrome-tl{top:18px;left:20px}
  .txl-chrome-tr{top:18px;right:20px;font-size:10px}
}
@media(max-width:420px){.txl-chrome-tr{display:none}}
`;
