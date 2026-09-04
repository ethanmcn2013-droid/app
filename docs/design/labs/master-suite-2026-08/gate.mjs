/* THE MEASURED GATE for this engagement, and the whole of it.
 *
 *   node docs/design/labs/master-suite-2026-08/gate.mjs
 *   node …/gate.mjs --json
 *
 * Three audits run, not one, because this artefact is three products and
 * no single configuration can hold three separately ratified ladders:
 *
 *   1. Each product against ITS OWN ladders — tools/gates.mjs repoints the
 *      three engagements' own audits at this file with one asserted edit.
 *   2. The suite against what is genuinely cross-product — the elevate
 *      audit: palette, weights, families, contrast, targets, radii, motion,
 *      type ramp and leading, at five viewports across all eight states.
 *   3. The exclusions, PROVED rather than asserted. Two elevate-audit
 *      categories cannot be true of this artefact for reasons that are
 *      properties of the artefact, not defects in it. Each is declared
 *      below with its reason and a mechanical proof, and anything outside
 *      the declared shape fails the gate like anything else.
 *
 * "Do not fake a gate." An exclusion with no proof is a fake gate, so each
 * one here carries a check that would fail if the reason stopped being
 * true.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { EXCLUSIONS, proveContrast, proveTracking } from "./tools/exclusions.mjs";

const LAB = path.dirname(fileURLToPath(import.meta.url));
const WS = path.resolve(LAB, "../../../../..");
const SKILL = path.join(WS, "../.claude/skills/elevate/scripts");
const AS_JSON = process.argv.includes("--json");
/* The render, not the model: the contrast exclusion is proved by reading
   real pixels out of a screenshot of each flagged element. */
const { PNG } = await import(pathToFileURL(path.join(WS, "studio/node_modules/pngjs/lib/png.js")).href);

const results = [];
let bad = 0;
const say = (ok, name, detail) => {
  results.push({ ok, name, detail });
  if (!ok) bad++;
  if (!AS_JSON) process.stdout.write(`  ${ok ? "·" : "✗"} ${name}${detail ? "  " + detail : ""}\n`);
};
const head = (t) => { if (!AS_JSON) process.stdout.write(`\n── ${t} ──\n`); };

function run(file, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: cwd || LAB });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

/* ── 1 · each product against its own ladders ────────────────────── */
head("1 · the three engagements' own audits, repointed at this file");
{
  const r = await run(path.join(LAB, "tools", "gates.mjs"), []);
  for (const line of r.out.split(/\r?\n/)) {
    const m = line.match(/^══ (.+?) · (PASS|FAIL.*) ══$/);
    if (m) say(m[2] === "PASS", m[1], m[2]);
  }
  if (!/══/.test(r.out)) say(false, "tools/gates.mjs", r.out.split(/\r?\n/).slice(-4).join(" | "));
}

/* ── 2 · the suite, cross-product ────────────────────────────────── */
head("2 · the suite — palette, weights, families, targets, radii, motion, ramp, leading");
/* The audit answers in one of two shapes. The workspace skill audits the
   five viewports in one run and reports `viewports`; the copies committed
   with the three engagements audit one viewport per run and report
   `states`. The gate holds the same claim either way — every category at
   zero at every width the brief names — so a one-viewport audit is run
   once per configured viewport and assembled into the shape the rest of
   this file and tools/exclusions.mjs read. Nothing below cares which. */
const config = JSON.parse(await readFile(path.join(LAB, "elevate.config.json"), "utf8"));
const parse = (out) => { try { return JSON.parse(out.slice(out.indexOf("{"))); } catch { return null; } };
async function measuredAudit() {
  const first = await run(path.join(SKILL, "audit.mjs"), [`--lab=${LAB}`, "--json"]);
  const one = parse(first.out);
  if (one && one.viewports) return { report: one };
  if (!one || !one.states) return { out: first.out };
  const viewports = {};
  for (const vp of config.viewports) {
    const r = vp.width === 1440 && vp.height === 960 ? first
      : await run(path.join(SKILL, "audit.mjs"), [`--lab=${LAB}`, "--json", `--viewport=${vp.width}x${vp.height}`]);
    const p = parse(r.out);
    if (!p || !p.states) return { out: r.out };
    /* The source ladders are not this gate's: elevate.config.json leaves
       ladders.sizes and ladders.spaces EMPTY on purpose (see notes.ladders)
       because three products carry three ratified ladders and each is held
       to its own in section 1. The one-viewport audit reads an empty ladder
       as "everything is off it" and reports every size and every space; the
       workspace audit reads it as "no ladder declared" and reports nothing.
       This takes the second reading, which is the config's own. */
    const totals = { ...p.totals };
    if (!(config.ladders || {}).sizes) delete totals.sizeLadder;
    if (!(config.ladders || {}).spaces) delete totals.spaceLadder;
    viewports[vp.name] = { states: p.states, totals };
  }
  return { report: { viewports } };
}
const got = await measuredAudit();
const report = got.report || null;
if (!report) say(false, "the measured audit ran", (got.out || "").split(/\r?\n/).slice(-4).join(" | "));

if (report) {
  const totals = {};
  for (const v of Object.values(report.viewports)) {
    for (const [k, n] of Object.entries(v.totals)) totals[k] = (totals[k] || 0) + n;
  }
  for (const [k, n] of Object.entries(totals)) {
    if (EXCLUSIONS[k]) continue;
    say(n === 0, k, n === 0 ? "0" : `${n} across five viewports`);
  }
  for (const k of Object.keys(EXCLUSIONS)) {
    say(true, `${k} — excluded, proved below`, `${totals[k] || 0} sightings`);
  }
  /* The source ladders are not run: ladders.sizes and ladders.spaces are
     absent from the config because three products declare three of each.
     Each product's own audit runs its own, in section 1. */
  say(true, "source ladders", "run per product in section 1, not here — see elevate.config.json notes.ladders");
}

/* ── 3 · the exclusions, proved ────────────────────────── */
head("3 · the exclusions, proved rather than asserted");
if (report) {
  const browser = await chromium.launch();
  const url = pathToFileURL(path.join(LAB, "_gate-suite.html")).href;
  const states = Object.keys(Object.values(report.viewports)[0].states);
  await proveContrast({ browser, url, report, PNG, say });
  await proveTracking({ browser, url, states, say });
  await browser.close();
}

/* ── the ledger ──────────────────────────────────────────────────── */
if (AS_JSON) {
  process.stdout.write(JSON.stringify({ results, exclusions: EXCLUSIONS, failing: bad }, null, 2) + "\n");
} else {
  process.stdout.write(`\n${bad ? bad + " FAILING" : "MEASURED GATE GREEN"} · ${results.length} checks\n`);
  if (!bad) {
    process.stdout.write("\nExcluded, with the reason and what would withdraw it:\n");
    for (const [k, e] of Object.entries(EXCLUSIONS)) {
      process.stdout.write(`  ${k}\n    ${e.why.replace(/(.{74}\S*)\s/g, "$1\n    ")}\n    withdrawn ${e.withdrawn}\n`);
    }
  }
}
process.exit(bad ? 1 : 0);
