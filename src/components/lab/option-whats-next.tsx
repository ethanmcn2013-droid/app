/**
 * Direction T2 — "What's Next" (counterpoint; slug `whats-next`, prefix `wn-`).
 *
 * The real promise of Tasks: execution clarity for live work. From an all-open
 * pile, the app finds what actually matters today. This is the Signal
 * distillation (analytics/the-brief-hero) translated to Tasks: prioritisation,
 * not completion. Deliberately echoes Signal's noise field so Tasks reads as
 * family, but the artifact (a live action list, not a newspaper) and the
 * gesture (pulse, not tick) keep it its own product.
 *
 * Shape:
 *   OVERTURE  three plain lines, one at a time. The third holds on "next".
 *   SEED      a small pile of open task chips materialises out of the word
 *             "next".
 *   MECHANISM a faint indigo sweep reads the pile; the not-now chips dim and
 *             desaturate and collapse aside; the three that matter lift, gain an
 *             indigo marker, and promote into a clean prioritized Today list.
 *   REST      a focused Today list of the three live items, "set aside: 9 more"
 *             noted honestly, the tasks· wordmark with the pulse gesture.
 *
 * Pure CSS, server-rendered, zero JS. The DEFAULT styles ARE the rest state, so
 * SSR / no-JS / reduced-motion all show the settled Today list. The overture
 * layer and the pile default to display:none. Intro plays only inside
 * `@media (prefers-reduced-motion: no-preference)`. Everything scoped `wn-`.
 *
 * Self-contained: only `next/link` for the CTA (repo lint requires it for
 * internal routes). One trailing <style>. Transform / opacity / filter only.
 */

import Link from "next/link";

type Item = { item: string; action: string };

// The three that matter — the settled Today list.
const TODAY: Item[] = [
  { item: "Send the supplier the final count", action: "waiting on you" },
  { item: "Name an owner for the venue invoice", action: "by noon" },
  { item: "Book the tasting slot", action: "this week" },
];

// The pile (overture-only decoration): three live chips carry `live`, the rest
// are the noise that collapses aside. A stable column position per chip so the
// read sweep and clearing wave stagger cleanly.
type Chip = { text: string; live?: boolean };
const PILE: Chip[] = [
  { text: "Print seating cards" },
  { text: "Send the supplier the final count", live: true },
  { text: "Chase the coat-check quote" },
  { text: "Reorder the lighting list" },
  { text: "Name an owner for the venue invoice", live: true },
  { text: "Pick napkin colour" },
  { text: "Confirm the shuttle time" },
  { text: "Book the tasting slot", live: true },
  { text: "Return the linen swatch" },
  { text: "Draft the table numbers" },
  { text: "Extend the hotel block" },
  { text: "Order the thank-you cards" },
];

const COLS = 3;

export function OptionWhatsNext() {
  return (
    <section className="wn">
      <div className="wn-wrap">
        {/* Overture — the spoken idea + the pile it becomes. Decorative,
            aria-hidden, default display:none. The settled list below carries
            the meaning for assistive tech and no-JS. */}
        <div className="wn-overture" aria-hidden="true">
          <div className="wn-ov-words">
            <p className="wn-ov-line wn-ov-1">Twelve things are open.</p>
            <p className="wn-ov-line wn-ov-2">Three actually matter today.</p>
            <p className="wn-ov-line wn-ov-3">
              This is what&rsquo;s <span className="wn-seed">next</span>.
            </p>
          </div>

          <div className="wn-pile">
            {PILE.map((c, i) => (
              <span
                key={c.text + i}
                className={`wn-chip${c.live ? " wn-chip-live" : ""}`}
                style={{
                  ["--i" as string]: i,
                  ["--vy" as string]: Number((Math.floor(i / COLS) / 3).toFixed(3)),
                }}
              >
                {c.text}
              </span>
            ))}
          </div>
        </div>

        {/* The settled artifact — a focused Today list. role=img + a full label
            so SSR / no-JS / reduced-motion read the result in a sentence. */}
        <div
          className="wn-today"
          role="img"
          aria-label="A focused Today list. Send the supplier the final count, waiting on you. Name an owner for the venue invoice, by noon. Book the tasting slot, this week. Set aside: nine more. Nine could wait. These three couldn't."
        >
          <p className="wn-eyebrow" aria-hidden>
            Signal Tasks · what matters today
          </p>
          <h1 className="wn-h1">This is what&rsquo;s&nbsp;next.</h1>

          <div className="wn-folio" aria-hidden>
            <span className="wn-folio-name">Today</span>
            <span className="wn-folio-rule" />
            <span className="wn-folio-count">3 of 12</span>
          </div>

          <ol className="wn-list">
            {TODAY.map((t, i) => (
              <li key={t.item} className="wn-row" style={{ ["--i" as string]: i }}>
                <span className="wn-mark" aria-hidden>
                  <span className="wn-marker" />
                </span>
                <span className="wn-item">{t.item}</span>
                <span className="wn-action">{t.action}</span>
              </li>
            ))}
          </ol>

          <p className="wn-aside">
            <span className="wn-aside-label">Set aside</span>
            <span className="wn-aside-dash" aria-hidden />
            <span className="wn-aside-item">Nine more, none of them today</span>
          </p>

          <div className="wn-ledger">
            <p className="wn-tally">
              <span className="wn-num">Nine</span> could wait. These{" "}
              <span className="wn-three">three</span> couldn&rsquo;t.
            </p>
            <span className="wn-wm" aria-hidden>
              <span className="wn-wm-word">tasks</span>
              <span className="wn-wm-dot" />
            </span>
          </div>

          <div className="wn-cta">
            <Link className="wn-cta-primary" href="/">
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
.wn{--ink:var(--zinc-950);--soft:var(--zinc-700);--faint:var(--zinc-500);--accent:var(--indigo-600);--paper:var(--ink-0);
  --hair:rgba(17,17,17,.12);--hair-soft:rgba(17,17,17,.07);
  --ease-rack:var(--ease-out);
  --ease-soft:var(--ease-out);
  --ease-draw:var(--ease-out);
  --ease-pencil:var(--ease-in-out);
  position:relative;min-height:92svh;display:flex;align-items:flex-start;
  background:var(--paper);color:var(--ink);overflow:hidden;
  font-family:var(--font-geist-sans,system-ui,sans-serif);
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.wn *{box-sizing:border-box}
.wn-wrap{position:relative;max-width:720px;margin:0 auto;
  padding:clamp(64px,9vh,120px) 28px 80px;width:100%}

/* ── Overture ─ spoken idea + the pile. Default display:none. ── */
.wn-overture{display:none}
.wn-ov-words{display:grid;place-items:center}
.wn-ov-line{grid-column:1;grid-row:1;margin:0;max-width:20ch;text-align:center;
  text-wrap:balance;font-size:clamp(28px,5.4vw,52px);font-weight:600;line-height:1.04;
  letter-spacing:-.035em;color:var(--ink)}
.wn-ov-3{color:var(--soft)}
.wn-seed{color:var(--ink);font-weight:660}

/* the pile ─ Signal's noise field, smaller. Task chips, three secretly live. */
.wn-pile{position:absolute;left:0;right:0;top:0;bottom:0;
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-content:center;
  gap:10px 12px;pointer-events:none}
.wn-chip{font-size:12px;line-height:1.3;letter-spacing:.004em;color:var(--faint);
  padding:8px 10px;border:1px solid var(--hair-soft);border-radius:4px;
  background:var(--paper);opacity:0}
.wn-chip-live{color:var(--soft);border-color:var(--hair)}

/* ── The settled Today list (rest state = the default) ── */
.wn-eyebrow{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:0 0 20px}
.wn-h1{font-size:clamp(2.2rem,1rem+5.4vw,4.6rem);line-height:.96;letter-spacing:-.045em;
  font-weight:600;margin:0 0 40px;max-width:12ch}

.wn-folio{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.wn-folio-name{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
.wn-folio-rule{flex:1;height:1px;background:var(--hair)}
.wn-folio-count{font-family:var(--font-geist-mono,monospace);font-size:11px;letter-spacing:.03em;
  color:var(--faint);font-variant-numeric:tabular-nums}

.wn-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.wn-row{position:relative;display:grid;grid-template-columns:30px minmax(0,1fr) auto;
  align-items:center;column-gap:16px;padding:16px 2px;border-top:1px solid var(--hair-soft)}
.wn-row:first-child{border-top:none}
.wn-mark{display:grid;place-items:center;width:30px;height:30px}
.wn-marker{width:8px;height:8px;border-radius:50%;background:var(--accent);
  box-shadow:0 0 0 4px rgba(79,70,229,.14)}
.wn-item{font-size:clamp(15px,.5rem+.7vw,19px);font-weight:500;letter-spacing:-.01em;
  color:var(--ink);line-height:1.3}
.wn-action{font-family:var(--font-geist-mono,monospace);font-size:11px;letter-spacing:.03em;
  color:var(--faint);white-space:nowrap}

.wn-aside{display:flex;align-items:center;gap:14px;margin:24px 0 0;padding-top:20px;
  border-top:1px solid var(--hair-soft)}
.wn-aside-label{font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.wn-aside-dash{width:16px;height:2px;border-radius:2px;background:var(--faint);flex-shrink:0}
.wn-aside-item{font-size:14px;color:var(--faint)}

.wn-ledger{display:flex;justify-content:space-between;align-items:flex-end;gap:16px 32px;
  margin-top:36px;padding-top:22px;border-top:1px solid var(--ink)}
.wn-tally{margin:0;max-width:40ch;font-size:13px;line-height:1.45;color:var(--faint)}
.wn-num{color:var(--soft);font-variant-numeric:tabular-nums}
.wn-three{color:var(--soft);font-weight:500}
.wn-wm{display:inline-flex;align-items:flex-end;font-weight:600;letter-spacing:-.04em;
  font-size:clamp(20px,3vw,26px);color:var(--ink);line-height:1;flex-shrink:0}
.wn-wm-dot{width:.16em;height:.16em;border-radius:50%;background:var(--accent);
  margin-left:.06em;margin-bottom:.1em;align-self:flex-end}

.wn-cta{margin-top:32px}
.wn-cta-primary{display:inline-flex;align-items:center;padding:10px 18px;background:var(--ink);
  color:var(--paper);font-size:13px;font-weight:540;letter-spacing:.005em;text-decoration:none;
  border:1px solid var(--ink);border-radius:3px;transition:opacity 160ms var(--ease-soft)}
.wn-cta-primary:hover{opacity:.86}

/* ── Narrow screens ── */
@media (max-width:720px){
  .wn-h1{margin-bottom:32px}
  .wn-row{grid-template-columns:26px minmax(0,1fr);row-gap:2px}
  .wn-action{grid-column:2;justify-self:start;margin-top:2px}
  .wn-pile{grid-template-columns:repeat(2,minmax(0,1fr))}
  .wn-ledger{flex-direction:column;align-items:flex-start;gap:16px}
}

/* ── Intro motion ─ opt-in only. Everything above IS the rest state. ── */
@media (prefers-reduced-motion:no-preference){
  .wn-overture{display:block;position:absolute;inset:0;z-index:4;pointer-events:none}
  .wn-ov-words{position:absolute;inset:0;place-items:center;padding:0 clamp(16px,6vw,64px)}
  .wn-ov-line{opacity:0}
  .wn-ov-1{animation:wn-ov-inout 2.4s var(--ease-soft) .25s both}
  .wn-ov-2{animation:wn-ov-inout 2.4s var(--ease-soft) 2.8s both}
  /* line 3 sets and holds; the seed blooms and the pile emerges out of it */
  .wn-ov-3{animation:wn-ov-in 1.1s var(--ease-soft) 5.4s both,
    wn-ov-out .5s var(--ease-soft) 7.2s both}
  .wn-seed{display:inline-block;transform-origin:center;
    animation:wn-seed 1s var(--ease-rack) 6.8s both}

  /* the pile materialises out of the seed, then the sweep reads it */
  .wn-pile{opacity:0;animation:wn-appear .01s linear 6.9s both}
  .wn-chip{animation:wn-chip-in .5s var(--ease-rack) both;
    animation-delay:calc(7s + var(--vy) * .3s)}
  /* the not-now chips dim, desaturate, and collapse aside */
  .wn-chip:not(.wn-chip-live){
    animation:wn-chip-in .5s var(--ease-rack) calc(7s + var(--vy) * .3s) both,
      wn-clear .55s var(--ease-rack) calc(8.2s + var(--vy) * .28s) both}
  /* the three that matter lift, then hand off to the list */
  .wn-chip-live{
    animation:wn-chip-in .5s var(--ease-rack) calc(7s + var(--vy) * .3s) both,
      wn-lift .5s var(--ease-rack) 8.4s both,
      wn-ov-out .4s var(--ease-soft) 9s both}

  /* the settled list reveals beat by beat after the hand-off */
  .wn-eyebrow{opacity:0;animation:wn-rise .55s var(--ease-soft) 9s both}
  .wn-h1{opacity:0;animation:wn-rise .7s var(--ease-rack) 9.1s both}
  .wn-folio{opacity:0;animation:wn-rise .55s var(--ease-soft) 9.3s both}
  .wn-row{opacity:0;animation:wn-row .55s var(--ease-rack) both;
    animation-delay:calc(9.4s + var(--i) * .16s)}
  .wn-marker{transform:scale(0);animation:wn-pop .5s var(--ease-pencil) both;
    animation-delay:calc(9.55s + var(--i) * .16s)}
  .wn-aside{opacity:0;animation:wn-rise .55s var(--ease-soft) 10s both}
  .wn-ledger{opacity:0;animation:wn-rise .6s var(--ease-soft) 10.2s both}
  .wn-cta{opacity:0;animation:wn-rise .6s var(--ease-soft) 10.4s both}
  /* the pulse begins after the list settles ─ the one allowed loop */
  .wn-wm-dot{transform:scale(0);animation:wn-pop .5s var(--ease-pencil) 10.5s both,
    wn-pulse 2.6s ease-in-out 11s infinite}
}
@keyframes wn-ov-inout{
  0%{opacity:0;transform:translateY(12px)}
  16%{opacity:1;transform:translateY(0)}
  74%{opacity:1;transform:translateY(0)}
  100%{opacity:0;transform:translateY(-9px)}}
@keyframes wn-ov-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes wn-ov-out{from{opacity:1}to{opacity:0}}
@keyframes wn-seed{0%{opacity:1;transform:scale(1);filter:blur(0)}
  100%{opacity:0;transform:scale(1.7);filter:blur(1.5px)}}
@keyframes wn-appear{from{opacity:0}to{opacity:1}}
@keyframes wn-chip-in{from{opacity:0;transform:translateY(8px) scale(.96)}
  to{opacity:1;transform:none}}
@keyframes wn-clear{from{opacity:1;filter:grayscale(0);transform:none}
  to{opacity:0;filter:grayscale(1);transform:translateY(10px) scale(.6)}}
@keyframes wn-lift{from{transform:none;box-shadow:0 0 0 rgba(17,17,17,0)}
  to{transform:scale(1.03);box-shadow:0 1px 3px rgba(17,17,17,.1)}}
@keyframes wn-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes wn-row{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes wn-pop{from{transform:scale(0)}60%{transform:scale(1.25)}to{transform:scale(1)}}
@keyframes wn-pulse{0%,30%,100%{transform:scale(1)}15%{transform:scale(1.22)}22%{transform:scale(.94)}}
`;
