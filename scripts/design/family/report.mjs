// The shared report idiom for the elevation family.
//
// Every document that is prose rather than an instrument is set on this:
// one paper ground that inverts cleanly, Geist at 400/500/600 with Geist
// Mono for anything that is a measurement, and a single narrow measure with
// the evidence pulled wide beside it.
//
// The palette is the one the elevations policed: Ink #111111, Indigo
// #4f46e5, White #ffffff, and tints of those three. A fourth colour anywhere
// in these pages would be the reports failing the standard they report on.

export function reportCss() {
  return `
:root {
  --ink: #111111;
  --indigo: #4f46e5;
  --white: #ffffff;

  --t1: var(--ink);
  --t2: rgba(17, 17, 17, 0.70);
  --t3: rgba(17, 17, 17, 0.52);
  --t4: rgba(17, 17, 17, 0.30);
  --wash: rgba(17, 17, 17, 0.035);
  --plate: rgba(17, 17, 17, 0.028);
  --line-soft: rgba(17, 17, 17, 0.07);
  --line: rgba(17, 17, 17, 0.12);
  --rule: rgba(17, 17, 17, 0.85);
  --ind-wash: rgba(79, 70, 229, 0.075);
  --ind-line: rgba(79, 70, 229, 0.30);
  --ind-text: #4338ca;

  --paper: var(--white);
  --sans: "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --measure: 34rem;
  --wide: 66rem;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #0c0c0d;
    --t1: #f6f6f7;
    --t2: rgba(246, 246, 247, 0.70);
    --t3: rgba(246, 246, 247, 0.54);
    --t4: rgba(246, 246, 247, 0.30);
    --wash: rgba(255, 255, 255, 0.045);
    --plate: rgba(255, 255, 255, 0.035);
    --line-soft: rgba(255, 255, 255, 0.075);
    --line: rgba(255, 255, 255, 0.13);
    --rule: rgba(246, 246, 247, 0.80);
    --indigo: #8b84f3;
    --ind-wash: rgba(139, 132, 243, 0.14);
    --ind-line: rgba(139, 132, 243, 0.38);
    --ind-text: #a49df6;
  }
}
:root[data-theme="dark"] {
  --paper: #0c0c0d;
  --t1: #f6f6f7;
  --t2: rgba(246, 246, 247, 0.70);
  --t3: rgba(246, 246, 247, 0.54);
  --t4: rgba(246, 246, 247, 0.30);
  --wash: rgba(255, 255, 255, 0.045);
  --plate: rgba(255, 255, 255, 0.035);
  --line-soft: rgba(255, 255, 255, 0.075);
  --line: rgba(255, 255, 255, 0.13);
  --rule: rgba(246, 246, 247, 0.80);
  --indigo: #8b84f3;
  --ind-wash: rgba(139, 132, 243, 0.14);
  --ind-line: rgba(139, 132, 243, 0.38);
  --ind-text: #a49df6;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--t1);
  font-family: var(--sans);
  font-size: 16.5px;
  line-height: 1.62;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.tab { font-variant-numeric: tabular-nums; }
a { color: var(--ind-text); text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:focus-visible { outline: 2px solid var(--indigo); outline-offset: 3px; border-radius: 3px; }

.page { max-width: var(--wide); margin: 0 auto; padding: 0 30px 132px; }
.col { max-width: var(--measure); }
.col p { margin: 0 0 1.05em; color: var(--t2); }
.col p strong, .col p b { color: var(--t1); font-weight: 600; }
.col p:last-child { margin-bottom: 0; }

.kick {
  margin: 0;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--t3);
}
.kick b { color: var(--indigo); font-weight: 400; }

/* ── masthead ───────────────────────────────────────────────────────── */
.mast { padding: 92px 0 46px; border-bottom: 1px solid var(--rule); }
.mast h1 {
  margin: 20px 0 0;
  font-size: clamp(2.9rem, 1.2rem + 5.6vw, 5.2rem);
  font-weight: 600;
  letter-spacing: -0.05em;
  line-height: 0.94;
  text-wrap: balance;
}
.mast h1 em {
  display: block;
  font-style: normal;
  font-weight: 600;
  font-size: 0.86em;
  color: var(--t3);
  letter-spacing: -0.046em;
  margin-top: 0.06em;
  text-wrap: balance;
}
.stand {
  margin: 30px 0 0;
  max-width: 41rem;
  font-size: 19.5px;
  line-height: 1.56;
  color: var(--t2);
  text-wrap: pretty;
}
.byline {
  margin: 34px 0 0;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--t3);
}

/* ── sections ───────────────────────────────────────────────────────── */
section { padding: 78px 0 0; }
section > .kick { margin-bottom: 22px; }
h2 {
  margin: 0 0 26px;
  font-size: clamp(1.5rem, 1.1rem + 1.3vw, 2.05rem);
  font-weight: 600;
  letter-spacing: -0.032em;
  line-height: 1.14;
  text-wrap: balance;
}
h3 {
  margin: 0 0 10px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.014em;
}

/* ── the number ─────────────────────────────────────────────────────── */
.score { display: grid; gap: 34px; align-items: start; }
@media (min-width: 820px) { .score { grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 56px; } }
.score .n b {
  display: block;
  font-size: clamp(88px, 13vw, 136px);
  font-weight: 400;
  line-height: 0.84;
  letter-spacing: -0.052em;
  font-variant-numeric: tabular-nums;
}
.score .n i {
  display: block;
  font-style: normal;
  margin-top: 16px;
  font-family: var(--mono);
  font-size: 11.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--t3);
  line-height: 1.5;
}
.score .n u {
  display: inline-block;
  text-decoration: none;
  margin-top: 12px;
  padding: 3px 9px;
  border: 1px solid var(--ind-line);
  border-radius: 999px;
  background: var(--ind-wash);
  color: var(--ind-text);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
}
.score .say { font-size: 19px; line-height: 1.55; color: var(--t1); margin: 0 0 1em; text-wrap: pretty; }
.score .say + p { color: var(--t2); font-size: 16.5px; margin: 0 0 1em; }
.score .say + p:last-child { margin: 0; }

/* ── figures ────────────────────────────────────────────────────────── */
.figs {
  margin: 54px 0 0;
  display: grid;
  gap: 1px;
  background: var(--line-soft);
  border: 1px solid var(--line-soft);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 700px) { .figs { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1000px) { .figs { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.fig { background: var(--paper); padding: 20px 18px 18px; }
.fig b {
  display: block;
  font-size: 30px;
  font-weight: 400;
  letter-spacing: -0.035em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.fig span {
  display: block;
  margin-top: 10px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.075em;
  text-transform: uppercase;
  color: var(--t3);
  line-height: 1.45;
}
.fig.is-key b { color: var(--indigo); }

/* ── callout ────────────────────────────────────────────────────────── */
.note {
  margin: 0;
  padding: 26px 30px;
  background: var(--ind-wash);
  border-left: 2px solid var(--indigo);
  max-width: 44rem;
}
.note p { margin: 0 0 0.9em; color: var(--t2); }
.note p:last-child { margin: 0; }
.note strong { color: var(--t1); font-weight: 600; }

/* ── the set index ──────────────────────────────────────────────────── */
/* five across, mirroring the five in the rail. Four-and-one wrapping
   reads as an accident; the set has exactly five members and the block
   should say so at a glance. */
.setIx { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 700px) { .setIx { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1020px) { .setIx { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
.setIxCard {
  display: block;
  padding: 17px 17px 19px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--plate);
  text-decoration: none;
  color: inherit;
  transition: border-color 150ms ease, background-color 150ms ease, transform 150ms ease;
}
a.setIxCard:hover { border-color: var(--ind-line); background: var(--ind-wash); transform: translateY(-1px); }
.setIxCard i {
  display: block;
  font-style: normal;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.09em;
  color: var(--t4);
  font-variant-numeric: tabular-nums;
}
.setIxCard b { display: block; margin: 9px 0 7px; font-size: 15.5px; font-weight: 600; letter-spacing: -0.018em; text-wrap: balance; }
.setIxCard span { display: block; font-size: 13.5px; line-height: 1.48; color: var(--t3); text-wrap: pretty; }
.setIxCard.is-here { border-color: var(--ind-line); background: var(--ind-wash); }
.setIxCard.is-here i { color: var(--indigo); }

/* ── lists that are arguments ───────────────────────────────────────── */
.ledger { margin: 0; padding: 0; list-style: none; max-width: 46rem; }
.ledger li { padding: 20px 0; border-top: 1px solid var(--line-soft); }
.ledger li:first-child { border-top: 1px solid var(--line); }
.ledger li:last-child { border-bottom: 1px solid var(--line-soft); }
.ledger b { display: block; font-size: 16.5px; font-weight: 600; letter-spacing: -0.014em; margin-bottom: 5px; }
.ledger span { display: block; color: var(--t2); font-size: 15.5px; line-height: 1.55; }
.ledger em {
  float: right;
  margin-left: 20px;
  font-style: normal;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--t3);
  padding-top: 4px;
}

/* ── comparison table ───────────────────────────────────────────────── */
.tblWrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table.fam { border-collapse: collapse; width: 100%; min-width: 520px; font-size: 15px; }
table.fam th, table.fam td { text-align: left; padding: 14px 18px 14px 0; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
table.fam thead th {
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 400;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--t3);
  border-bottom: 1px solid var(--line);
  padding-bottom: 11px;
}
table.fam tbody th { font-weight: 400; color: var(--t3); font-size: 14px; white-space: nowrap; }
table.fam td { color: var(--t1); font-variant-numeric: tabular-nums; }
table.fam td.is-me { color: var(--indigo); font-weight: 600; }
table.fam tr:last-child th, table.fam tr:last-child td { border-bottom: 0; }

/* ── footer ─────────────────────────────────────────────────────────── */
.foot {
  margin: 108px 0 0;
  padding: 30px 0 0;
  border-top: 1px solid var(--line);
  font-size: 13.5px;
  line-height: 1.62;
  color: var(--t3);
  max-width: 46rem;
}
.foot code { font-family: var(--mono); font-size: 12.5px; color: var(--t2); }

@media (max-width: 620px) {
  .page { padding: 0 20px 96px; }
  .mast { padding: 54px 0 34px; }
  section { padding: 58px 0 0; }
  .ledger em { float: none; display: block; margin: 0 0 6px; padding-top: 0; }
}
@media print {
  body { background: #fff; color: #111; }
  section { break-inside: avoid; }
}
`.trim();
}
