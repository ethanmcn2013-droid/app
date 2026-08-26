# Round 1, batch 3 — seven confirmed findings.
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

# ── 1 · hero-total-folds-the-unfinished-week ──────────────────────────
# The hatch, the open top and the "so far" label all quarantine the running
# week, and the headline folded it in anyway: 31 against 26 reads +5, while
# the same window of whole weeks reads 19 against 26. The caveat goes on the
# two lines that have room, not into a 189px pill that cannot hold it.
sub(
    '        <p class="t-label dim" data-type="label">Last four weeks &middot; ${esc(D.weeks[8].start)} to ${esc(D.weeks[11].start)}</p>',
    '        <p class="t-label dim" data-type="label">Last four weeks &middot; ${esc(D.weeks[D.weeks.length - 4].start)} to ${esc(D.readingShort)}</p>',
    "hero: the window ends on the reading",
)
sub(
    '          <p class="t-body dim-2 hero-note" data-type="body">jobs finished, ${esc(D.workspace)}</p>',
    '          <p class="t-body dim-2 hero-note" data-type="body">jobs finished, ${esc(D.workspace)}${D.weeks[D.weeks.length - 1].partial ? " &mdash; this week still running" : ""}</p>',
    "hero: name the running week where the figure is read",
)

# ── 2 · error-state-invents-a-last-good-reading ───────────────────────
# The fixture holds exactly one instant and the error state printed it three
# times under three labels, one of which asserted a reading had succeeded at
# the moment of the failure. There is no earlier reading to name, so none is
# claimed; a conditional the data can never satisfy is a promise, not a fix.
sub(
    '          <p class="t-label dim" data-type="label">Last good reading &middot; ${esc(D.readingLong)}</p>\n',
    '',
    "error: claim no reading it does not hold",
)

# ── 3 · mark-hit-theft-at-390 ─────────────────────────────────────────
# The row pitch was 15px and every mark carried a 34px circular expander, so
# a stacked mark's box covered its neighbour's centre and a tap answered
# with a different job's title and a different day count. Only 29% and 36%
# of two marks' own boxes resolved to themselves.
sub(
    "  position: absolute; bottom: calc(20px + var(--row, 0) * 20px); width: 12px; height: 12px; border-radius: 999px;",
    "  position: absolute; bottom: calc(20px + var(--row, 0) * 20px); width: 12px; height: 12px; border-radius: 999px;",
    "dot: pitch already at 20 (no-op guard)",
) if False else None

sub(
    "  position: absolute; bottom: calc(20px + var(--row, 0) * 15px); width: 12px; height: 12px; border-radius: 999px;",
    "  position: absolute; bottom: calc(20px + var(--row, 0) * 20px); width: 12px; height: 12px; border-radius: 999px;",
    "dot: a 20px row pitch",
)
sub(
    '.dot::after { content: ""; position: absolute; top: -11px; right: -11px; bottom: -11px; left: -11px; border-radius: 999px; }',
    "/* The expander is a stadium, not a circle, and it is shorter than the\n"
    "   row pitch. At -11px on every side a stacked mark's box reached its\n"
    "   neighbour's centre, and euclidean distance — which the gate was\n"
    "   measuring — cannot see occlusion. 34x28 still clears the 28px floor. */\n"
    '.dot::after { content: ""; position: absolute; top: -8px; right: -11px; bottom: -8px; left: -11px; border-radius: 14px; }',
    "dot: an expander that cannot cross a row",
)
sub(
    "    const MIN = 16;",
    "    /* 20px, against a 17px expander half-width, so no mark's box can\n"
    "       reach another mark's centre at any density. */\n"
    "    const MIN = 20;",
    "de-swarm: 20px minimum separation",
)
sub(
    "    strip.style.minHeight = `${92 + Math.max(0, rows.length - 1) * 15}px`;",
    "    strip.style.minHeight = `${92 + Math.max(0, rows.length - 1) * 20}px`;",
    "de-swarm: the strip grows with the pitch",
)

# ── 4 · two-capitalisation-rules-in-one-tab-strip ─────────────────────
sub(
    '<a class="tab t-body" data-type="control" href="#">Full briefing</a>',
    '<a class="tab t-body" data-type="control" href="#">Full Briefing</a>',
    "tabs: the contract's own name",
)

# ── 5 · partial-drops-the-best-week-unannounced ───────────────────────
# Timeline governs due dates. The twelve weekly counts and the previous best
# come from Tasks, which answered — so the mark was removed for a reason the
# screen never gave. The flag is derived rather than typed per state, so no
# future state can switch a knowable mark off by hand.
sub(
    "  partial: () => shell(movementOne({ record: false }) + movementTwo({ partial: true }) + movementThree()),",
    "  partial: () => shell(movementOne() + movementTwo({ partial: true }) + movementThree()),",
    "partial: keep the mark its source can answer for",
)
sub(
    "function movementOne({ record = true } = {}) {",
    "/* The previous best is drawn whenever it is knowable — two or more weeks\n"
    "   of record — and never switched off per state. A mark that vanishes for\n"
    "   a reason the screen does not give teaches that when something is\n"
    "   wrong, marks disappear quietly. */\n"
    "function movementOne({ record = D.weeks.length > 1 } = {}) {",
    "movementOne: derive the record flag",
)

# ── 6 · chart-is-announced-twice ──────────────────────────────────────
# The chart carries a written equivalent and left every piece of visual
# furniture in the accessibility tree beside it — including seven x-axis
# dates that are not on the screen, because .mute hid them with opacity.
sub(
    '      <div class="plot">\n        ${grid}',
    '      <div class="plot" aria-hidden="true">\n        ${grid}',
    "chart: the plot is drawn, not spoken",
)
sub(
    '      <div class="xaxis">${ticks}</div>',
    '      <div class="xaxis" aria-hidden="true">${ticks}</div>',
    "chart: the ruler is drawn, not spoken",
)
sub(
    '          <div class="plot solo">',
    '          <div class="plot solo" aria-hidden="true">',
    "first-run: the solo plot is drawn, not spoken",
)
sub(
    '          <div class="xaxis"><span class="t-label" data-type="label">${esc(D.weeks[0].start)}</span></div>',
    '          <div class="xaxis" aria-hidden="true"><span class="t-label" data-type="label">${esc(D.weeks[0].start)}</span></div>',
    "first-run: its ruler too",
)

# ── 7 · terminal-states-lose-their-heading-and-announce-nothing ───────
sub(
    '    <section class="band">\n      <div class="card rise" style="--i:0">\n        <div class="center">\n          <p class="t-sect" data-type="sect">No work recorded yet</p>',
    '    <section class="band" aria-labelledby="mEmpty">\n'
    '      <div class="card rise" style="--i:0">\n'
    '        <div class="center">\n'
    '          <h2 class="t-sect" id="mEmpty" data-type="sect">No work recorded yet</h2>',
    "empty: a real heading, named",
)
sub(
    '    <section class="band">\n      <div class="card rise" style="--i:0">\n        <div class="center">\n          <p class="t-sect" data-type="sect">Tasks did not answer</p>\n          <p class="t-body dim-2" data-type="body">This reading needs the Tasks records and they did not come back. Nothing below is shown, because a part of this screen would be guessing.</p>',
    '    <section class="band" aria-labelledby="mError">\n'
    '      <div class="card rise" style="--i:0">\n'
    '        <div class="center">\n'
    '          <div role="alert">\n'
    '            <h2 class="t-sect" id="mError" data-type="sect">Tasks did not answer</h2>\n'
    '            <p class="t-body dim-2" data-type="body">This reading needs the Tasks records and they did not come back. Nothing below is shown, because a part of this screen would be guessing.</p>\n'
    '          </div>',
    "error: a real heading, announced once",
)
sub(
    '`<p class="sr">Loading this reading.</p>`),',
    '`<p class="sr" role="status">Loading this reading.</p>`),',
    "loading: announce politely",
)
sub(
    '    <section class="band" aria-busy="true">\n      <div class="band-head">${fill("t-sect", "180px", "sect")}</div>',
    '    <section class="band" aria-busy="true">\n      <div class="band-head">${fill("t-sect", "180px", "sect")}</div>',
    "loading: (no-op)",
) if False else None

io.open(p, "w", encoding="utf-8").write(s)
print("batch 3 applied")
