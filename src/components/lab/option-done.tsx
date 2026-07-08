/**
 * Direction T1 — "Done." (flagship; slug `done`, prefix `dn-`).
 *
 * The satisfaction of moving live work from open to done. Momentum you can feel.
 *
 * Shape follows the Signal Hero Playbook (analytics/the-brief-hero):
 *   OVERTURE  three plain lines, one at a time, in-hold-out. The third holds on
 *             its seed word "done".
 *   SEED      one clean indigo check strikes through the word "done" (a single
 *             confident stroke, drawn ease-rack). The board resolves out of it.
 *   BOARD     a real "Today" board settles: rows rise in, then two open items get
 *             COMPLETED in sequence — each tick draws itself, the line mutes — and
 *             the one live item ignites with the indigo pulse. You watch work get
 *             done, one satisfying stroke at a time.
 *   REST      the tasks· wordmark with the pulse gesture (the one allowed loop)
 *             and one honest tally line.
 *
 * Pure CSS, server-rendered, zero JS. The DEFAULT styles ARE the rest state, so
 * SSR / no-JS / reduced-motion all show the settled board. The overture layer
 * defaults to display:none. Intro plays only inside
 * `@media (prefers-reduced-motion: no-preference)`. Everything scoped `dn-`.
 *
 * NOTE: display type is sized in px/vw, never rem — the DS `rem` base is broken
 * in-app (circular --text-display), which collapses rem headlines to ~28px.
 *
 * Self-contained: only `next/link` for the CTA (repo lint requires it for
 * internal routes). One trailing <style>. Transform / opacity / clip-path /
 * stroke-dashoffset / color only.
 */

import Link from "next/link";

type Row = {
  item: string;
  meta: string;
  state: "now" | "next" | "done";
  chip?: string;
  /** completion order for the two done rows (drives the tick-draw stagger) */
  seq?: number;
};

const ROWS: Row[] = [
  { item: "Send the supplier the final count", meta: "waiting on you", state: "now", chip: "Due today" },
  { item: "Name an owner for the venue invoice", meta: "by noon", state: "next" },
  { item: "Book the tasting slot", meta: "this week", state: "next" },
  { item: "Floor plan approved", meta: "8:41", state: "done", seq: 0 },
  { item: "Deposit paid", meta: "9:02", state: "done", seq: 1 },
];

export function OptionDone() {
  return (
    <section className="dn">
      <div className="dn-wrap">
        {/* Overture — the spoken idea, before any interface. aria-hidden; the
            settled board carries the same meaning for AT / no-JS. display:none by
            default, shown only when motion is allowed. */}
        <div className="dn-overture" aria-hidden="true">
          <p className="dn-ov dn-ov-1">Everything&rsquo;s open.</p>
          <p className="dn-ov dn-ov-2">Nothing&rsquo;s moving.</p>
          <p className="dn-ov dn-ov-3">
            Until it gets{" "}
            <span className="dn-seed">
              done
              <svg className="dn-seed-check" viewBox="0 0 220 90" aria-hidden="true" preserveAspectRatio="none">
                <path
                  className="dn-seed-stroke"
                  d="M12 52 L74 80 L210 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
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
          className="dn-stage"
          role="img"
          aria-label="A Today board. One live task, send the supplier the final count, due today, waiting on you. Two next, name an owner for the venue invoice by noon, and book the tasting slot this week. Two done, floor plan approved at 8:41 and deposit paid at 9:02. Six moved today, two are done, one is live."
        >
          <p className="dn-eyebrow" aria-hidden>Signal Tasks</p>
          <h1 className="dn-h1">Open to&nbsp;done.</h1>

          <div className="dn-board">
            <div className="dn-board-head" aria-hidden>
              <span className="dn-board-title">Today</span>
              <span className="dn-board-count">6 moved · 2 done</span>
            </div>

            <ol className="dn-list">
              {ROWS.map((r, i) => (
                <li
                  key={r.item}
                  className={`dn-row dn-${r.state}`}
                  style={{ ["--i" as string]: i, ["--seq" as string]: r.seq ?? 0 }}
                >
                  <span className="dn-mark" aria-hidden>
                    <span className="dn-ring" />
                    <span className="dn-live" />
                    <svg viewBox="0 0 24 24" className="dn-tick">
                      <path
                        className="dn-tick-path"
                        d="M5 12.5l4.2 4.4L19 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="dn-item">{r.item}</span>
                  {r.state === "now" && r.chip ? (
                    <span className="dn-chip">{r.chip}</span>
                  ) : (
                    <span className="dn-meta">{r.meta}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="dn-ledger">
            <p className="dn-tally">
              Six things moved today. <span className="dn-num">Two</span> are done. One is live.
            </p>
            <span className="dn-wm" aria-hidden>
              <span className="dn-wm-word">tasks</span>
              <span className="dn-wm-dot" />
            </span>
          </div>

          <div className="dn-cta">
            <Link className="dn-cta-primary" href="/">See it live</Link>
            <Link className="dn-cta-secondary" href="/">Take the tour</Link>
          </div>
        </div>
      </div>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
.dn{
  --ink:#111;--soft:#3f3f46;--faint:#71717a;--faintest:#a1a1aa;
  --accent:#4f46e5;--accent-tint:rgba(79,70,229,.06);--accent-line:rgba(79,70,229,.18);
  --paper:#fff;--paper-soft:#fafafa;
  --hair:rgba(17,17,17,.10);--hair-soft:rgba(17,17,17,.06);
  --ease-rack:cubic-bezier(0.22,0.61,0.18,1);
  --ease-soft:cubic-bezier(0.16,1,0.3,1);
  --ease-draw:cubic-bezier(0.22,0.61,0.36,1);
  --ease-pencil:cubic-bezier(0.7,0,0.3,1);
  position:relative;min-height:92svh;display:flex;align-items:center;
  background:var(--paper);color:var(--ink);overflow:hidden;
  font-family:var(--font-geist-sans,system-ui,sans-serif);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility}
.dn *{box-sizing:border-box}
.dn-wrap{position:relative;width:min(880px,100%);margin:0 auto;
  padding:clamp(48px,8vh,96px) clamp(24px,5vw,40px);width:100%}

/* ── Overture ── the spoken idea. Default display:none; shown only in motion. ── */
.dn-overture{display:none}
.dn-ov{grid-column:1;grid-row:1;margin:0;max-width:16ch;text-align:center;text-wrap:balance;
  font-size:clamp(34px,7vw,66px);font-weight:600;line-height:1.0;letter-spacing:-.035em;color:var(--ink);opacity:0}
.dn-ov-3{color:var(--soft)}
.dn-seed{position:relative;display:inline-block;color:var(--ink);font-weight:660;white-space:nowrap}
/* one clean indigo check strikes across "done" */
.dn-seed-check{position:absolute;left:-8%;top:8%;width:116%;height:88%;
  color:var(--accent);overflow:visible;opacity:0;pointer-events:none}
.dn-seed-stroke{stroke-dasharray:320;stroke-dashoffset:320}

/* ── Masthead ── */
.dn-eyebrow{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin:0 0 18px}
.dn-h1{font-size:clamp(40px,7.2vw,76px);line-height:.94;letter-spacing:-.045em;font-weight:600;
  margin:0 0 clamp(32px,5vh,52px);color:var(--ink)}

/* ── The board card — a believable slice of the product ── */
.dn-board{border:1px solid var(--hair);border-radius:14px;background:var(--paper);
  box-shadow:0 1px 2px rgba(17,17,17,.04),0 12px 32px -18px rgba(17,17,17,.16);overflow:hidden}
.dn-board-head{display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;border-bottom:1px solid var(--hair-soft)}
.dn-board-title{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:var(--ink)}
.dn-board-count{font-family:var(--font-geist-mono,monospace);font-size:11px;letter-spacing:.04em;
  color:var(--faint);font-variant-numeric:tabular-nums}

.dn-list{list-style:none;margin:0;padding:0}
.dn-row{position:relative;display:grid;grid-template-columns:26px minmax(0,1fr) auto;
  align-items:center;column-gap:16px;padding:16px 20px;border-top:1px solid var(--hair-soft)}
.dn-row:first-child{border-top:none}

/* the mark: hollow ring (next) · filled indigo (now) · drawn tick (done). Stacked,
   one shown per state. */
.dn-mark{position:relative;width:22px;height:22px;display:grid;place-items:center}
.dn-ring{position:absolute;width:15px;height:15px;border-radius:50%;
  border:2px solid var(--faintest);opacity:0}
.dn-live{position:absolute;width:14px;height:14px;border-radius:50%;background:var(--accent);
  box-shadow:0 0 0 4px var(--accent-tint);opacity:0}
.dn-tick{position:absolute;width:22px;height:22px;color:var(--faint);opacity:0}
.dn-tick-path{stroke-dasharray:34;stroke-dashoffset:0}
.dn-next .dn-ring{opacity:1}
.dn-now .dn-live{opacity:1}
.dn-done .dn-tick{opacity:1}

.dn-item{font-size:clamp(15px,1.1vw,18px);font-weight:500;letter-spacing:-.011em;
  color:var(--ink);line-height:1.35}
.dn-meta{font-family:var(--font-geist-mono,monospace);font-size:11px;letter-spacing:.03em;
  color:var(--faint);white-space:nowrap;font-variant-numeric:tabular-nums;justify-self:end}

/* Now — the single live row: the earned indigo, a faint tint, a status chip. */
.dn-now{background:var(--accent-tint)}
.dn-now .dn-item{color:var(--ink);font-weight:560}
.dn-chip{justify-self:end;align-self:center;display:inline-flex;align-items:center;
  font-family:var(--font-geist-mono,monospace);font-size:10px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--accent);border:1px solid var(--accent-line);
  padding:3px 8px;border-radius:999px;white-space:nowrap}

/* Done — settled, checked, muted. */
.dn-done .dn-item{color:var(--faint)}

/* ── Ledger + wordmark ── */
.dn-ledger{display:flex;justify-content:space-between;align-items:flex-end;gap:16px 32px;
  margin-top:clamp(28px,4vh,40px);padding-top:20px;border-top:1px solid var(--ink)}
.dn-tally{margin:0;max-width:44ch;font-size:13px;line-height:1.5;color:var(--faint)}
.dn-num{color:var(--soft);font-variant-numeric:tabular-nums}
.dn-wm{display:inline-flex;align-items:flex-end;font-weight:600;letter-spacing:-.04em;
  font-size:clamp(22px,3vw,28px);color:var(--ink);line-height:1;flex-shrink:0}
.dn-wm-dot{width:.15em;height:.15em;border-radius:50%;background:var(--accent);
  margin-left:.05em;margin-bottom:.12em;align-self:flex-end}

.dn-cta{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;margin-top:clamp(24px,3.5vh,34px)}
.dn-cta-primary{display:inline-flex;align-items:center;padding:10px 18px;background:var(--ink);
  color:var(--paper);font-size:13px;font-weight:540;letter-spacing:.005em;text-decoration:none;
  border:1px solid var(--ink);border-radius:8px;transition:opacity .16s var(--ease-soft)}
.dn-cta-primary:hover{opacity:.86}
.dn-cta-secondary{display:inline-flex;align-items:center;padding:10px 16px;color:var(--soft);
  font-size:13px;text-decoration:none;border:1px solid var(--hair);border-radius:8px;
  transition:color .16s var(--ease-soft),border-color .16s var(--ease-soft)}
.dn-cta-secondary:hover{color:var(--ink);border-color:var(--faint)}

/* ── Narrow screens ── */
@media (max-width:640px){
  .dn-row{padding:14px 16px;column-gap:12px}
  .dn-chip{display:none}
  .dn-ledger{flex-direction:column;align-items:flex-start;gap:16px}
}

/* ── Intro motion — opt-in only. Everything above IS the rest state. ── */
@media (prefers-reduced-motion:no-preference){
  /* stage the overture over the board column */
  .dn-overture{display:grid;position:absolute;inset:0;z-index:5;place-items:center;
    padding:0 clamp(16px,6vw,64px);pointer-events:none}
  .dn-ov-1{animation:dn-ov-inout 2.4s var(--ease-soft) .25s both}
  .dn-ov-2{animation:dn-ov-inout 2.4s var(--ease-soft) 2.6s both}
  .dn-ov-3{animation:dn-ov-in 1s var(--ease-soft) 4.9s both, dn-ov-fade .5s var(--ease-soft) 6.15s both}
  /* the check strikes through "done" */
  .dn-seed-check{animation:dn-show .01s linear 5.55s both}
  .dn-seed-stroke{animation:dn-strike .66s var(--ease-rack) 5.6s both}

  /* the board reveals beat by beat after the hand-off */
  .dn-eyebrow{opacity:0;animation:dn-rise .55s var(--ease-soft) 6.3s both}
  .dn-h1{opacity:0;animation:dn-rise .7s var(--ease-rack) 6.42s both}
  .dn-board{opacity:0;transform:translateY(14px);animation:dn-card .7s var(--ease-rack) 6.62s both}
  .dn-row{opacity:0;animation:dn-row .5s var(--ease-rack) both;
    animation-delay:calc(7.05s + var(--i) * .1s)}

  /* the two open items get COMPLETED: each tick draws itself, the line mutes. */
  .dn-done .dn-tick-path{stroke-dashoffset:34;
    animation:dn-draw .5s var(--ease-pencil) both;
    animation-delay:calc(8.0s + var(--seq) * .34s)}
  .dn-done .dn-tick{color:var(--accent);
    animation:dn-tick-in .45s var(--ease-rack) both, dn-tick-settle .6s var(--ease-soft) both;
    animation-delay:calc(8.0s + var(--seq) * .34s), calc(8.45s + var(--seq) * .34s)}
  .dn-done .dn-item{color:var(--ink);
    animation:dn-mute .5s var(--ease-soft) both;animation-delay:calc(8.1s + var(--seq) * .34s)}

  /* the live item ignites last, then the pulse — the one allowed loop. */
  .dn-now .dn-live{opacity:0;transform:scale(0);
    animation:dn-ignite .5s var(--ease-pencil) 8.85s both, dn-pulse 2.6s ease-in-out 9.5s infinite}

  .dn-ledger{opacity:0;animation:dn-rise .6s var(--ease-soft) 9.0s both}
  .dn-cta{opacity:0;animation:dn-rise .6s var(--ease-soft) 9.2s both}
  .dn-wm-dot{transform:scale(0);animation:dn-pop .5s var(--ease-pencil) 9.3s both}
}
@keyframes dn-ov-inout{0%{opacity:0;transform:translateY(14px)}16%{opacity:1;transform:translateY(0)}
  74%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-10px)}}
@keyframes dn-ov-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes dn-ov-fade{from{opacity:1}to{opacity:0}}
@keyframes dn-show{from{opacity:0}to{opacity:1}}
@keyframes dn-strike{from{stroke-dashoffset:320}to{stroke-dashoffset:0}}
@keyframes dn-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes dn-card{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes dn-row{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes dn-draw{from{stroke-dashoffset:34}to{stroke-dashoffset:0}}
@keyframes dn-tick-in{from{opacity:0}to{opacity:1}}
@keyframes dn-tick-settle{from{color:var(--accent)}to{color:var(--faint)}}
@keyframes dn-mute{from{color:var(--ink)}to{color:var(--faint)}}
@keyframes dn-ignite{from{opacity:0;transform:scale(0)}60%{opacity:1;transform:scale(1.22)}to{opacity:1;transform:scale(1)}}
@keyframes dn-tint{from{background:transparent}to{background:var(--accent-tint)}}
@keyframes dn-pop{from{transform:scale(0)}60%{transform:scale(1.25)}to{transform:scale(1)}}
@keyframes dn-pulse{0%,30%,100%{transform:scale(1)}15%{transform:scale(1.22)}22%{transform:scale(.94)}}
`;
