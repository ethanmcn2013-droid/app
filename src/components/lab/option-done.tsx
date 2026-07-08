/**
 * Direction T1 — "Done." (flagship; slug `done`, prefix `dn-`).
 *
 * The satisfaction of moving work from open to done. Momentum you can feel.
 *
 * Shape follows the Signal Hero Playbook (analytics/the-brief-hero):
 *   OVERTURE  three plain lines, one at a time, each in-hold-out. The third
 *             holds on its seed word "done".
 *   SEED      an indigo check draws through the word "done" (SVG stroke draw,
 *             ease-rack); the board resolves out of that check.
 *   BOARD     a real Now / Next / Done list sets beat by beat: a faint indigo
 *             sweep reads it top to bottom, the two finished lines settle muted
 *             with a drawn tick, the live Now line carries the only colour.
 *   REST      the tasks· wordmark with the pulse gesture (the one allowed loop)
 *             and an honest tally.
 *
 * Pure CSS, server-rendered, zero JS. The DEFAULT styles ARE the rest state, so
 * SSR / no-JS / reduced-motion all show the settled board. The overture layer
 * defaults to display:none. Intro plays only inside
 * `@media (prefers-reduced-motion: no-preference)`. Everything scoped `dn-`.
 *
 * Self-contained: only `next/link` for the CTA (repo lint requires it for
 * internal routes). One trailing <style>. Transform / opacity / clip-path /
 * stroke-dashoffset only.
 */

import Link from "next/link";

type Line = {
  lane: string;
  item: string;
  meta: string;
  state: "now" | "next" | "done";
  chip?: string;
};

const LINES: Line[] = [
  { lane: "Now", item: "Send the supplier the final count", meta: "waiting on you", state: "now", chip: "Due today" },
  { lane: "Next", item: "Name an owner for the venue invoice", meta: "by noon", state: "next" },
  { lane: "Next", item: "Book the tasting slot", meta: "this week", state: "next" },
  { lane: "Done", item: "Deposit paid", meta: "9:02", state: "done" },
  { lane: "Done", item: "Floor plan approved", meta: "8:41", state: "done" },
];

export function OptionDone() {
  return (
    <section className="dn">
      <div className="dn-wrap">
        {/* Overture — the idea, spoken before any interface. Decorative and
            aria-hidden; the settled board below carries the same message for
            assistive tech and no-JS. Defaults to display:none. */}
        <div className="dn-overture" aria-hidden="true">
          <p className="dn-ov-line dn-ov-1">Everything&rsquo;s open.</p>
          <p className="dn-ov-line dn-ov-2">Nothing&rsquo;s moving.</p>
          <p className="dn-ov-line dn-ov-3">
            Until it gets{" "}
            <span className="dn-seed">
              <span className="dn-seed-word">done</span>
              <svg className="dn-seed-check" viewBox="0 0 120 60" aria-hidden="true">
                <path
                  className="dn-seed-stroke"
                  d="M8 34 L34 52 L112 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            .
          </p>
        </div>

        {/* The settled artifact — a real work board. role=img + a full label so
            SSR / no-JS / reduced-motion read the finished result in a sentence. */}
        <div
          className="dn-board"
          role="img"
          aria-label="A work board. Now, send the supplier the final count, due today, waiting on you. Next, name an owner for the venue invoice by noon, and book the tasting slot this week. Done, deposit paid at 9:02, floor plan approved at 8:41. Six things moved today. Two are done. This is next."
        >
          <p className="dn-eyebrow" aria-hidden>
            Signal Tasks · momentum
          </p>
          <h1 className="dn-h1">Open to done.</h1>

          <div className="dn-folio" aria-hidden>
            <span className="dn-folio-name">Today</span>
            <span className="dn-folio-rule" />
            <span className="dn-folio-count">6 moved · 2 done</span>
          </div>

          <span className="dn-sweep" aria-hidden />

          <ol className="dn-list">
            {LINES.map((n, i) => (
              <li
                key={n.item}
                className={`dn-row dn-${n.state}`}
                style={{ ["--i" as string]: i }}
              >
                <span className="dn-lane">{n.lane}</span>
                <span className="dn-mark" aria-hidden>
                  {n.state === "done" ? (
                    <svg viewBox="0 0 24 24" className="dn-tick">
                      <path
                        className="dn-tick-path"
                        d="M5 12.5l4.2 4.2L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : n.state === "now" ? (
                    <span className="dn-live" />
                  ) : (
                    <span className="dn-dot" />
                  )}
                </span>
                <span className="dn-item">{n.item}</span>
                <span className="dn-meta">{n.meta}</span>
                {n.chip && <span className="dn-chip">{n.chip}</span>}
              </li>
            ))}
          </ol>

          <div className="dn-ledger">
            <p className="dn-tally">
              Six things moved today. <span className="dn-num">Two</span> are done. This is next.
            </p>
            <span className="dn-wm" aria-hidden>
              <span className="dn-wm-word">tasks</span>
              <span className="dn-wm-dot" />
            </span>
          </div>

          <div className="dn-cta">
            <Link className="dn-cta-primary" href="/">
              See it live
            </Link>
          </div>
        </div>
      </div>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
.dn{--ink:#111;--soft:#3f3f46;--faint:#71717a;--accent:#4f46e5;--paper:#fff;
  --hair:rgba(17,17,17,.12);--hair-soft:rgba(17,17,17,.07);
  --ease-rack:cubic-bezier(0.22,0.61,0.18,1);
  --ease-soft:cubic-bezier(0.16,1,0.3,1);
  --ease-draw:cubic-bezier(0.22,0.61,0.36,1);
  --ease-pencil:cubic-bezier(0.7,0,0.3,1);
  position:relative;min-height:92svh;display:flex;align-items:flex-start;
  background:var(--paper);color:var(--ink);overflow:hidden;
  font-family:var(--font-geist-sans,system-ui,sans-serif);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.dn *{box-sizing:border-box}
.dn-wrap{position:relative;max-width:720px;margin:0 auto;
  padding:clamp(64px,9vh,120px) 28px 80px;width:100%}

/* ── Overture ─ the spoken idea. Default display:none; shown only when motion
   is allowed. All three lines share one grid cell so nothing reflows. ── */
.dn-overture{display:none}
.dn-ov-line{grid-column:1;grid-row:1;margin:0;max-width:18ch;text-align:center;
  text-wrap:balance;font-size:clamp(30px,6vw,58px);font-weight:600;line-height:1.02;
  letter-spacing:-.035em;color:var(--ink)}
.dn-ov-3{color:var(--soft)}
.dn-seed{position:relative;display:inline-block;color:var(--ink);font-weight:660}
.dn-seed-word{position:relative;z-index:1}
/* the indigo check that draws through "done" */
.dn-seed-check{position:absolute;left:50%;top:52%;width:1.5em;height:.75em;
  transform:translate(-50%,-50%);color:var(--accent);overflow:visible;
  opacity:0;pointer-events:none}
.dn-seed-stroke{stroke-dasharray:170;stroke-dashoffset:170}

/* ── The settled board (the rest state = the default) ── */
.dn-eyebrow{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:0 0 20px}
.dn-h1{font-size:clamp(2.2rem,1rem+5.4vw,4.6rem);line-height:.96;letter-spacing:-.045em;
  font-weight:600;margin:0 0 40px;max-width:12ch}

.dn-folio{display:flex;align-items:center;gap:16px;margin-bottom:28px}
.dn-folio-name{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
.dn-folio-rule{flex:1;height:1px;background:var(--hair)}
.dn-folio-count{font-family:var(--font-geist-mono,monospace);font-size:11px;letter-spacing:.03em;
  color:var(--faint);font-variant-numeric:tabular-nums}

/* read sweep ─ one faint indigo line, top to bottom, once */
.dn-sweep{position:absolute;left:28px;right:28px;top:0;height:1px;
  background:var(--accent);opacity:0;z-index:3;pointer-events:none}

/* the list ── */
.dn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.dn-row{position:relative;display:grid;
  grid-template-columns:56px 30px minmax(0,1fr) auto;align-items:center;
  column-gap:16px;padding:15px 2px;border-top:1px solid var(--hair-soft)}
.dn-row:first-child{border-top:none}
.dn-lane{font-family:var(--font-geist-mono,monospace);font-size:10.5px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.dn-mark{display:grid;place-items:center;width:30px;height:30px}
.dn-dot{width:11px;height:11px;border-radius:50%;background:var(--paper);
  border:2px solid var(--faint)}
.dn-item{font-size:clamp(15px,.5rem+.7vw,19px);font-weight:500;letter-spacing:-.01em;
  color:var(--ink);line-height:1.3}
.dn-meta{font-family:var(--font-geist-mono,monospace);font-size:11px;letter-spacing:.03em;
  color:var(--faint);white-space:nowrap;font-variant-numeric:tabular-nums}

/* Now ─ the single live line, the earned indigo + a pulse */
.dn-now .dn-lane{color:var(--accent)}
.dn-live{position:relative;width:12px;height:12px;border-radius:50%;background:var(--accent);
  box-shadow:0 0 0 4px rgba(79,70,229,.16)}
.dn-now .dn-item{color:var(--ink)}
.dn-chip{grid-column:3 / 5;justify-self:start;margin-top:8px;display:inline-flex;align-items:center;
  font-family:var(--font-geist-mono,monospace);font-size:10px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--accent);background:rgba(79,70,229,.08);
  border:1px solid rgba(79,70,229,.22);padding:3px 9px;border-radius:999px}

/* Done ─ settled, checked, muted */
.dn-done .dn-lane{color:var(--faint)}
.dn-done .dn-item{color:var(--faint)}
.dn-tick{width:22px;height:22px;color:var(--faint)}
.dn-tick-path{stroke-dasharray:30;stroke-dashoffset:0}

/* ── Ledger + wordmark ── */
.dn-ledger{display:flex;justify-content:space-between;align-items:flex-end;gap:16px 32px;
  margin-top:40px;padding-top:22px;border-top:1px solid var(--ink)}
.dn-tally{margin:0;max-width:40ch;font-size:13px;line-height:1.45;color:var(--faint)}
.dn-num{color:var(--soft);font-variant-numeric:tabular-nums}
.dn-wm{display:inline-flex;align-items:flex-end;font-weight:600;letter-spacing:-.04em;
  font-size:clamp(20px,3vw,26px);color:var(--ink);line-height:1;flex-shrink:0}
.dn-wm-dot{width:.16em;height:.16em;border-radius:50%;background:var(--accent);
  margin-left:.06em;margin-bottom:.1em;align-self:flex-end}

.dn-cta{margin-top:32px}
.dn-cta-primary{display:inline-flex;align-items:center;padding:10px 18px;background:var(--ink);
  color:var(--paper);font-size:13px;font-weight:540;letter-spacing:.005em;text-decoration:none;
  border:1px solid var(--ink);border-radius:3px;transition:opacity 160ms var(--ease-soft)}
.dn-cta-primary:hover{opacity:.86}

/* ── Narrow screens ── */
@media (max-width:720px){
  .dn-h1{margin-bottom:32px}
  .dn-row{grid-template-columns:48px 26px minmax(0,1fr);row-gap:2px}
  .dn-meta{grid-column:2 / 4;justify-self:start;margin-top:2px}
  .dn-chip{grid-column:2 / 4}
  .dn-sweep{left:20px;right:20px}
  .dn-ledger{flex-direction:column;align-items:flex-start;gap:16px}
}

/* ── Intro motion ─ opt-in only. Everything above IS the rest state. ── */
@media (prefers-reduced-motion:no-preference){
  /* stage the overture on top of the board column */
  .dn-overture{display:grid;position:absolute;inset:0;z-index:4;place-items:center;
    padding:0 clamp(16px,6vw,64px);pointer-events:none}
  .dn-ov-line{opacity:0}
  .dn-ov-1{animation:dn-ov-inout 2.4s var(--ease-soft) .25s both}
  .dn-ov-2{animation:dn-ov-inout 2.4s var(--ease-soft) 2.8s both}
  .dn-ov-3{animation:dn-ov-in 1.1s var(--ease-soft) 5.4s both,
    dn-ov-out .5s var(--ease-soft) 7s both}
  /* the seed check draws through "done" just before the board takes over */
  .dn-seed-check{animation:dn-appear .01s linear 6s both}
  .dn-seed-stroke{animation:dn-draw .62s var(--ease-rack) 6.1s both}

  /* the board starts hidden and reveals beat by beat after the hand-off */
  .dn-eyebrow{opacity:0;animation:dn-rise .55s var(--ease-soft) 7s both}
  .dn-h1{opacity:0;animation:dn-rise .7s var(--ease-rack) 7.1s both}
  .dn-folio{opacity:0;animation:dn-rise .55s var(--ease-soft) 7.3s both}
  .dn-sweep{animation:dn-sweep 1s var(--ease-soft) 7.5s both}
  .dn-row{opacity:0;animation:dn-row .55s var(--ease-rack) both;
    animation-delay:calc(7.6s + var(--i) * .16s)}
  /* the done ticks draw in as their rows land */
  .dn-done .dn-tick-path{stroke-dashoffset:30;animation:dn-draw-tick .5s var(--ease-pencil) both;
    animation-delay:calc(7.9s + var(--i) * .16s)}
  /* the live pulse begins after the board settles ─ the one allowed loop */
  .dn-live{animation:dn-pulse 2.6s ease-in-out 8.9s infinite}
  .dn-ledger{opacity:0;animation:dn-rise .6s var(--ease-soft) 8.6s both}
  .dn-cta{opacity:0;animation:dn-rise .6s var(--ease-soft) 8.8s both}
  .dn-wm-dot{transform:scale(0);animation:dn-pop .5s var(--ease-pencil) 8.9s both}
}
@keyframes dn-ov-inout{
  0%{opacity:0;transform:translateY(12px)}
  16%{opacity:1;transform:translateY(0)}
  74%{opacity:1;transform:translateY(0)}
  100%{opacity:0;transform:translateY(-9px)}}
@keyframes dn-ov-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes dn-ov-out{from{opacity:1}to{opacity:0}}
@keyframes dn-appear{from{opacity:0}to{opacity:1}}
@keyframes dn-draw{from{stroke-dashoffset:170}to{stroke-dashoffset:0}}
@keyframes dn-draw-tick{from{stroke-dashoffset:30}to{stroke-dashoffset:0}}
@keyframes dn-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes dn-row{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dn-sweep{0%{top:0;opacity:0}12%{opacity:.85}88%{opacity:.85}100%{top:100%;opacity:0}}
@keyframes dn-pop{from{transform:scale(0)}60%{transform:scale(1.25)}to{transform:scale(1)}}
@keyframes dn-pulse{0%,30%,100%{transform:scale(1)}15%{transform:scale(1.22)}22%{transform:scale(.94)}}
`;
