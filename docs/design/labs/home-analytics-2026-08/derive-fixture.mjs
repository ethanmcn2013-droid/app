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

// The six lab-authored open jobs, in the order they take their ages.
const LAB_TITLES = [
  "Order tonic and the good olives",
  "Send the midweek rate to the June 2027 couple",
  "Approve the final seating plan",
  "Reprint the faded welcome sign",
  "Chase the boat operator on the crossing time",
  "Confirm the marquee sides with the hire company",
];

/* Every state gets its own ages, and they are a decision rather than a
   filter. A degraded state assembled from the full state's parts states one
   thing and draws another: the quiet state said nothing was sitting over
   three marks past the fortnight line and an oldest of 41 days, and the
   first-run state showed a six-week-old job on a three-day-old account.
   Both were found by seven blind seats and confirmed on refutation.
   The titles never change — the same nine jobs, the same three fixture
   titles verbatim and in order — so only the ages carry the state. */
const AGES = {
  // The tail — 19, 23, 41 — is the finding the strip exists to show; a
  // median of 9 hides all three of them.
  full: { fixture: [3, 9, 19], lab: [2, 5, 6, 11, 23, 41] },
  // Nothing sitting means nothing past the fortnight, in the data as well
  // as in the sentence.
  quiet: { fixture: [2, 6, 11], lab: [1, 3, 4, 7, 9, 12] },
  // An account three days old cannot hold work older than three days.
  "first-run": { fixture: [1, 2, 3], lab: [1, 1, 2, 2, 3, 3] },
};

const buildJobs = (scope) => {
  const a = AGES[scope];
  return [
    ...fixtureTitles.map((title, i) => ({ title, age: a.fixture[i] ?? 1, source: "fixture" })),
    ...LAB_TITLES.map((title, i) => ({ title, age: a.lab[i], source: "lab" })),
  ].sort((x, y) => x.age - y.age);
};

const jobs = buildJobs("full");
for (const scope of Object.keys(AGES)) {
  const set = buildJobs(scope);
  if (set.length !== openCount) {
    fail(
      `scope "${scope}" declares ${set.length} open jobs and the fixture declares ` +
      `activeRootTaskCount ${openCount}. The denominator every KPI card shares ` +
      `is the fixture's number, so every scope must carry exactly that many.`,
    );
  }
  if (fixtureTitles.some((t, i) => set.filter((j) => j.source === "fixture")[i]?.title !== t)) {
    fail(`scope "${scope}" lost one of the fixture's own root task titles`);
  }
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

const FORTNIGHT = 14;

/* The account's own age, in days, from the first week it has a record of to
   the instant it is read. Everything the first-run state may claim is
   bounded by this, and it is derived rather than typed. */
const accountDays = Math.round(
  (read.getTime() - new Date(weeks[weeks.length - 1].iso + "T00:00:00Z").getTime()) / 86400000,
);

/* The comparison arrives four weeks after the first week of record — not
   four weeks after today, which would be a different and wrong date. */
const arrivesAt = new Date(new Date(weeks[weeks.length - 1].iso + "T00:00:00Z").getTime() + 28 * 86400000);
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const comparisonArrives = `${arrivesAt.getUTCDate()} ${MONTHS_LONG[arrivesAt.getUTCMonth()]} ${arrivesAt.getUTCFullYear()}`;

const scope = (name, status) => {
  const set = buildJobs(name);
  const oldest = Math.max(...set.map((j) => j.age));
  for (const [key, n] of Object.entries(status)) {
    if (n > openCount) fail(`scope "${name}" status "${key}" is ${n} against a denominator of ${openCount}`);
  }
  const sitting = set.filter((j) => j.age >= FORTNIGHT).length;
  if (status.sitting !== sitting) {
    fail(
      `scope "${name}" claims ${status.sitting} sitting and draws ${sitting}. ` +
      `A state whose sentence disagrees with its own marks is the defect this ` +
      `derivation exists to make impossible.`,
    );
  }
  if (name === "first-run" && oldest > accountDays) {
    fail(`scope "first-run" holds a ${oldest}-day-old job in an account ${accountDays} days old`);
  }
  return { jobs: set, status, oldest };
};

const fixture = {
  boundTo: "src/lib/project-truth-fixture.ts",
  bound: { readingDate, owner, workspace, slug, openCount, fixtureTitles },
  labAuthored: { weeklyCompletions: true, jobAges: true, statusCounts: true },
  readingTime: "09:14",
  readingLong,
  readingShort: `${read.getUTCDate()} ${MONTHS[read.getUTCMonth()]}`,
  weeks,
  jobs,
  fortnight: FORTNIGHT,
  accountDays,
  comparisonArrives,
  // Status counts over the shared denominator, per scope. Lab-authored; each
  // is a subset of the nine, none may exceed it, and the sitting count is
  // checked against the ages that scope actually draws.
  status: { sitting: jobs.filter((j) => j.age >= FORTNIGHT).length, overdue: 2, unowned: 1, waiting: 0 },
  scopes: {
    full: scope("full", { sitting: 3, overdue: 2, unowned: 1, waiting: 0 }),
    quiet: scope("quiet", { sitting: 0, overdue: 0, unowned: 0, waiting: 0 }),
    "first-run": scope("first-run", { sitting: 0, overdue: 0, unowned: 1, waiting: 0 }),
  },
};

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
  `  denominator ${openCount} open, ${fixtureTitles.length} titles verbatim from the fixture\n` +
  `  account     ${accountDays} days of record; comparison arrives ${comparisonArrives}\n` +
  `  scopes      ${Object.entries(fixture.scopes).map(([k, v]) => `${k} oldest ${v.oldest}d`).join(" · ")}\n`,
);
