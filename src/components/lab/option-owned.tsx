/**
 * Direction T2: Owned. Counterpoint.
 *
 * Tasks is not only a place to finish work. It is where a commitment becomes
 * explicit. The ownership ledger is present from frame one; three unclear
 * handoffs resolve to named owners, then the one live commitment carries the
 * product pulse. The default state is the settled, fully-owned ledger.
 */

import Link from "next/link";

type Handoff = {
  item: string;
  owner: string;
  due: string;
  state: "live" | "ready" | "done";
  stateLabel: string;
  resolves?: boolean;
  sequence?: number;
};

const HANDOFFS: Handoff[] = [
  {
    item: "Confirm the final guest count",
    owner: "You",
    due: "Now",
    state: "live",
    stateLabel: "Needs you",
  },
  {
    item: "Approve the supplier invoice",
    owner: "Maeve",
    due: "Noon",
    state: "ready",
    stateLabel: "Ready",
    resolves: true,
    sequence: 0,
  },
  {
    item: "Send the floor plan to the venue",
    owner: "Luca",
    due: "Today",
    state: "ready",
    stateLabel: "Ready",
    resolves: true,
    sequence: 1,
  },
  {
    item: "Lock the tasting menu",
    owner: "Aoife",
    due: "Friday",
    state: "ready",
    stateLabel: "Ready",
    resolves: true,
    sequence: 2,
  },
  {
    item: "Pay the lighting deposit",
    owner: "You",
    due: "9:02",
    state: "done",
    stateLabel: "Done",
  },
];

export function OptionOwned() {
  return (
    <section className="ow" aria-labelledby="ow-title" aria-describedby="ow-deck">
      <div className="ow-wrap">
        <header className="ow-intro">
          <div>
            <p className="ow-eyebrow">Signal Tasks · ownership</p>
            <h1 className="ow-title" id="ow-title">
              Owned.
            </h1>
          </div>
          <p className="ow-deck" id="ow-deck">
            Every commitment says who has it, when it is due and what happens next.
          </p>
        </header>

        <div className="ow-ledger" aria-labelledby="ow-ledger-title">
          <div className="ow-ledger-top">
            <h2 className="ow-ledger-title" id="ow-ledger-title">
              The handoff
            </h2>
            <p className="ow-ledger-count">5 of 5 owned</p>
          </div>

          <div className="ow-head" aria-hidden="true">
            <span>Commitment</span>
            <span>Owner</span>
            <span>Due</span>
            <span>State</span>
          </div>

          <ol className="ow-list">
            {HANDOFFS.map((handoff) => (
              <li
                className={`ow-row ow-${handoff.state}${handoff.resolves ? " ow-resolves" : ""}`}
                key={handoff.item}
                style={{ ["--ow-seq" as string]: handoff.sequence ?? 0 }}
              >
                <span className="ow-item">{handoff.item}</span>

                <span className="ow-cell ow-owner">
                  <span className="ow-mobile-label">Owner</span>
                  <span className="ow-stack">
                    {handoff.resolves ? (
                      <span className="ow-before" aria-hidden="true">
                        Unowned
                      </span>
                    ) : null}
                    <span className="ow-owner-final">
                      <span className="ow-owner-mark" aria-hidden="true" />
                      {handoff.owner}
                    </span>
                  </span>
                </span>

                <span className="ow-cell ow-due">
                  <span className="ow-mobile-label">Due</span>
                  <span>{handoff.due}</span>
                </span>

                <span className="ow-cell ow-state">
                  <span className="ow-mobile-label">State</span>
                  <span className="ow-stack">
                    {handoff.resolves ? (
                      <span className="ow-state-before" aria-hidden="true">
                        Unclear
                      </span>
                    ) : null}
                    <span className="ow-state-final">
                      {handoff.state === "live" ? <span className="ow-live-dot" aria-hidden="true" /> : null}
                      {handoff.stateLabel}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <footer className="ow-close">
          <p className="ow-receipt">
            Five commitments. Five owners. <span>Nothing unclear.</span>
          </p>
          <span className="ow-wordmark">
            <span className="ow-sr">Tasks</span>
            <span aria-hidden="true">tasks<span className="ow-wordmark-dot" /></span>
          </span>
        </footer>

        <nav className="ow-actions" aria-label="Tasks hero actions">
          <Link className="ow-action ow-action-primary" href="/app">
            Open the workspace
          </Link>
          <Link className="ow-action ow-action-secondary" href="/#anatomy">
            See how it works
          </Link>
        </nav>
      </div>

      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
.ow{
  --ow-ink:var(--ink);
  --ow-soft:var(--ink-soft);
  --ow-faint:var(--ink-faint);
  --ow-faintest:var(--zinc-400);
  --ow-paper:var(--paper);
  --ow-wash:var(--paper-soft);
  --ow-accent:var(--accent);
  --ow-accent-wash:color-mix(in srgb,var(--accent) 5.5%,transparent);
  --ow-accent-line:color-mix(in srgb,var(--accent) 24%,transparent);
  --ow-hair:var(--hairline);
  --ow-hair-soft:var(--hairline-soft);
  --ow-ease:var(--ease-out);
  --ow-rack:var(--ease-out);
  position:relative;
  min-height:clamp(640px,80svh,820px);
  display:flex;
  align-items:center;
  overflow:hidden;
  background:var(--ow-paper);
  color:var(--ow-ink);
  font-family:var(--font-geist-sans,system-ui,sans-serif);
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
.ow *{box-sizing:border-box}
.ow-wrap{width:min(980px,100%);margin-inline:auto;padding:clamp(44px,7vh,72px) clamp(20px,4.5vw,48px) clamp(36px,6vh,64px)}
.ow-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.ow-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:32px 64px;margin-bottom:clamp(30px,5vh,48px)}
.ow-eyebrow{margin:0 0 13px;font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--ow-faint)}
.ow-title{margin:0;font-size:clamp(54px,8.4vw,88px);font-weight:620;line-height:.9;letter-spacing:-.052em}
.ow-deck{margin:0 0 2px;max-width:39ch;font-size:15px;line-height:1.55;color:var(--ow-faint);text-wrap:pretty}

.ow-ledger{border-top:3px double var(--ow-ink);border-bottom:1px solid var(--ow-ink)}
.ow-ledger-top{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:15px 2px 13px}
.ow-ledger-title{margin:0;font-family:var(--font-geist-mono,monospace);font-size:11px;font-weight:650;letter-spacing:.15em;text-transform:uppercase}
.ow-ledger-count{margin:0;font-family:var(--font-geist-mono,monospace);font-size:10.5px;letter-spacing:.045em;color:var(--ow-faint);font-variant-numeric:tabular-nums}
.ow-head,.ow-row{display:grid;grid-template-columns:minmax(0,1fr) 130px 90px 104px;column-gap:18px;align-items:center}
.ow-head{padding:8px 2px;border-top:1px solid var(--ow-hair-soft);font-family:var(--font-geist-mono,monospace);font-size:9px;font-weight:550;letter-spacing:.13em;text-transform:uppercase;color:var(--ow-faintest)}
.ow-list{list-style:none;margin:0;padding:0}
.ow-row{min-height:59px;padding:11px 2px;border-top:1px solid var(--ow-hair-soft)}
.ow-live{background:var(--ow-accent-wash)}
.ow-item{min-width:0;font-size:clamp(14px,1.4vw,17px);font-weight:520;letter-spacing:-.012em;line-height:1.35}
.ow-cell{min-width:0;font-family:var(--font-geist-mono,monospace);font-size:10.5px;line-height:1.35;letter-spacing:.025em;color:var(--ow-faint);font-variant-numeric:tabular-nums}
.ow-stack{position:relative;display:grid;min-width:0}
.ow-before,.ow-state-before{display:none;grid-area:1/1;color:var(--ow-faintest)}
.ow-owner-final,.ow-state-final{grid-area:1/1;display:inline-flex;align-items:center;gap:7px;min-width:0}
.ow-owner-mark{width:5px;height:5px;border-radius:50%;background:var(--ow-soft);flex:0 0 auto}
.ow-live .ow-owner-mark{background:var(--ow-accent)}
.ow-state-final{width:max-content;min-height:22px;padding:3px 7px;border:1px solid var(--ow-hair);border-radius:3px;white-space:nowrap}
.ow-live .ow-state-final{color:var(--ow-accent);border-color:var(--ow-accent-line);background:rgba(255,255,255,.72);font-weight:600}
.ow-done .ow-item,.ow-done .ow-cell{color:var(--ow-faint)}
.ow-done .ow-state-final{border-color:transparent;padding-inline:0}
.ow-live-dot{width:7px;height:7px;border-radius:50%;background:var(--ow-accent);box-shadow:0 0 0 4px rgba(79,70,229,.10);flex:0 0 auto}
.ow-mobile-label{display:none}

.ow-close{display:flex;align-items:flex-end;justify-content:space-between;gap:18px 32px;padding-top:18px}
.ow-receipt{margin:0;font-size:12.5px;line-height:1.5;color:var(--ow-faint)}
.ow-receipt span{color:var(--ow-soft)}
.ow-wordmark{position:relative;flex:0 0 auto;display:inline-flex;align-items:flex-end;font-size:clamp(22px,2.8vw,28px);font-weight:620;letter-spacing:-.04em;line-height:1}
.ow-wordmark-dot{display:inline-block;width:.15em;height:.15em;margin-left:.05em;margin-bottom:.1em;border-radius:50%;background:var(--ow-accent);vertical-align:bottom}
.ow-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px 14px;margin-top:clamp(24px,3.6vh,34px)}
.ow-action{display:inline-flex;min-height:42px;align-items:center;justify-content:center;padding:10px 17px;border:1px solid var(--ow-ink);border-radius:5px;font-size:13px;font-weight:560;text-decoration:none;transition:background-color 160ms var(--ow-ease),color 160ms var(--ow-ease),border-color 160ms var(--ow-ease),transform 80ms ease}
.ow-action-primary{background:var(--ow-ink);color:var(--ow-paper)}
.ow-action-primary:hover{background:var(--ow-soft);border-color:var(--ow-soft)}
.ow-action-secondary{border-color:var(--ow-hair);color:var(--ow-soft);background:var(--ow-paper)}
.ow-action-secondary:hover{border-color:var(--ow-faint);color:var(--ow-ink)}
.ow-action:active{transform:translateY(1px)}
.ow-action:focus-visible{outline:3px solid rgba(79,70,229,.26);outline-offset:3px}

@media (max-width:720px){
  .ow{align-items:flex-start}
  .ow-intro{align-items:flex-start;flex-direction:column;gap:18px;margin-bottom:30px}
  .ow-title{font-size:clamp(52px,15vw,78px)}
  .ow-deck{max-width:43ch}
  .ow-head{display:none}
  .ow-row{grid-template-columns:minmax(0,1fr) auto;column-gap:18px;row-gap:10px;min-height:82px;padding:13px 2px}
  .ow-item{grid-column:1/3}
  .ow-owner{grid-column:1;grid-row:2;justify-self:start}
  .ow-due{grid-column:1;grid-row:3;justify-self:start}
  .ow-state{grid-column:2;grid-row:2/4;align-self:center;justify-self:end}
  .ow-cell{display:flex;align-items:baseline;gap:6px}
  .ow-mobile-label{display:inline;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--ow-faintest)}
}
@media (max-width:460px){
  .ow-wrap{padding-inline:16px}
  .ow-ledger-top{align-items:flex-start}
  .ow-ledger-count{text-align:right}
  .ow-close{align-items:flex-start;flex-direction:column-reverse;gap:12px}
  .ow-actions{align-items:stretch;flex-direction:column}
  .ow-action{width:100%}
}

@media (prefers-reduced-motion:no-preference){
  .ow-resolves .ow-before,.ow-resolves .ow-state-before{display:inline-flex;animation:ow-before-out .32s var(--ow-ease) calc(.34s + var(--ow-seq) * .34s) both}
  .ow-resolves .ow-owner-final,.ow-resolves .ow-state-final{opacity:0;animation:ow-owner-in .46s var(--ow-rack) calc(.56s + var(--ow-seq) * .34s) both}
  .ow-resolves .ow-owner-mark{transform:scale(0);animation:ow-mark-in .38s var(--ease-in-out) calc(.68s + var(--ow-seq) * .34s) both}
  .ow-live-dot{opacity:0;transform:scale(.35);animation:ow-live-in .42s var(--ease-in-out) 1.92s both,ow-pulse 2.6s ease-in-out 2.56s infinite}
  .ow-receipt{animation:ow-receipt-in .5s var(--ow-ease) 1.84s both}
}
@keyframes ow-before-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-4px)}}
@keyframes ow-owner-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@keyframes ow-mark-in{0%{transform:scale(0)}65%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes ow-live-in{0%{opacity:0;transform:scale(.35)}65%{opacity:1;transform:scale(1.24)}100%{opacity:1;transform:scale(1)}}
@keyframes ow-pulse{0%,30%,100%{transform:scale(1);box-shadow:0 0 0 4px rgba(79,70,229,.10)}15%{transform:scale(1.2);box-shadow:0 0 0 7px rgba(79,70,229,.06)}22%{transform:scale(.95);box-shadow:0 0 0 3px rgba(79,70,229,.09)}}
@keyframes ow-receipt-in{from{opacity:.36;transform:translateY(4px)}to{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  .ow *,.ow *::before,.ow *::after{animation:none!important;transition:none!important}
}
`;
