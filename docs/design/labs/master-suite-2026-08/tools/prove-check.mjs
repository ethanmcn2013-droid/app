/* Prove the two repaired rules in interaction-check.mjs still catch what
   they watch. A rule that stops reporting because it now skips everything
   is worse than the false positive it replaced — it is a green light with
   nothing behind it.
 *
 *   node tools/prove-check.mjs
 *
 * Each rule is run twice against the real page: once clean, and once with
 * a genuine offender injected. Clean must be silent; injected must fire. */

import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const url = pathToFileURL(path.resolve("_wrapped.html")).href;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto(url + "?v=paper&state=tasks.board");
await page.waitForTimeout(700);

/* The two predicates, verbatim in shape from interaction-check.mjs. */
const focusRule = () => {
  const out = [];
  for (const el of document.querySelectorAll("button, a[href], [tabindex], input, textarea, select, [role='button'], [role='checkbox']")) {
    const cs = getComputedStyle(el);
    const shown = el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true });
    const visible = shown && !el.closest("[inert]") && !el.closest("[hidden]");
    if (!visible && el.tabIndex >= 0 && cs.pointerEvents !== "none") {
      const was = document.activeElement;
      try { el.focus(); } catch (e) {}
      const took = document.activeElement === el;
      if (was && was.focus) { try { was.focus(); } catch (e) {} }
      if (took) out.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
    }
  }
  return out;
};

const clipRule = () => {
  const bad = [];
  for (const el of document.querySelectorAll("*")) {
    if (!el.childNodes.length) continue;
    const cs = getComputedStyle(el);
    if (cs.overflow !== "hidden" && cs.overflowX !== "hidden") continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (cs.textOverflow === "ellipsis") continue;
    if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
    if (/inset\(50%\)/.test(cs.clipPath || "")) continue;
    const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (text) bad.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
  }
  return bad;
};

let bad = 0;
const say = (label, pass, detail) => {
  if (!pass) bad += 1;
  process.stdout.write(`  ${pass ? "pass" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}\n`);
};

/* ── clean ─────────────────────────────────────────────────────── */
say("focus rule is silent on the real page", (await page.evaluate(focusRule)).length === 0,
  (await page.evaluate(focusRule)).join(", "));
say("clipping rule is silent on the real page", (await page.evaluate(clipRule)).length === 0,
  (await page.evaluate(clipRule)).join(", "));

/* ── an offender the focus rule MUST catch ─────────────────────── */
const caught = await page.evaluate((src) => {
  /* The VISIBLE app. `.sheet` alone finds a hidden product's sheet first,
     and an element inside `[hidden][inert]` genuinely cannot take focus —
     which made this proof fail against a rule that was working. */
  const host = document.querySelector(".app:not([hidden]) .sheet") ||
    document.querySelector(".board") || document.body;
  const b = document.createElement("button");
  b.className = "zzTrap";
  b.textContent = "invisible but focusable";
  /* Visually gone, still in the flow, still takes focus. This is the real
     stranding case: a keyboard lands on it and nothing is on screen. */
  b.style.cssText = "opacity:0;position:absolute;left:0;top:0;width:40px;height:40px";
  host.appendChild(b);
  const hit = new Function("return (" + src + ")()")();
  b.remove();
  return hit;
}, focusRule.toString());
say("focus rule catches an opacity:0 focus stop", caught.some((c) => c.includes("zzTrap")),
  caught.join(", ") || "caught nothing");

/* ── an offender the clipping rule MUST catch ──────────────────── */
const caught2 = await page.evaluate((src) => {
  const host = document.querySelector(".app:not([hidden]) .sheet") ||
    document.querySelector(".board") || document.body;
  const d = document.createElement("div");
  d.className = "zzClip";
  d.style.cssText = "overflow:hidden;width:60px;height:20px;white-space:nowrap";
  d.textContent = "a sentence far too long for sixty pixels, cut mid-word";
  host.appendChild(d);
  const hit = new Function("return (" + src + ")()")();
  d.remove();
  return hit;
}, clipRule.toString());
say("clipping rule catches a real mid-word cut", caught2.some((c) => c.includes("zzClip")),
  caught2.join(", ") || "caught nothing");

await browser.close();
process.stdout.write(bad ? `\n${bad} FAILING — a repaired rule is not watching\n` : "\nboth repaired rules still watch what they claim to\n");
process.exit(bad ? 1 : 0);
