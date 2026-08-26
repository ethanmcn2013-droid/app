# Round 1, batch 2 — second pass: retire the duplicated URL block, and
# rebuild the first-run chart as its own composition.
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

# The parse moved above the accessor; this second copy would shadow it and
# read the URL twice. One reading, one place.
sub(
    """/* ── The URL contract ───────────────────────────────────────────────────
   An unknown ?state= or ?v= STOPS. The Notes shot harness took three
   variant keys the preset table did not contain and silently graded the
   locked preset three times over; thirty-six of forty frames per room were
   byte-identical and nobody noticed for nine rounds. A surface that
   accepts a key it does not have shows work that does not exist. */
const q = new URLSearchParams(location.search);
const wantState = q.get("state");
const wantV = q.get("v");
let fatal = null;
const wantMotion = q.get("motion");
if (wantState !== null && !STATES.includes(wantState)) fatal = `state=${wantState}`;
if (wantV !== null && !VARIANTS.includes(wantV)) fatal = `v=${wantV}`;
if (wantMotion !== null && !MOTIONS.includes(wantMotion)) fatal = `motion=${wantMotion}`;

/* Default: play for a person, settled for a machine. ?motion= overrides
   either way, so the choreography is still drivable under automation and
   the gate can prove it runs. */
const PLAY = wantMotion ? wantMotion === "play" : !navigator.webdriver;
if (!PLAY) document.documentElement.setAttribute("data-motion", "settled");

const root = document.getElementById("root");""",
    """/* The keys were read at the top of this script, above the accessor, so
   that a state could own its own facts. What is left here is the render. */
const root = document.getElementById("root");""",
    "url contract: one reading, one place",
)

sub(
    "} else {\n  const state = wantState ?? \"full\";\n  const variant = wantV ?? \"light\";\n  document.body.dataset.state = state;",
    "} else {\n  document.body.dataset.state = state;",
    "render: use the state already resolved",
)

# ── the first-run chart is its own composition ────────────────────────
# One hatched column, centred in 686px of empty plot, at a height typed as
# a literal so the mark encoded nothing. It now stands at the pitch and
# width it will hold when the twelve-week chart arrives, and it says in
# words what it draws.
sub(
    '''        <div class="chart">
          <div class="plot">
            <span class="baseline"></span>
            <span class="cols"><span class="colw"><span class="bar part" style="--h:60;--i:0"></span><span class="bar-val t-label" data-type="label" style="--h:60">${D.thisWeek} so far</span></span></span>
          </div>
          <div class="xaxis"><span class="t-label" data-type="label">${esc(D.weeks[11].start)}</span></div>
        </div>''',
    '''        <div class="chart">
          <div class="plot solo">
            <span class="baseline"></span>
            <span class="cols"><span class="colw"><span class="bar part" style="--h:100;--i:0"></span><span class="bar-val t-label" data-type="label" style="--h:100">${D.thisWeek} so far</span></span></span>
          </div>
          <div class="xaxis"><span class="t-label" data-type="label">${esc(D.weeks[0].start)}</span></div>
          <p class="sr">This week so far: ${D.thisWeek} jobs finished, week commencing ${esc(D.weeks[0].start)}. There is no earlier week to compare it with; twelve weeks of history are not recorded yet.</p>
        </div>''',
    "first-run: a composition, not a chart with eleven weeks deleted",
)

sub(
    "          <p class=\"t-small dim hero-note\" data-type=\"small\">Four weeks of records make a comparison worth printing. Yours arrive on 10 August.</p>",
    "          <p class=\"t-small dim hero-note\" data-type=\"small\">Four weeks of records make a comparison worth printing. Yours arrive on ${esc(D.comparisonArrives)}.</p>",
    "first-run: the comparison date is derived from the first week of record",
)

sub(
    ".baseline { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); }",
    ".baseline { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); }\n"
    "/* One week, at the width and pitch it will hold when the other eleven\n"
    "   arrive. Drawing eleven faint slots beside it would be indistinguishable\n"
    "   from eleven weeks of zero, which the honest-degradation contract\n"
    "   forbids; and a gridline derived from a single datum labels the datum\n"
    "   with itself. So there is no scale here, because there is not one. */\n"
    ".plot.solo .cols { right: auto; width: 57px; }\n"
    ".plot.solo .baseline { right: auto; width: 57px; }\n"
    ".plot.solo .colw .bar-val { left: 0; right: auto; transform: none; }",
    "first-run: the solo plot",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 2 master (part 2) applied")
