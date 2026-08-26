// The family furniture for the August 2026 elevations.
//
// Three products were elevated in three separate sessions, and each session
// invented its own report design. This module is the correction: one rail,
// one set of tokens, one masthead idiom, generated from set.json and applied
// to all fifteen artifacts, so a reader who has seen one has seen the family.
//
// Everything here is namespaced `fam-` and lives in a single stylesheet
// appended at the end of each document, which means it wins ties against the
// page's own CSS without needing a single !important.
//
// The palette is the one the elevations themselves policed: Ink #111111,
// Indigo #4f46e5, White #ffffff, and tints of those three. Nothing else.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SET = JSON.parse(readFileSync(path.join(here, "set.json"), "utf8"));

export const FONT_LINK = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">',
].join("\n");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The label a document carries in the rail. The method slot takes the
 *  product's own round count, because "Fourteen Rounds" is the name the
 *  session gave it and renaming it would break the reader's memory. */
export function labelFor(productKey, doc) {
  const p = SET.products[productKey];
  if (doc.slot === "method") return `${p.roundWord} Rounds`;
  return doc.label;
}

export function titleFor(productKey, slot) {
  const p = SET.products[productKey];
  const doc = SET.docs.find((d) => d.slot === slot);
  if (slot === "method") return `${p.name} · ${p.roundWord} Rounds`;
  if (slot === "question") return `${p.name} · The 9.5 Question`;
  if (slot === "ceo") return `${p.name} · CEO Report`;
  return `${p.name} ${doc.label}`;
}

/* ═══════════════════════════════════════════════════════════════════════
   The rail
   ═══════════════════════════════════════════════════════════════════════ */

export function rail(productKey, currentSlot, { ground = "paper" } = {}) {
  const p = SET.products[productKey];
  const sibs = Object.entries(SET.products)
    .filter(([k]) => k !== productKey)
    .sort((a, b) => a[1].order - b[1].order);

  const items = SET.docs
    .map((d) => {
      const href = p.urls[d.slot];
      const cur = d.slot === currentSlot;
      const label = labelFor(productKey, d);
      const inner =
        `<span class="famRail-n">${d.n}</span>` +
        `<span class="famRail-t">${esc(label)}</span>`;
      if (cur) {
        return `<li class="famRail-item is-here"><span class="famRail-link" aria-current="page">${inner}</span></li>`;
      }
      if (!href) {
        return `<li class="famRail-item is-soon"><span class="famRail-link">${inner}</span></li>`;
      }
      return `<li class="famRail-item"><a class="famRail-link" href="${esc(href)}">${inner}</a></li>`;
    })
    .join("");

  const sibLinks = sibs
    .map(([k, s]) => {
      const href = s.urls.ceo || s.urls.log || s.urls.console;
      return href
        ? `<a class="famRail-sib" href="${esc(href)}">${esc(s.name)}</a>`
        : `<span class="famRail-sib is-soon">${esc(s.name)}</span>`;
    })
    .join("");

  const home = p.urls.ceo || p.urls.log || "";
  const mark = home
    ? `<a class="famRail-mark" href="${esc(home)}">`
    : `<span class="famRail-mark">`;
  const markEnd = home ? "</a>" : "</span>";

  return `<nav class="famRail" data-fam-ground="${ground}" aria-label="The ${esc(p.name)} elevation — five documents">
  <div class="famRail-in">
    ${mark}<span class="famRail-dot"></span><b>Signal Studio</b><i>/</i><em>${esc(p.name)}</em>${markEnd}
    <ol class="famRail-set">${items}</ol>
    <div class="famRail-sibs"><span class="famRail-sibsLabel">also elevated</span>${sibLinks}</div>
  </div>
</nav>
<script>/* keep the current document in view when the rail has to scroll */
(function(){try{var r=document.querySelector('.famRail-set .is-here');if(!r)return;
var s=r.closest('.famRail-set');if(!s)return;
requestAnimationFrame(function(){var o=r.offsetLeft-(s.clientWidth-r.offsetWidth)/2;
if(s.scrollWidth>s.clientWidth+2)s.scrollLeft=Math.max(0,o);});}catch(e){}})();</script>`;
}

/* ═══════════════════════════════════════════════════════════════════════
   The stylesheet
   ═══════════════════════════════════════════════════════════════════════ */

export function css() {
  return `
/* ── the family rail ────────────────────────────────────────────────────
   One band, five documents, always at the top. It is the only chrome the
   three elevations share, so it carries the whole burden of making them
   read as one operation: the same dot, the same numbering, the same
   indigo under whichever document you are standing in.
   ──────────────────────────────────────────────────────────────────── */
.famRail {
  --f-ink: #111111;
  --f-indigo: #4f46e5;
  --f-paper: #ffffff;
  --f-1: var(--f-ink);
  --f-2: rgba(17, 17, 17, 0.66);
  --f-3: rgba(17, 17, 17, 0.44);
  --f-line: rgba(17, 17, 17, 0.11);
  --f-wash: rgba(17, 17, 17, 0.045);
  --f-veil: rgba(255, 255, 255, 0.86);
  --f-sans: "Geist", system-ui, -apple-system, "Segoe UI", sans-serif;
  --f-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  position: sticky;
  top: 0;
  z-index: 9000;
  font-family: var(--f-sans);
  background: var(--f-veil);
  border-bottom: 1px solid var(--f-line);
  color: var(--f-1);
  -webkit-font-smoothing: antialiased;
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .famRail { -webkit-backdrop-filter: saturate(1.6) blur(14px); backdrop-filter: saturate(1.6) blur(14px); }
}

/* the ink ground — consoles are instruments and stay dark either way */
.famRail[data-fam-ground="ink"] {
  --f-1: #f6f6f7;
  --f-2: rgba(246, 246, 247, 0.62);
  --f-3: rgba(246, 246, 247, 0.40);
  --f-line: rgba(255, 255, 255, 0.13);
  --f-wash: rgba(255, 255, 255, 0.06);
  --f-indigo: #8b84f3;
  --f-veil: rgba(12, 12, 13, 0.86);
}
@media (prefers-color-scheme: dark) {
  .famRail[data-fam-ground="paper"]:not([data-fam-force="light"]) {
    --f-1: #f6f6f7;
    --f-2: rgba(246, 246, 247, 0.62);
    --f-3: rgba(246, 246, 247, 0.40);
    --f-line: rgba(255, 255, 255, 0.13);
    --f-wash: rgba(255, 255, 255, 0.06);
    --f-indigo: #8b84f3;
    --f-veil: rgba(12, 12, 13, 0.86);
  }
}
:root[data-theme="dark"] .famRail[data-fam-ground="paper"] {
  --f-1: #f6f6f7;
  --f-2: rgba(246, 246, 247, 0.62);
  --f-3: rgba(246, 246, 247, 0.40);
  --f-line: rgba(255, 255, 255, 0.13);
  --f-wash: rgba(255, 255, 255, 0.06);
  --f-indigo: #8b84f3;
  --f-veil: rgba(12, 12, 13, 0.86);
}
:root[data-theme="light"] .famRail[data-fam-ground="paper"] {
  --f-1: #111111;
  --f-2: rgba(17, 17, 17, 0.66);
  --f-3: rgba(17, 17, 17, 0.44);
  --f-line: rgba(17, 17, 17, 0.11);
  --f-wash: rgba(17, 17, 17, 0.045);
  --f-indigo: #4f46e5;
  --f-veil: rgba(255, 255, 255, 0.86);
}

.famRail * { box-sizing: border-box; }
.famRail-in {
  display: flex;
  align-items: stretch;
  gap: 26px;
  max-width: 1560px;
  margin: 0 auto;
  padding: 0 24px;
  min-height: 52px;
}

/* the mark */
.famRail-mark {
  display: flex; align-items: center; gap: 8px;
  flex: 0 0 auto;
  text-decoration: none;
  font-size: 13px;
  letter-spacing: -0.006em;
  color: var(--f-2);
  white-space: nowrap;
  border: 0; background: none; padding: 0;
}
.famRail-mark b { font-weight: 500; color: var(--f-1); }
.famRail-mark i { font-style: normal; color: var(--f-3); margin: 0 1px; }
.famRail-mark em { font-style: normal; font-weight: 500; color: var(--f-1); }
a.famRail-mark:hover em { color: var(--f-indigo); }
.famRail-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--f-indigo); flex: 0 0 auto;
}

/* the five */
.famRail-set {
  display: flex; align-items: stretch; gap: 2px;
  list-style: none; margin: 0; padding: 0;
  flex: 1 1 auto; min-width: 0;
  overflow-x: auto; overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-behavior: smooth;
}
.famRail-set::-webkit-scrollbar { display: none; }
.famRail-item { display: flex; flex: 0 0 auto; }
.famRail-link {
  display: flex; align-items: center; gap: 8px;
  padding: 0 11px;
  text-decoration: none;
  color: var(--f-2);
  font-size: 13px;
  letter-spacing: -0.004em;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 140ms ease, background-color 140ms ease;
}
a.famRail-link:hover { color: var(--f-1); background: var(--f-wash); }
a.famRail-link:focus-visible {
  outline: 2px solid var(--f-indigo); outline-offset: -3px; border-radius: 3px;
}
.famRail-n {
  font-family: var(--f-mono); font-size: 10px; font-weight: 400;
  letter-spacing: 0.06em; color: var(--f-3);
  font-variant-numeric: tabular-nums;
  transition: color 140ms ease;
}
a.famRail-link:hover .famRail-n { color: var(--f-2); }
.famRail-item.is-here .famRail-link {
  color: var(--f-1); font-weight: 500;
  border-bottom-color: var(--f-indigo);
  cursor: default;
}
.famRail-item.is-here .famRail-n { color: var(--f-indigo); }
.famRail-item.is-soon .famRail-link { color: var(--f-3); cursor: default; }

/* the other two elevations */
.famRail-sibs {
  display: flex; align-items: center; gap: 12px;
  flex: 0 0 auto; padding-left: 22px;
  border-left: 1px solid var(--f-line);
}
.famRail-sibsLabel {
  font-family: var(--f-mono); font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--f-3);
}
.famRail-sib {
  font-size: 13px; text-decoration: none; color: var(--f-2);
  white-space: nowrap;
  transition: color 140ms ease;
}
a.famRail-sib:hover { color: var(--f-indigo); }
a.famRail-sib:focus-visible { outline: 2px solid var(--f-indigo); outline-offset: 2px; border-radius: 3px; }
.famRail-sib.is-soon { color: var(--f-3); }

@media (max-width: 1180px) {
  .famRail-sibsLabel { display: none; }
  .famRail-in { gap: 18px; }
}
@media (max-width: 900px) {
  .famRail-mark b, .famRail-mark i { display: none; }
  .famRail-in { padding: 0 16px; gap: 14px; }
  .famRail-sibs { padding-left: 14px; gap: 10px; }
}
@media (max-width: 620px) {
  .famRail-sibs { display: none; }
  .famRail-link { padding: 0 9px; }
  .famRail-t { display: none; }
  .famRail-item.is-here .famRail-t { display: inline; }
  .famRail-n { font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .famRail-set { scroll-behavior: auto; }
  .famRail-link, .famRail-n, .famRail-sib { transition: none; }
}
@media print { .famRail { display: none; } }
`.trim();
}

/** Everything that gets appended to the end of a document. */
export function tail() {
  return `\n<style id="famCss">\n${css()}\n</style>\n`;
}
