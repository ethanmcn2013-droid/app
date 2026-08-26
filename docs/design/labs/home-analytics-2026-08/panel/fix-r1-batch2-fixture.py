# Round 1, batch 2 — the degraded states get their own slice of the lab
# fixture, emitted by derive-fixture.mjs and guarded there.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(HERE, "..")
p = os.path.join(LAB, "derive-fixture.mjs")
s = io.open(p, encoding="utf-8").read()

def sub(old, new, label):
    global s
    if old not in s:
        sys.stderr.write("MISS: %s\n" % label)
        sys.exit(2)
    s = s.replace(old, new, 1)
    print("  ok  %s" % label)

sub(
    """// Ages in days at the reading date. The tail — 19, 23, 41 — is the finding the
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
}""",
    """// The six lab-authored open jobs, in the order they take their ages.
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
}""",
    "derive: per-scope ages",
)

sub(
    """const fixture = {
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
}""",
    """const FORTNIGHT = 14;

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
};""",
    "derive: scopes with their own guards",
)

sub(
    """  `  denominator ${openCount} open, ${fixtureTitles.length} titles verbatim from the fixture\\n`,""",
    """  `  denominator ${openCount} open, ${fixtureTitles.length} titles verbatim from the fixture\\n` +
  `  account     ${accountDays} days of record; comparison arrives ${comparisonArrives}\\n` +
  `  scopes      ${Object.entries(fixture.scopes).map(([k, v]) => `${k} oldest ${v.oldest}d`).join(" · ")}\\n`,""",
    "derive: report the scopes",
)

io.open(p, "w", encoding="utf-8").write(s)
print("derive-fixture patched")
