// Bind the lab to `src/lib/project-truth-fixture.ts`, and fail when it drifts.
//
//   node derive-fixture.mjs            # rewrite fixture.js, exit 0
//   node derive-fixture.mjs --check    # verify fixture.js matches, exit 2 on drift
//
// WHY THIS EXISTS. The first prototype of Lately carried hand-authored
// numbers and an invented venue ("The Orchard, events · Mara & Finn") that
// appears nowhere in the shipping fixture. A lab that invents its own data
// cannot tell you whether the product would render the same thing, so every
// reading it produces is unfalsifiable. This script reads the real fixture
// and refuses to emit anything the fixture contradicts.
//
// WHAT IS BOUND, AND WHAT IS LAB-AUTHORED. Four facts are read straight out
// of the TypeScript and are build-failing if they move:
//
//   readingDate   PROJECT_TRUTH_TODAY
//   owner         PROJECT_TRUTH_ACTOR.name
//   workspace     the harbourHouse project's `name`
//   openCount     that project's `activeRootTaskCount`
//
// and the first three open jobs are its `rootTaskTitles`, verbatim, in order.
//
// The fixture is a project catalogue: it carries no completion timestamps and
// no per-task ages, so twelve weeks of completions and nine job ages CANNOT be
// derived from it. Those are lab-authored, marked `labAuthored: true` in the
// emitted file, and named as such on the surface's own provenance line. That
// is the honest position — inventing a derivation would be the same defect in
// better handwriting.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(HERE, "../../../../src/lib/project-truth-fixture.ts");
const OUT = path.join(HERE, "fixture.js");
const CHECK = process.argv.includes("--check");

const fail = (message) => {
  process.stderr.write(`drift: ${message}\n`);
  process.exit(2);
};

let ts;
try {
  ts = await readFile(SOURCE, "utf8");
} catch {
  fail(`cannot read ${SOURCE} — the lab has lost sight of the fixture it claims to derive from`);
}

// ── read the four bound facts ───────────────────────────────────────────────

const readingDate = (ts.match(/PROJECT_TRUTH_TODAY\s*=\s*"([0-9-]+)"/) || [])[1];
if (!readingDate) fail("PROJECT_TRUTH_TODAY not found");

const owner = (ts.match(/PROJECT_TRUTH_ACTOR\s*=\s*\{[^}]*?name:\s*"([^"]+)"/s) || [])[1];
if (!owner) fail("PROJECT_TRUTH_ACTOR.name not found");

// The reference Project — role primary-owner, the one every other lab in the
// estate reads. Located by its id constant so a rename of the display name is
// a drift finding rather than a silent miss.
const summaryBlock = (ts.match(/id:\s*PROJECT_TRUTH_IDS\.harbourHouse,[\s\S]*?disambiguator:/) || [])[0];
if (!summaryBlock) fail("the harbourHouse project summary was not found");

const workspace = (summaryBlock.match(/name:\s*"([^"]+)"/) || [])[1];
const slug = (summaryBlock.match(/slug:\s*"([^"]+)"/) || [])[1];
const openCount = Number((summaryBlock.match(/activeRootTaskCount:\s*(\d+)/) || [])[1]);
if (!workspace || !slug || !Number.isFinite(openCount)) {
  fail("the harbourHouse project summary no longer declares name, slug and activeRootTaskCount");
}

const contentBlock = (ts.match(/projectId:\s*PROJECT_TRUTH_IDS\.harbourHouse,[\s\S]*?layoutStress:/) || [])[0];
if (!contentBlock) fail("the harbourHouse content entry was not found");
const titlesRaw = (contentBlock.match(/rootTaskTitles:\s*\[([\s\S]*?)\]/) || [])[1] ?? "";
const fixtureTitles = Array.from(titlesRaw.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
if (fixtureTitles.length === 0) fail("harbourHouse declares no rootTaskTitles");

// ── lab-authored extension, held to the bound facts ─────────────────────────

// Ages in days at the reading date. The tail — 19, 23, 41 — is the finding the
// ages strip exists to show; a median of 9 hides all three of them.
const LAB_JOBS = [
  { age: 2, title: "Order tonic and the good olives" },
  { age: 5, title: "Send the midweek rate to the June 2027 couple" },
  { age: 6, title: "Approve the final seating plan" },
  { age: 11, title: "Reprint the faded welcome sign" },
  { age: 23, title: "Chase the boat operator on the crossing time" },
  { age: 41, title: "Confirm the marquee sides with the hire company" },
];

// The three fixture titles take the ages that make the strip's shape true:
// two recent, one at the fortnight line.
const FIXTURE_AGES = [3, 9, 19];

const jobs = [
  ...fixtureTitles.map((title, i) => ({
    title,
    age: FIXTURE_AGES[i] ?? 1,
    source: "fixture",
  })),
  ...LAB_JOBS.map((j) => ({ ...j, source: "lab" })),
].sort((a, b) => a.age - b.age);

if (jobs.length !== openCount) {
  fail(
    `the lab declares ${jobs.length} open jobs and the fixture declares ` +
    `activeRootTaskCount ${openCount}. The denominator every KPI card shares ` +
    `is the fixture's number, so the lab must carry exactly that many.`,
  );
}

// Twelve weeks of completions, week-commencing Monday, ending on the week that
// contains the reading date. Lab-authored: the fixture records no completion
// instants, so there is nothing here to derive from.
const WEEKLY = [5, 3, 6, 4, 7, 5, 8, 6, 6, 8, 5, 12];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const read = new Date(`${readingDate}T00:00:00Z`);
if (Number.isNaN(read.getTime())) fail(`PROJECT_TRUTH_TODAY "${readingDate}" is not a date`);
// Monday of the reading week.
const dow = (read.getUTCDay() + 6) % 7;
const thisMonday = new Date(read.getTime() - dow * 86400000);

const weeks = WEEKLY.map((v, i) => {
  const start = new Date(thisMonday.getTime() - (WEEKLY.length - 1 - i) * 7 * 86400000);
  return {
    start: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`,
    iso: start.toISOString().slice(0, 10),
    v,
    partial: i === WEEKLY.length - 1,
  };
});

const READING_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const readingLong =
  `09:14, ${READING_WEEKDAYS[read.getUTCDay()]} ${read.getUTCDate()} ` +
  `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][read.getUTCMonth()]} ` +
  `${read.getUTCFullYear()}`;

const fixture = {
  boundTo: "src/lib/project-truth-fixture.ts",
  bound: { readingDate, owner, workspace, slug, openCount, fixtureTitles },
  labAuthored: { weeklyCompletions: true, jobAges: true, statusCounts: true },
  readingTime: "09:14",
  readingLong,
  weeks,
  jobs,
  fortnight: 14,
  // Status counts over the shared denominator. Lab-authored; each is a subset
  // of the nine, and none may exceed it.
  status: { sitting: jobs.filter((j) => j.age >= 14).length, overdue: 2, unowned: 1, waiting: 0 },
};

for (const [key, n] of Object.entries(fixture.status)) {
  if (n > openCount) fail(`status "${key}" is ${n} against a denominator of ${openCount}`);
}

const body =
  "/* GENERATED by derive-fixture.mjs — do not edit.\n" +
  "   Four facts are bound to src/lib/project-truth-fixture.ts and fail the\n" +
  "   build on drift: the reading date, the owner, the workspace name and the\n" +
  "   open-work denominator. Weekly completions, job ages and status counts are\n" +
  "   lab-authored, because the fixture is a project catalogue and records no\n" +
  "   completion instants to derive them from. The surface says so on screen. */\n" +
  "window.LATELY_FIXTURE = " + JSON.stringify(fixture, null, 2) + ";\n";

if (CHECK) {
  let current = "";
  try { current = await readFile(OUT, "utf8"); } catch { fail("fixture.js has not been generated"); }
  if (current !== body) fail("fixture.js is stale — run `node derive-fixture.mjs`");
  process.stdout.write(`fixture bound · ${workspace} · ${owner} · ${readingDate} · ${openCount} open\n`);
  process.exit(0);
}

await writeFile(OUT, body, "utf8");
process.stdout.write(
  `fixture.js written\n` +
  `  workspace   ${workspace} (${slug})\n` +
  `  owner       ${owner}\n` +
  `  reading     ${readingLong}\n` +
  `  denominator ${openCount} open, ${fixtureTitles.length} titles verbatim from the fixture\n`,
);
