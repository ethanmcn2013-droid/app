// Build the Elevation Log page from the lab's own truth.
//
//   node build-report.mjs --lab=<dir>
//
// Three inputs it can never drift from: panel.json (the scored rounds), the
// palette inventory extracted from the MASTER'S OWN stylesheet at build
// time, and frames.json (pack-shots.mjs, re-run this round). Plus META —
// titles, captions, console URL — assembled from elevate.config.json.
// Output: <lab>/report.html, one self-contained page ready to publish.
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs, loadLab, hexToRgb } from "./lib.mjs";

const args = parseArgs();
const { lab, config } = await loadLab(args);

/* Every colour literal in the master, with its declared alpha and which of
   the locked colours it derives from — the receipt that cannot drift. */
async function paletteInventory() {
  const master = await readFile(path.join(lab, config.master), "utf8");
  const css = master.split("<style>").slice(1).map((s) => s.split("</style>")[0]).join("\n");
  const found = css.match(/#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g) || [];
  const seen = new Map();
  for (const raw of found) {
    const value = raw.toLowerCase().replace(/\s+/g, "");
    seen.set(value, (seen.get(value) || 0) + 1);
  }
  const locked = config.palette.map((p) => ({ name: p.name, hex: p.hex.toLowerCase(), rgb: hexToRgb(p.hex) }));
  const rows = [];
  for (const [value, count] of seen) {
    let base = null;
    let alpha = 1;
    if (value.startsWith("#")) {
      base = locked.find((p) => p.hex === value)?.name ?? null;
    } else {
      const nums = (value.match(/[\d.]+/g) || []).map(Number);
      const [r, g, b, a] = nums;
      alpha = a === undefined ? 1 : a;
      base = locked.find((p) => p.rgb[0] === r && p.rgb[1] === g && p.rgb[2] === b)?.name ?? null;
    }
    rows.push({ value, count, base, alpha });
  }
  rows.sort((a, b) => (a.base || "zz").localeCompare(b.base || "zz") || b.alpha - a.alpha);
  return rows;
}

const shell = await readFile(path.join(lab, "report.shell.html"), "utf8");
const panel = JSON.parse(await readFile(path.join(lab, "panel.json"), "utf8"));
let frames = {};
try {
  frames = JSON.parse(await readFile(path.join(lab, "frames.json"), "utf8"));
} catch {
  process.stdout.write("note: no frames.json — run pack-shots.mjs first for a log with frames\n");
}
const palette = await paletteInventory();

const report = config.report ?? {};
const stampMonth = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
const meta = {
  title: report.title ?? `${config.name[0].toUpperCase()}${config.name.slice(1)} Elevation Log`,
  kicker: report.kicker ?? `${config.product} · ${stampMonth}`,
  palette: config.palette,
  consoleUrl: config.artifacts?.console || "#",
  consoleTitle: report.consoleTitle ?? `${config.name[0].toUpperCase()}${config.name.slice(1)} Design Console`,
  consoleSub: report.consoleSub ?? "Drive the live master and change its decisions underneath.",
  consoleLead: report.consoleLead ?? "The real product with a control panel on it, not a picture of one.",
  variantsLead: report.variantsLead,
  frames: report.frames ?? config.states.map((s) => [s, s[0].toUpperCase() + s.slice(1)]),
  captions: report.captions ?? {},
  variants: report.variants ?? [],
  footNote: report.footNote ?? `Exploration only. Branch design/${config.name}-exploration, no pull request and no deploy.`,
};

if (panel.gate === undefined) panel.gate = config.gate;

/* Finding prose can legally contain "</script>" — escape every "<" so the
   embedded JSON can never terminate the shell's script block. */
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const page = shell
  .replace("/*__PANEL__*/", () => jsonForScript(panel))
  .replace("/*__PALETTE__*/", () => jsonForScript(palette))
  .replace("/*__FRAMES__*/", () => jsonForScript(frames))
  .replace("/*__META__*/", () => jsonForScript(meta));

const out = path.join(lab, "report.html");
await writeFile(out, page, "utf8");
const { size } = await stat(out);
process.stdout.write(`${out}\n${(size / 1024 / 1024).toFixed(2)} MB · ${palette.length} colour literals · ${Object.keys(frames).length} frames · ${panel.rounds.length} rounds\n`);
if (panel.rounds.length === 0) {
  process.stdout.write("note: zero rounds recorded — the log publishes empty-but-live before round 1, by design\n");
}
