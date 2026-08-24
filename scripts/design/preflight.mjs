/* Everything that must be true before a panel sees anything.
 *
 *   node scripts/design/preflight.mjs            # check only
 *   node scripts/design/preflight.mjs --shoot    # re-shoot first
 *   node scripts/design/preflight.mjs --build    # rebuild the artifacts too
 *
 * Round 12 opened with the published frames nine commits stale and the app's
 * stylesheet 209 lines behind the master it is generated from. Nothing said
 * so, because every one of those steps was a thing a person had to remember.
 * This is the memory. It exits non-zero when the round is not safe to run.
 */
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const LAB = "docs/design/labs/tasks-2026-08";
const SHOOT = process.argv.includes("--shoot");
const BUILD = process.argv.includes("--build");

const steps = [];
function run(name, args, why) {
  const t = Date.now();
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  const pass = r.status === 0;
  steps.push({ name, pass, why, ms: Date.now() - t, tail: (r.stdout || r.stderr || "").trim().split("\n").slice(-2).join(" | ") });
  return pass;
}

/* 1. The frames the panel reads must come from the master as it stands. */
if (SHOOT) run("shots", ["scripts/design/lab-shots.mjs"], "every state and viewport, re-shot from the current master");

/* 2. The two gates. */
run("audit", ["scripts/design/audit.mjs"], "palette, weights, families, contrast, targets, radii, motion");
run("behaviour", ["scripts/design/interaction-check.mjs"], "the board driven, not read");

/* 3. The master is the source of the app's stylesheet. Drift here is the
      defect that made round 12's opening frames a lie. */
run("master -> app css", ["scripts/design/extract-floor-css.mjs", "--check"],
  "floor.module.css is what the master would generate");

/* 4. The published artifacts must not be older than the master. A frame the
      founder is looking at that predates the file is the same defect wearing
      a different hat. */
{
  const t = Date.now();
  let pass = false;
  let tail = "";
  try {
    const master = await stat(path.join(LAB, "floor.html"));
    const panel = await stat(path.join(LAB, "panel.json"));
    const report = await stat(path.join(LAB, "report.html"));
    const console_ = await stat(path.join(LAB, "customizer.html"));
    const newestSource = Math.max(master.mtimeMs, panel.mtimeMs);
    const oldestBuild = Math.min(report.mtimeMs, console_.mtimeMs);
    pass = oldestBuild >= newestSource;
    tail = pass
      ? "both artifacts are newer than the master and the record"
      : `stale by ${Math.round((newestSource - oldestBuild) / 1000)}s — rebuild with --build`;
  } catch (e) {
    tail = String(e.message || e);
  }
  steps.push({ name: "artifacts fresh", pass, why: "the panel and the founder see the same object", ms: Date.now() - t, tail });
}

if (BUILD) {
  run("build console", ["scripts/design/build-customizer.mjs"], "the Design Console");
  run("build log", ["scripts/design/build-report.mjs"], "the Elevation Log");
  run("verify console", ["scripts/design/console-check.mjs"], "it renders and the board works inside it");
  run("verify log", ["scripts/design/verify-report.mjs"], "it renders in both themes and on a phone");
}

/* 5. The gate may only grow. It is the loop's memory: every assertion in it was
      added because a seat found the defect it guards, and 299 of them are worth
      more than any single round's score. A change that shrinks it is either a
      regression being quietly dropped or a rule being weakened to pass. */
{
  const t = Date.now();
  let pass = false;
  let tail = "";
  try {
    const gate = await readFile("scripts/design/interaction-check.mjs", "utf8");
    const now = (gate.match(/ok\(/g) || []).length;
    let floorCount = 0;
    try {
      floorCount = JSON.parse(await readFile(path.join(LAB, "gate-floor.json"), "utf8")).assertions;
    } catch { floorCount = 0; }
    pass = now >= floorCount;
    tail = pass
      ? `${now} assertions, never fewer than the ${floorCount} recorded`
      : `${now} assertions against a recorded floor of ${floorCount} — the gate shrank`;
  } catch (e) {
    tail = String(e.message || e);
  }
  steps.push({ name: "gate only grows", pass, why: "the loop's memory is never traded for a score", ms: Date.now() - t, tail });
}

/* 6. The surface is frozen, so every confirmed finding must leave a rule behind
      rather than a patched instance. A round recorded with confirmed findings
      and no growth in the gate is the failure mode that let one defect class
      recur three times over fifteen rounds. */
{
  const t = Date.now();
  let pass = false;
  let tail = "";
  try {
    const panel = JSON.parse(await readFile(path.join(LAB, "panel.json"), "utf8"));
    const last = panel.rounds[panel.rounds.length - 1];
    const gate = await readFile("scripts/design/interaction-check.mjs", "utf8");
    const now = (gate.match(/ok\(/g) || []).length;
    pass = !last.confirmed || last.gateAfter === undefined || now >= last.gateAfter;
    tail = last.gateAfter === undefined
      ? `round ${last.round} predates the rule; nothing to check`
      : `round ${last.round} left the gate at ${last.gateAfter}, now ${now}`;
  } catch (e) {
    tail = String(e.message || e);
  }
  steps.push({ name: "rules, not patches", pass, why: "every confirmed finding leaves an assertion behind", ms: Date.now() - t, tail });
}

/* 7. The record must not claim a round that is not there, and must not have
      quietly lost one. */
{
  const t = Date.now();
  let pass = false;
  let tail = "";
  try {
    const panel = JSON.parse(await readFile(path.join(LAB, "panel.json"), "utf8"));
    const numbers = panel.rounds.map((r) => r.round);
    const contiguous = numbers.every((n, i) => n === i + 1);
    const finals = panel.rounds.filter((r) => r.final && !r.supersededBy);
    pass = contiguous && finals.length === 0;
    tail = contiguous
      ? finals.length
        ? `round ${finals[0].round} is marked final and nothing supersedes it`
        : `${numbers.length} rounds, 1..${numbers.length}, none left claiming to be final`
      : `rounds are not contiguous: ${numbers.join(",")}`;
  } catch (e) {
    tail = String(e.message || e);
  }
  steps.push({ name: "record intact", pass, why: "the arc is whole and nothing claims to be the end", ms: Date.now() - t, tail });
}

let bad = 0;
process.stdout.write("\n");
for (const s of steps) {
  if (!s.pass) bad += 1;
  process.stdout.write(
    `  ${s.pass ? "pass" : "FAIL"}  ${s.name.padEnd(18)} ${String(Math.round(s.ms / 100) / 10 + "s").padStart(7)}  ${s.why}\n` +
    (s.tail ? `        ${s.tail}\n` : ""),
  );
}
process.stdout.write(
  "\n" + (bad ? `${bad} of ${steps.length} preflight checks failed — do not run the round\n`
    : `${steps.length}/${steps.length} — the round is safe to run\n`),
);
process.exit(bad ? 1 : 0);
