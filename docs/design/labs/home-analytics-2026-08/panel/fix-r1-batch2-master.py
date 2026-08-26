# Round 1, batch 2 — the master reads its state before it builds its facts.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(HERE, "..")
p = os.path.join(LAB, "lately.html")
s = io.open(p, encoding="utf-8").read()

def sub(old, new, label):
    global s
    if old not in s:
        sys.stderr.write("MISS: %s\n" % label)
        sys.exit(2)
    s = s.replace(old, new, 1)
    print("  ok  %s" % label)

# ── the URL contract moves above the accessor ─────────────────────────
# D was built at module scope and the state was read forty lines later, so
# every degraded state was the full state's numbers with pieces removed.
# Reading the key first is what lets a state own its own facts.
sub(
    'const MOTIONS = ["play", "settled"];',
    'const MOTIONS = ["play", "settled"];\n'
    '\n'
    '/* ── The URL contract, read BEFORE the accessor ──────────────────\n'
    '   An unknown ?state=, ?v= or ?motion= STOPS. The Notes shot harness\n'
    '   took three variant keys the preset table did not contain and\n'
    '   silently graded the locked preset three times over; thirty-six of\n'
    '   forty frames per room were byte-identical and nobody noticed for\n'
    '   nine rounds. A surface that accepts a key it does not have shows\n'
    '   work that does not exist.\n'
    '   It is read here, above D, because a state has to be known before\n'
    '   its facts can be: assembling a degraded state out of the full\n'
    '   state\'s numbers is what let the quiet state say nothing was\n'
    '   sitting over three marks that were. */\n'
    'const q = new URLSearchParams(location.search);\n'
    'const wantState = q.get("state");\n'
    'const wantV = q.get("v");\n'
    'const wantMotion = q.get("motion");\n'
    'let fatal = null;\n'
    'if (wantState !== null && !STATES.includes(wantState)) fatal = `state=${wantState}`;\n'
    'if (wantV !== null && !VARIANTS.includes(wantV)) fatal = `v=${wantV}`;\n'
    'if (wantMotion !== null && !MOTIONS.includes(wantMotion)) fatal = `motion=${wantMotion}`;\n'
    '\n'
    '/* Default: play for a person, settled for a machine. ?motion=\n'
    '   overrides either way, so the choreography is still drivable under\n'
    '   automation and the gate can prove it runs. */\n'
    'const PLAY = wantMotion ? wantMotion === "play" : !navigator.webdriver;\n'
    'if (!PLAY) document.documentElement.setAttribute("data-motion", "settled");\n'
    '\n'
    'const state = fatal ? "full" : (wantState ?? "full");\n'
    'const variant = fatal ? "light" : (wantV ?? "light");',
    "url contract: read before the accessor",
)

sub(
    "const sum = (a) => a.reduce((x, y) => x + y, 0);\nconst D = {",
    "const sum = (a) => a.reduce((x, y) => x + y, 0);\n"
    "\n"
    "/* The state's own slice of the fixture. Emitted and guarded by\n"
    "   derive-fixture.mjs, which fails the build if a scope's sentence and\n"
    "   its marks disagree — so the contradiction cannot come back by hand. */\n"
    "const SCOPE = F.scopes[state] ?? F.scopes.full;\n"
    "const D = {",
    "accessor: read the scope",
)

sub(
    "  weeks: F.weeks,\n  jobs: F.jobs,\n  fortnight: F.fortnight,\n  open: F.bound.openCount,",
    "  weeks: state === \"first-run\" ? F.weeks.slice(-1) : F.weeks,\n"
    "  jobs: SCOPE.jobs,\n"
    "  fortnight: F.fortnight,\n"
    "  accountDays: F.accountDays,\n"
    "  comparisonArrives: F.comparisonArrives,\n"
    "  readingShort: F.readingShort,\n"
    "  open: F.bound.openCount,",
    "accessor: scoped jobs and weeks",
)

sub(
    "  sitting: F.status.sitting,\n  overdue: F.status.overdue,\n  unowned: F.status.unowned,\n  waiting: F.status.waiting,",
    "  sitting: SCOPE.status.sitting,\n"
    "  overdue: SCOPE.status.overdue,\n"
    "  unowned: SCOPE.status.unowned,\n"
    "  waiting: SCOPE.status.waiting,",
    "accessor: scoped status",
)

# ── the age axis is derived from its own data ─────────────────────────
sub(
    "D.oldest = Math.max(...D.jobs.map((j) => j.age));\nD.axisMax = Math.max(45, Math.ceil((D.oldest + 4) / 5) * 5);",
    "D.oldest = Math.max(...D.jobs.map((j) => j.age));\n"
    "/* Derived, never typed, and with no floor: a floor of 45 forced a\n"
    "   three-day-old account to draw a six-week ruler, and it was only\n"
    "   because the full state's oldest job rounds to exactly 45 that the\n"
    "   hard-coded ticks ever agreed with the marks they label. */\n"
    "D.axisMax = Math.max(5, Math.ceil((D.oldest + 2) / 5) * 5);\n"
    "/* A threshold nothing can cross is not drawn. On a three-day-old\n"
    "   account the fortnight line sits past the end of the axis, and a rule\n"
    "   no mark can reach reads as a rule every mark has beaten. */\n"
    "D.showsFortnight = D.fortnight <= D.axisMax;\n"
    "D.scaleMarks = D.axisMax <= 10\n"
    "  ? [0, D.axisMax]\n"
    "  : D.axisMax <= 20\n"
    "    ? [0, Math.round(D.axisMax / 2), D.axisMax]\n"
    "    : [0, Math.round(D.axisMax / 3), Math.round((2 * D.axisMax) / 3), D.axisMax];",
    "axis: derived, with its own ticks",
)

# ── the scale stands on its values ────────────────────────────────────
sub(
    ".strip-scale { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; color: var(--ink-3); }",
    "/* Every tick stands where its value stands. Distributed by flexbox the\n"
    "   marks landed on 0/33/67/100% of the strip whatever they said, and\n"
    "   agreed with the dots only because the shipped oldest job rounds the\n"
    "   axis to exactly 45. */\n"
    ".strip-scale { position: absolute; left: 0; right: 0; bottom: 0; height: 17px; color: var(--ink-3); }\n"
    ".strip-scale span { position: absolute; bottom: 0; left: calc(var(--x) * 1%); transform: translateX(-50%); }\n"
    ".strip-scale span:first-child { transform: none; }\n"
    ".strip-scale span:last-child { transform: translateX(-100%); }",
    "scale: positioned by value",
)

sub(
    '  const marks = [0, 15, 30, 45].filter((n) => n <= D.axisMax);',
    '  const marks = D.scaleMarks;',
    "scale: derived marks",
)

sub(
    '        <span class="strip-scale">${marks.map((n) => `<span class="t-unit" data-type="unit">${n === 0 ? "today" : n + "d"}</span>`).join("")}</span>',
    '        <span class="strip-scale">${marks.map((n) => `<span class="t-unit" data-type="unit" style="--x:${(n / D.axisMax) * 100}">${n === 0 ? "today" : n + "d"}</span>`).join("")}</span>',
    "scale: render at value",
)

sub(
    '      <div class="strip">\n        <span class="fortnight" style="--x:${(D.fortnight / D.axisMax) * 100}"><span class="t-label" data-type="label">A fortnight</span></span>',
    '      <div class="strip" data-axis-max="${D.axisMax}">\n'
    '        ${D.showsFortnight ? `<span class="fortnight" style="--x:${(D.fortnight / D.axisMax) * 100}"><span class="t-label" data-type="label">A fortnight</span></span>` : ""}',
    "strip: declare its axis, draw a crossable threshold only",
)

# ── every sentence agrees with its own numeral ────────────────────────
sub(
    'function kpi({ n, word, glyph, i, unavailable = false }) {\n'
    '  const known = !unavailable;\n'
    '  const share = known && D.open ? Math.min(1, n / D.open) : 0;\n'
    '  const name = known\n'
    '    ? `${plural(n, "job", "jobs")} ${word}, of ${plural(D.open, "job", "jobs")} open`\n'
    '    : `${word}: not available, because Timeline did not answer`;',
    '/* The phrase comes in both numbers and is picked by the count. A fixed\n'
    '   plural under a numeral that can be 1 printed "1 have nobody\'s name on\n'
    '   them" on screen and spoke it aloud. Zero keeps the plural, which is\n'
    '   already correct. */\n'
    'function kpi({ n, word, glyph, i, unavailable = false }) {\n'
    '  const known = !unavailable;\n'
    '  const phrase = n === 1 ? word.one : word.many;\n'
    '  const share = known && D.open ? Math.min(1, n / D.open) : 0;\n'
    '  const name = known\n'
    '    ? `${plural(n, "job", "jobs")} ${phrase}, of ${plural(D.open, "job", "jobs")} open`\n'
    '    : `Jobs ${word.many}: not available, because Timeline did not answer`;',
    "kpi: paired phrase",
)

sub(
    '      <span class="t-small dim-2" data-type="small">${esc(word)}</span>',
    '      <span class="t-small dim-2" data-type="small">${esc(known ? phrase : word.many)}</span>',
    "kpi: render the picked phrase",
)

sub(
    '        ${kpi({ n: D.sitting, word: "haven’t moved in a fortnight", glyph: ICON.still, i: 1 })}\n'
    '        ${kpi({ n: D.overdue, word: "past the day they were due", glyph: ICON.past, i: 2, unavailable: partial })}\n'
    '        ${kpi({ n: D.unowned, word: "have nobody’s name on them", glyph: ICON.nobody, i: 3 })}\n'
    '        ${kpi({ n: D.waiting, word: "are waiting on something else", glyph: ICON.waiting, i: 4 })}',
    '        ${kpi({ n: D.sitting, word: { one: "hasn’t moved in a fortnight", many: "haven’t moved in a fortnight" }, glyph: ICON.still, i: 1 })}\n'
    '        ${kpi({ n: D.overdue, word: { one: "is past the day it was due", many: "past the day they were due" }, glyph: ICON.past, i: 2, unavailable: partial })}\n'
    '        ${kpi({ n: D.unowned, word: { one: "has nobody’s name on it", many: "have nobody’s name on them" }, glyph: ICON.nobody, i: 3 })}\n'
    '        ${kpi({ n: D.waiting, word: { one: "is waiting on something else", many: "are waiting on something else" }, glyph: ICON.waiting, i: 4 })}',
    "kpi: pass both numbers",
)

sub(
    '          <p class="t-body dim-2" data-type="body">All ${plural(D.open, "open job", "open jobs")} has moved inside a fortnight, none is past its day, and every one has a name on it.</p>',
    '          <p class="t-body dim-2" data-type="body">${D.open === 1 ? "The one open job has" : `All ${D.open} open jobs have`} moved inside a fortnight, none is past its day, and every one has a name on it.</p>',
    "quiet: the sentence agrees with its own count",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 2 master (part 1) applied")
