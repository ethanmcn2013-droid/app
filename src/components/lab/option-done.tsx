/**
 * Direction T1: Done. Flagship.
 *
 * A real Today ledger is present from the first frame. The motion is the
 * product doing its job: one owner locks in, two commitments complete, and the
 * live item takes the single Tasks pulse. The sequence is settled by 2.6s.
 *
 * The default CSS is the final state, so SSR, no-JS, and reduced-motion users
 * receive the complete artifact immediately. Motion is opt-in through
 * prefers-reduced-motion: no-preference. Everything is scoped with `dn-`.
 */

import Link from "next/link";

type Commitment = {
  item: string;
  owner: string;
  priorOwner?: string;
  due: string;
  status: "live" | "moving" | "next" | "done";
  statusLabel: string;
  completionOrder?: number;
};

const COMMITMENTS: Commitment[] = [
  {
    item: "Send the supplier the final count",
    owner: "You",
    due: "Today",
    status: "live",
    statusLabel: "Needs you",
  },
  {
    item: "Name an owner for the venue invoice",
    owner: "Maeve",
    priorOwner: "Unassigned",
    due: "Noon",
    status: "moving",
    statusLabel: "Moving",
  },
  {
    item: "Book the tasting slot",
    owner: "Aoife",
    due: "Friday",
    status: "next",
    statusLabel: "Next",
  },
  {
    item: "Floor plan approved",
    owner: "Luca",
    due: "8:41",
    status: "done",
    statusLabel: "Done",
    completionOrder: 0,
  },
  {
    item: "Deposit paid",
    owner: "You",
    due: "9:02",
    status: "done",
    statusLabel: "Done",
    completionOrder: 1,
  },
];

export function OptionDone() {
  return (
    <section className="dn" aria-labelledby="dn-title" aria-describedby="dn-deck">
      <div className="dn-wrap">
        <header className="dn-intro">
          <p className="dn-eyebrow">Signal Tasks · today</p>
          <h1 className="dn-title" id="dn-title">
            Open to done.
          </h1>
          <p className="dn-deck" id="dn-deck">
            Owners, due moments and the next move, held in one live list.
          </p>
        </header>

        <div className="dn-board" aria-labelledby="dn-board-title">
          <div className="dn-board-rule" aria-hidden="true" />
          <div className="dn-board-head">
            <h2 className="dn-board-title" id="dn-board-title">
              Today
            </h2>
            <p className="dn-board-count">
              <span>5 commitments</span>
              <span aria-hidden="true"> · </span>
              <span>2 done</span>
            </p>
          </div>

          <div className="dn-column-head" aria-hidden="true">
            <span />
            <span>Commitment</span>
            <span>Owner</span>
            <span>Due</span>
            <span>Status</span>
          </div>

          <ol className="dn-list">
            {COMMITMENTS.map((commitment) => (
              <li
                className={`dn-row dn-${commitment.status}`}
                key={commitment.item}
                style={{
                  ["--dn-seq" as string]: commitment.completionOrder ?? 0,
                }}
              >
                <span className="dn-mark" aria-hidden="true">
                  <span className="dn-ring" />
                  <span className="dn-live-core" />
                  <svg className="dn-tick" viewBox="0 0 24 24">
                    <path
                      className="dn-tick-path"
                      d="M5 12.5l4.2 4.4L19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />
                  </svg>
                </span>

                <span className="dn-item">{commitment.item}</span>

                <span className={`dn-cell dn-owner${commitment.priorOwner ? " dn-owner-swap" : ""}`}>
                  <span className="dn-mobile-label">Owner</span>
                  <span className="dn-owner-stack">
                    {commitment.priorOwner ? (
                      <span className="dn-owner-before" aria-hidden="true">
                        {commitment.priorOwner}
                      </span>
                    ) : null}
                    <span className="dn-owner-final">{commitment.owner}</span>
                  </span>
                </span>

                <span className="dn-cell dn-due">
                  <span className="dn-mobile-label">Due</span>
                  <span>{commitment.due}</span>
                </span>

                <span className="dn-cell dn-status">
                  <span className="dn-mobile-label">Status</span>
                  <span className="dn-status-value">{commitment.statusLabel}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <footer className="dn-close">
          <p className="dn-receipt">
            <span className="dn-receipt-strong">Five</span> commitments. <span className="dn-receipt-strong">Two</span> cleared. <span className="dn-receipt-strong">One</span> needs you.
          </p>
          <span className="dn-wordmark">
            <span className="dn-sr">Tasks</span>
            <span aria-hidden="true">tasks<span className="dn-wordmark-dot" /></span>
          </span>
        </footer>

        <nav className="dn-actions" aria-label="Tasks hero actions">
          <Link className="dn-action dn-action-primary" href="/app">
            Open the workspace
          </Link>
          <Link className="dn-action dn-action-secondary" href="/#anatomy">
            See how it works
          </Link>
        </nav>
      </div>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
.dn{
  --dn-ink:var(--ink);
  --dn-soft:var(--ink-soft);
  --dn-faint:var(--ink-faint);
  --dn-faintest:var(--zinc-400);
  --dn-paper:var(--paper);
  --dn-wash:var(--paper-soft);
  --dn-accent:var(--accent);
  --dn-accent-wash:color-mix(in srgb,var(--accent) 5.5%,transparent);
  --dn-accent-line:color-mix(in srgb,var(--accent) 24%,transparent);
  --dn-hair:var(--hairline);
  --dn-hair-soft:var(--hairline-soft);
  --dn-ease:var(--ease-out);
  --dn-rack:var(--ease-out);
  position:relative;
  min-height:clamp(640px,80svh,820px);
  display:flex;
  align-items:center;
  overflow:hidden;
  background:var(--dn-paper);
  color:var(--dn-ink);
  font-family:var(--font-geist-sans,system-ui,sans-serif);
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
.dn *{box-sizing:border-box}
.dn-wrap{width:min(1040px,100%);margin-inline:auto;padding:clamp(44px,7vh,72px) clamp(20px,4.5vw,48px) clamp(36px,6vh,64px)}
.dn-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.dn-intro{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,36ch);grid-template-areas:"eye deck" "title deck";column-gap:clamp(36px,6vw,88px);align-items:end;margin-bottom:clamp(28px,4.5vh,44px)}
.dn-eyebrow{grid-area:eye;margin:0 0 14px;font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--dn-faint)}
.dn-title{grid-area:title;margin:0;font-size:clamp(46px,7vw,76px);font-weight:620;line-height:.94;letter-spacing:-.047em;text-wrap:balance}
.dn-deck{grid-area:deck;margin:0 0 3px;max-width:36ch;font-size:15px;line-height:1.55;color:var(--dn-faint);text-wrap:pretty}

.dn-board{position:relative;border-bottom:1px solid var(--dn-ink)}
.dn-board-rule{height:3px;border-top:1px solid var(--dn-ink);border-bottom:1px solid var(--dn-hair);transform-origin:left center}
.dn-board-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:15px 2px 13px}
.dn-board-title{margin:0;font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:650;letter-spacing:.15em;text-transform:uppercase}
.dn-board-count{display:flex;margin:0;font-family:var(--font-geist-mono,monospace);font-size:10.5px;letter-spacing:.045em;color:var(--dn-faint);font-variant-numeric:tabular-nums}
.dn-column-head,.dn-row{display:grid;grid-template-columns:30px minmax(0,1fr) 122px 92px 92px;column-gap:16px;align-items:center}
.dn-column-head{padding:8px 2px;border-top:1px solid var(--dn-hair-soft);font-family:var(--font-geist-mono,monospace);font-size:9px;font-weight:550;letter-spacing:.13em;text-transform:uppercase;color:var(--dn-faintest)}
.dn-list{list-style:none;margin:0;padding:0}
.dn-row{min-height:58px;padding:11px 2px;border-top:1px solid var(--dn-hair-soft);transition:none}
.dn-live{background:var(--dn-accent-wash)}
.dn-mark{position:relative;width:24px;height:24px;display:grid;place-items:center}
.dn-ring{position:absolute;width:14px;height:14px;border:1.5px solid var(--dn-faintest);border-radius:50%;opacity:0}
.dn-live-core{position:absolute;width:10px;height:10px;border-radius:50%;background:var(--dn-accent);box-shadow:0 0 0 4px rgba(79,70,229,.10);opacity:0}
.dn-tick{position:absolute;width:22px;height:22px;color:var(--dn-faint);opacity:0}
.dn-tick-path{stroke-dasharray:28;stroke-dashoffset:0}
.dn-live .dn-live-core{opacity:1}
.dn-moving .dn-ring,.dn-next .dn-ring{opacity:1}
.dn-done .dn-tick{opacity:1}
.dn-item{min-width:0;font-size:clamp(14px,1.35vw,17px);font-weight:520;letter-spacing:-.012em;line-height:1.35;color:var(--dn-ink)}
.dn-cell{min-width:0;font-family:var(--font-geist-mono,monospace);font-size:10.5px;line-height:1.35;letter-spacing:.025em;color:var(--dn-faint);font-variant-numeric:tabular-nums}
.dn-owner-stack{position:relative;display:grid;min-width:0}
.dn-owner-before{display:none}
.dn-owner-final{grid-area:1/1;min-width:0}
.dn-mobile-label{display:none}
.dn-status-value{display:inline-flex;align-items:center;min-height:22px;padding:3px 7px;border:1px solid var(--dn-hair);border-radius:3px;white-space:nowrap}
.dn-live .dn-status-value{color:var(--dn-accent);border-color:var(--dn-accent-line);background:rgba(255,255,255,.72);font-weight:600}
.dn-moving .dn-status-value{color:var(--dn-soft)}
.dn-done .dn-item,.dn-done .dn-cell{color:var(--dn-faint)}
.dn-done .dn-status-value{border-color:transparent;padding-inline:0}

.dn-close{display:flex;align-items:flex-end;justify-content:space-between;gap:18px 32px;padding-top:18px}
.dn-receipt{margin:0;font-size:12.5px;line-height:1.5;color:var(--dn-faint)}
.dn-receipt-strong{color:var(--dn-soft);font-variant-numeric:tabular-nums}
.dn-wordmark{position:relative;flex:0 0 auto;display:inline-flex;align-items:flex-end;font-size:clamp(22px,2.8vw,28px);font-weight:620;letter-spacing:-.04em;line-height:1}
.dn-wordmark-dot{display:inline-block;width:.15em;height:.15em;margin-left:.05em;margin-bottom:.1em;border-radius:50%;background:var(--dn-accent);vertical-align:bottom}
.dn-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin-top:clamp(24px,3.6vh,34px)}
.dn-action{display:inline-flex;min-height:42px;align-items:center;justify-content:center;padding:10px 17px;border:1px solid var(--dn-ink);border-radius:5px;font-size:13px;font-weight:560;text-decoration:none;transition:background-color 160ms var(--dn-ease),color 160ms var(--dn-ease),border-color 160ms var(--dn-ease),transform 80ms ease}
.dn-action-primary{background:var(--dn-ink);color:var(--dn-paper)}
.dn-action-primary:hover{background:var(--dn-soft);border-color:var(--dn-soft)}
.dn-action-secondary{border-color:var(--dn-hair);color:var(--dn-soft);background:var(--dn-paper)}
.dn-action-secondary:hover{border-color:var(--dn-faint);color:var(--dn-ink)}
.dn-action:active{transform:translateY(1px)}
.dn-action:focus-visible{outline:3px solid rgba(79,70,229,.26);outline-offset:3px}

@media (max-width:760px){
  .dn{align-items:flex-start}
  .dn-intro{grid-template-columns:1fr;grid-template-areas:"eye" "title" "deck";row-gap:0;margin-bottom:30px}
  .dn-title{font-size:clamp(42px,12vw,64px)}
  .dn-deck{margin-top:18px;max-width:43ch}
  .dn-column-head{display:none}
  .dn-row{grid-template-columns:28px minmax(0,1fr);column-gap:12px;row-gap:9px;min-height:78px;padding:13px 2px}
  .dn-item{align-self:center}
  .dn-cell{grid-row:2;display:flex;align-items:baseline;gap:5px;white-space:nowrap}
  .dn-owner{grid-column:2;justify-self:start}
  .dn-due{grid-column:2;justify-self:center}
  .dn-status{grid-column:2;justify-self:end}
  .dn-mobile-label{display:inline;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--dn-faintest)}
}
@media (max-width:460px){
  .dn-wrap{padding-inline:16px}
  .dn-board-head{align-items:flex-start}
  .dn-board-count{flex-direction:column;align-items:flex-end;line-height:1.45}
  .dn-board-count [aria-hidden="true"]{display:none}
  .dn-row{row-gap:8px}
  .dn-cell{grid-row:auto;grid-column:2;justify-self:start}
  .dn-owner{margin-top:1px}
  .dn-due,.dn-status{margin-left:0}
  .dn-close{align-items:flex-start;flex-direction:column-reverse;gap:12px}
  .dn-actions{align-items:stretch;flex-direction:column}
  .dn-action{width:100%}
}

@media (prefers-reduced-motion:no-preference){
  .dn-board-rule{animation:dn-rule-in .62s var(--dn-ease) .08s both}
  .dn-owner-swap .dn-owner-before{display:block;grid-area:1/1;color:var(--dn-faintest);animation:dn-owner-before .34s var(--dn-ease) .42s both}
  .dn-owner-swap .dn-owner-final{opacity:0;animation:dn-owner-final .42s var(--dn-rack) .64s both}
  .dn-done .dn-ring{opacity:1;animation:dn-ring-out .18s ease calc(1.02s + var(--dn-seq) * .38s) both}
  .dn-done .dn-tick{opacity:0;animation:dn-tick-show .01s linear calc(1.03s + var(--dn-seq) * .38s) both}
  .dn-done .dn-tick-path{stroke-dashoffset:28;animation:dn-tick-draw .48s var(--ease-in-out) calc(1.03s + var(--dn-seq) * .38s) both}
  .dn-done .dn-item,.dn-done .dn-cell{animation:dn-row-mute .42s var(--dn-ease) calc(1.18s + var(--dn-seq) * .38s) both}
  .dn-live .dn-live-core{opacity:0;transform:scale(.35);animation:dn-live-in .42s var(--ease-in-out) 2.02s both,dn-pulse 2.6s ease-in-out 2.66s infinite}
  .dn-receipt{animation:dn-receipt-in .5s var(--dn-ease) 1.95s both}
}
@keyframes dn-rule-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes dn-owner-before{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-4px)}}
@keyframes dn-owner-final{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@keyframes dn-ring-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.72)}}
@keyframes dn-tick-show{from{opacity:0}to{opacity:1}}
@keyframes dn-tick-draw{from{stroke-dashoffset:28;color:var(--dn-accent)}to{stroke-dashoffset:0;color:var(--dn-faint)}}
@keyframes dn-row-mute{from{color:var(--dn-ink)}to{color:var(--dn-faint)}}
@keyframes dn-live-in{0%{opacity:0;transform:scale(.35)}65%{opacity:1;transform:scale(1.24)}100%{opacity:1;transform:scale(1)}}
@keyframes dn-pulse{0%,30%,100%{transform:scale(1);box-shadow:0 0 0 4px rgba(79,70,229,.10)}15%{transform:scale(1.2);box-shadow:0 0 0 7px rgba(79,70,229,.06)}22%{transform:scale(.95);box-shadow:0 0 0 3px rgba(79,70,229,.09)}}
@keyframes dn-receipt-in{from{opacity:.36;transform:translateY(4px)}to{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  .dn *,.dn *::before,.dn *::after{animation:none!important;transition:none!important}
}
`;
