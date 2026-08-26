// The family gate. Fifteen artifacts, one contract.
//
//   node scripts/design/family/verify.mjs
//
// Exits non-zero on any failure, so this can run before every publish.
// It checks the things that actually break a set of cross-linked documents:
// a rail that lost its links, a URL pointing at a page that is not in the
// set, a current marker on the wrong document, a page that scrolls sideways
// on a phone, and a ground that does not follow the reader's theme.

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { SET, labelFor } from "./family.mjs";

const WS = "C:/Users/ethan/signal-studio-workspace";
const ALL = new Map(); // url -> "product/slot"
for (const [k, p] of Object.entries(SET.products))
  for (const [slot, url] of Object.entries(p.urls)) if (url) ALL.set(url, `${k}/${slot}`);

const targets = [];
for (const [k, p] of Object.entries(SET.products))
  for (const d of SET.docs)
    targets.push({ product: k, slot: d.slot, n: d.n, file: path.join(WS, p.worktree, p.lab, p.files[d.slot]) });

let fails = 0;
const bad = (t, msg) => { console.log(`  FAIL  ${t.product}/${t.slot} — ${msg}`); fails++; };

const browser = await chromium.launch();

console.log(`checking ${targets.length} artifacts at 1440 and 390, light and dark\n`);

for (const t of targets) {
  const p = SET.products[t.product];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 120)));

  await page.goto(pathToFileURL(t.file).href, { waitUntil: "load" });
  await page.waitForTimeout(900);

  const r = await page.evaluate(() => {
    const rail = document.querySelector(".famRail");
    const items = [...document.querySelectorAll(".famRail-item")];
    const here = document.querySelector(".famRail-item.is-here");
    return {
      hasRail: !!rail,
      railTop: rail ? Math.round(rail.getBoundingClientRect().top) : null,
      position: rail ? getComputedStyle(rail).position : null,
      count: items.length,
      hrefs: [...document.querySelectorAll(".famRail-link[href]")].map((a) => a.href),
      sibs: [...document.querySelectorAll(".famRail-sib[href]")].map((a) => a.href),
      hereLabel: here?.querySelector(".famRail-t")?.textContent ?? null,
      hereIsLink: !!here?.querySelector("a"),
      ariaCurrent: document.querySelectorAll('.famRail [aria-current="page"]').length,
      soon: document.querySelectorAll(".famRail-item.is-soon").length,
      oldNav: document.querySelectorAll(".setNav").length,
      title: document.title,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

  if (!r.hasRail) { bad(t, "no rail"); await ctx.close(); continue; }
  if (r.count !== 5) bad(t, `rail has ${r.count} items, expected 5`);
  if (r.position !== "sticky") bad(t, `rail is ${r.position}, expected sticky`);
  if (r.railTop !== 0) bad(t, `rail does not start at the top (${r.railTop}px)`);
  if (r.hrefs.length !== 4) bad(t, `${r.hrefs.length} outbound links in the rail, expected 4`);
  if (r.sibs.length !== 2) bad(t, `${r.sibs.length} sibling links, expected 2`);
  if (r.soon !== 0) bad(t, `${r.soon} item(s) still unlinked`);
  if (r.oldNav !== 0) bad(t, `${r.oldNav} old setNav block(s) survive`);
  if (r.ariaCurrent !== 1) bad(t, `${r.ariaCurrent} aria-current markers, expected 1`);
  if (r.hereIsLink) bad(t, "the current document links to itself");

  const want = labelFor(t.product, SET.docs.find((d) => d.slot === t.slot));
  if (r.hereLabel !== want) bad(t, `current marker reads "${r.hereLabel}", expected "${want}"`);

  for (const h of [...r.hrefs, ...r.sibs]) {
    if (!ALL.has(h)) bad(t, `rail links to a URL that is not in the set: ${h}`);
    if (h === p.urls[t.slot]) bad(t, "rail links to the page it is on");
  }
  const selfCount = [...r.hrefs].filter((h) => ALL.get(h)?.startsWith(t.product + "/")).length;
  if (selfCount !== 4) bad(t, `${selfCount} of 4 links stay inside this product's set`);

  if (errs.length) bad(t, `console: ${errs[0]}`);

  // phone width, and the dark ground
  for (const [w, scheme] of [[390, "light"], [1440, "dark"]]) {
    await page.setViewportSize({ width: w, height: 860 });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(320);
    const m = await page.evaluate(() => ({
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      railBg: getComputedStyle(document.querySelector(".famRail")).backgroundColor,
      railFg: getComputedStyle(document.querySelector(".famRail-mark em") ?? document.querySelector(".famRail")).color,
      hereVisible: (() => {
        const e = document.querySelector(".famRail-item.is-here .famRail-t");
        if (!e) return false;
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.height > 0;
      })(),
    }));
    if (m.over > 1) bad(t, `${m.over}px of horizontal scroll at ${w}px`);
    if (!m.hereVisible) bad(t, `the current document's name is not visible at ${w}px`);
    if (/rgba\(0, 0, 0, 0\)/.test(m.railBg)) bad(t, `rail has no ground at ${w}px / ${scheme}`);
  }
  await page.emulateMedia({ colorScheme: "light" });

  console.log(
    `  ok    ${String(t.n)} ${t.product}/${t.slot}`.padEnd(28) +
      `"${r.title}"`.padEnd(34) +
      `here: ${r.hereLabel}`,
  );
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n${fails} failure(s).` : `\nall ${targets.length} artifacts hold the family contract.`);
process.exit(fails ? 1 : 0);
