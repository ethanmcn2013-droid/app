/* All three gates, one command, one line of output.
 *
 *   node scripts/design/notes-gates.mjs          # audit + behaviour + console
 *   node scripts/design/notes-gates.mjs --fast   # behaviour only, for a tight fix loop
 *
 * Why this exists: round 9 confirmed twenty findings and four of them
 * were defects the previous round's own fixes had introduced. Every one
 * of those came from landing twenty-odd fixes in a batch and running the
 * gates once at the end, by which point the damage was mixed in with the
 * repair and neither could be attributed. The protocol from round 10 is
 * one blocker at a time with this between, and that is only realistic if
 * running everything costs one command and reads in one line.
 */
import { spawn } from "node:child_process";

const FAST = process.argv.includes("--fast");
const GATES = [
  { name: "audit", file: "scripts/design/notes-audit.mjs", always: true },
  { name: "behaviour", file: "scripts/design/notes-interaction-check.mjs", always: true },
  { name: "console", file: "scripts/design/notes-verify-console.mjs", always: false },
];

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
}

const results = [];
for (const gate of GATES) {
  if (FAST && !gate.always) continue;
  const { code, out } = await run(gate.file);
  /* Each gate already prints its own summary; lift the number rather
     than inventing a second one, so this can never disagree with the
     gate it is reporting. */
  const assertions = (out.match(/(\d+) assertions · (\d+) failing/) || []).slice(1);
  const totals = (out.match(/TOTALS\s+(\{[^}]*\})/) || [])[1];
  const coarse = (out.match(/COARSE[^\n]*?(\d+) under the floor/) || [])[1];
  let detail;
  if (assertions.length) detail = `${assertions[0]} assertions, ${assertions[1]} failing`;
  else if (totals) {
    const sum = Object.values(JSON.parse(totals)).reduce((a, b) => a + b, 0);
    detail = `${sum} violations, ${coarse ?? "?"} under the coarse floor`;
  } else detail = code === 0 ? "pass" : "fail";
  results.push({ name: gate.name, code, detail, out });
}

const bad = results.filter((r) => r.code !== 0);
for (const r of results) {
  process.stdout.write(`${r.code === 0 ? "ok  " : "FAIL"} ${r.name.padEnd(10)} ${r.detail}\n`);
}
if (bad.length) {
  process.stdout.write(`\n${bad.length} gate(s) failing — the failing lines:\n`);
  for (const r of bad) {
    for (const line of r.out.split("\n")) {
      if (/^(FAIL|not ok)/i.test(line) || /to fix/.test(line)) process.stdout.write(`  ${r.name}: ${line.trim()}\n`);
    }
  }
}
process.exit(bad.length ? 1 : 0);
