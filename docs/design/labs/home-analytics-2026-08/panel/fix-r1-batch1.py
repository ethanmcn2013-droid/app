# Round 1, batch 1 — eight confirmed findings, using each refuter's fix
# rather than the seat's where the refuter replaced it. Written to a file
# and run, never pasted through a shell.
import io, os, sys

LAB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
p = os.path.join(LAB, "lately.html")
s = io.open(p, encoding="utf-8").read()

def sub(old, new, label):
    global s
    if old not in s:
        sys.stderr.write("MISS: %s\n" % label)
        sys.exit(2)
    s = s.replace(old, new, 1)
    print("  ok  %s" % label)

# ── 1 · ua-margins-set-the-vertical-rhythm ────────────────────────────
# The browser's own 1em margins were setting most of this surface's
# vertical space: 27 elements, 748px, in seven values none of which is a
# rung, scaled by each element's font size. The source gate cannot see
# them, because the numbers never appear in the stylesheet. Six containers
# were leaning on that accident and are retuned onto real rungs.
sub(
    "* { box-sizing: border-box; }",
    "* { box-sizing: border-box; }\n"
    "/* The ladder is the only thing that sets vertical space. Left to the\n"
    "   browser, 27 elements carried 748px of margin in seven values, none\n"
    "   of them a rung, each scaled by its own font size — and audit.mjs\n"
    "   reads the SOURCE for raw px, so it could never see them. */\n"
    "h1, h2, h3, h4, p { margin: 0; }",
    "ua margins: reset",
)
sub(
    ".limit { padding: var(--gap-line); display: flex; flex-direction: column; gap: var(--gap-tight);",
    ".limit { padding: var(--gap-line); display: flex; flex-direction: column; gap: var(--gap-snug);",
    "ua margins: .limit retune",
)
sub(
    ".hero-fig { display: flex; flex-direction: column; justify-content: space-between; gap: var(--gap-room); }",
    ".hero-fig { display: flex; flex-direction: column; justify-content: space-between; gap: var(--gap-wide); }",
    "ua margins: .hero-fig retune",
)
sub(
    ".stack { display: flex; flex-direction: column; gap: var(--gap-tight); }",
    ".stack { display: flex; flex-direction: column; gap: var(--gap-line); }",
    "ua margins: .stack retune",
)
sub(
    ".ghost-say { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--gap-hair); text-align: center; }",
    ".ghost-say { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--gap-snug); text-align: center; }",
    "ua margins: .ghost-say retune",
)
sub(
    ".center { display: flex; flex-direction: column; align-items: center; gap: var(--gap-snug); text-align: center; padding-top: var(--gap-far); padding-bottom: var(--gap-far); }",
    "/* .center composes the quiet, empty and error states, so the reset\n"
    "   lands here hardest: its gaps were 53/27/23px of borrowed margin. */\n"
    ".center { display: flex; flex-direction: column; align-items: center; gap: var(--gap-line); text-align: center; padding-top: var(--gap-far); padding-bottom: var(--gap-far); }\n"
    ".center .btn { margin-top: var(--gap-tight); }",
    "ua margins: .center retune",
)
sub(
    ".band-head { display: flex; align-items: baseline; gap: var(--gap-snug); flex-wrap: wrap; padding-bottom: var(--gap-line); }",
    ".band-head { display: flex; align-items: baseline; gap: var(--gap-snug); flex-wrap: wrap; padding-bottom: var(--gap-room); }",
    "ua margins: .band-head retune",
)

# ── 2 · bar-val-overprints-axis-max ───────────────────────────────────
# Three labels were競 for one corner. The answer is to reserve a rail for
# them rather than dodge vertically: the columns inset, the labels do not.
sub(
    ".chart { display: flex; flex-direction: column; gap: var(--gap-tight); min-width: 0; }",
    "/* A label rail on the right. The axis maximum, the previous-best tag\n"
    "   and the live week's value all anchor to this edge; giving the marks\n"
    "   a gutter is what lets three labels coexist without dodging. */\n"
    ".chart { --gutter: 34px; display: flex; flex-direction: column; gap: var(--gap-tight); min-width: 0; }",
    "gutter: declare",
)
sub(
    ".cols { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: space-between; gap: var(--gap-hair); }",
    ".cols { position: absolute; top: 0; bottom: 0; left: 0; right: var(--gutter); display: flex; align-items: flex-end; justify-content: space-between; gap: var(--gap-hair); }",
    "gutter: inset the columns",
)
sub(
    ".xaxis { display: flex; justify-content: space-between; gap: var(--gap-hair); color: var(--ink-3); }",
    ".xaxis { display: flex; justify-content: space-between; gap: var(--gap-hair); color: var(--ink-3); padding-right: var(--gutter); }",
    "gutter: inset the ruler with them",
)
sub(
    ".bar-val { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--h) * 1% + 6px); color: var(--accent); white-space: nowrap; }",
    ".bar-val { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--h) * 1% + 6px); color: var(--accent); white-space: nowrap; }\n"
    "/* The live week is the last column, so its value reads out into the\n"
    "   rail rather than centring over a mark at the plot's edge. */\n"
    ".colw:last-child .bar-val { left: 100%; right: auto; transform: none; padding-left: var(--gap-tight); }",
    "gutter: read the live value into the rail",
)

# ── 3 · record-tag-never-paints ───────────────────────────────────────
# `animation-fill-mode: both` put the keyframe's clip-path above the
# settled override, permanently, so a label at top:-18px on a 1px-tall box
# was clipped out of existence in every state, ground and motion mode. The
# tag leaves the animated box; the rule keeps its draw-in.
sub(
    '.record { position: absolute; left: 0; right: 0; bottom: calc(var(--r) * 1%); height: 0; border-top: 1px dashed var(--line); animation: draw 0.6s var(--ease) both; animation-delay: 1.1s; }\n'
    '.record-tag { position: absolute; right: 0; top: -18px; color: var(--ink-3); background: var(--paper); padding-left: var(--gap-hair); }',
    "/* The rule animates; the label does not live inside it. A clip-path\n"
    "   keyframe with fill:both outranks any plain author declaration, so\n"
    "   anything that must paint has to sit outside the clipped box. */\n"
    ".record { position: absolute; left: 0; right: var(--gutter); bottom: calc(var(--r) * 1%); height: 0; border-top: 1px dashed var(--line); animation: draw 0.6s var(--ease) both; animation-delay: 1.1s; }\n"
    ".record-tag { position: absolute; right: 0; bottom: calc(var(--r) * 1%); color: var(--ink-3); background: var(--paper); padding-left: var(--gap-hair); margin-bottom: 4px; animation: rise 0.4s var(--ease) both; animation-delay: 1.5s; }",
    "record tag: out of the clipped box",
)
sub(
    '  const rec = record\n'
    '    ? `<span class="record" style="--r:${pct(D.bestPrior, max)}"><span class="record-tag t-label" data-type="label">Best week &middot; ${D.bestPrior}</span></span>`\n'
    "    : \"\";",
    "  /* --r is an inline custom property, so a sibling inherits nothing:\n"
    "     it is repeated deliberately, not by accident. */\n"
    "  const r = pct(D.bestPrior, max);\n"
    "  const rec = record\n"
    '    ? `<span class="record" style="--r:${r}"></span>` +\n'
    '      `<span class="record-tag t-label" data-type="label" style="--r:${r}">Best week &middot; ${D.bestPrior}</span>`\n'
    "    : \"\";",
    "record tag: sibling markup",
)

# ── 4 · partial-column-is-closed-at-the-top ───────────────────────────
# The protected contract says the current week is open-topped. The rule
# opened the BOTTOM edge — which sits on the baseline and is invisible —
# and capped the top with a solid indigo stroke and a 4px radius.
sub(
    ".bar.part {\n  background: repeating-linear-gradient(135deg, var(--accent) 0 2px, rgba(17, 17, 17, 0) 2px 6px);\n  border: 1px solid var(--accent);\n  border-bottom: 0;\n  border-radius: 4px 4px 0 0;\n}",
    "/* Two rails and a fill that runs out of the top. The bottom edge sits\n"
    "   on the baseline and is invisible, so opening it said nothing; the\n"
    "   top is the edge a reader reads a week's completeness from. */\n"
    ".bar.part {\n"
    "  background: repeating-linear-gradient(135deg, var(--accent) 0 2px, rgba(17, 17, 17, 0) 2px 6px);\n"
    "  border: 0;\n"
    "  border-left: 1px solid var(--accent);\n"
    "  border-right: 1px solid var(--accent);\n"
    "  border-radius: 0;\n"
    "  -webkit-mask-image: linear-gradient(to top, #000 72%, transparent 100%);\n"
    "  mask-image: linear-gradient(to top, #000 72%, transparent 100%);\n"
    "}",
    "partial column: open the top",
)

# ── 5 · kpi-row-shares-no-line ────────────────────────────────────────
# The row's whole argument is that five figures read one denominator. Its
# figures sat on two lines and its meters on two more.
sub(
    ".glyph { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 6px; background: var(--wash); }",
    ".glyph { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 6px; background: var(--wash); }\n"
    "/* One top slot, one floor. The lead card leads with a label where the\n"
    "   others lead with a glyph, so its slot is grown to match rather than\n"
    "   its numeral nudged; the word block takes the slack so a label that\n"
    "   wraps to two lines cannot move the mark beneath it. */\n"
    ".kpi.lead > .t-label { height: 20px; display: flex; align-items: center; }\n"
    ".kpi > .t-small { flex: 1 1 auto; }\n"
    ".kpi > .meter, .kpi > .t-label.dim { margin-top: auto; }",
    "kpi row: one line for figures and marks",
)

# ── 6 · kpi-row-and-ages-card-share-an-edge ───────────────────────────
# Zero space between the row and the strip, so two 1px hairlines stacked
# into a doubled seam and the pair read as one cracked card.
sub(
    ".ages { padding: var(--gap-room); }",
    ".ages { padding: var(--gap-room); margin-top: var(--gap-line); }",
    "ages card: stand off its neighbour",
)

# ── 7 · axis-ticks-go-ragged ──────────────────────────────────────────
# Twelve flex ticks wrapped inside their own column boxes in two measured
# bands, producing a ruler of mixed one- and two-line labels. Twelve
# columns stay twelve; only the labelling thins.
sub(
    ".xaxis span { flex: 1 1 0; text-align: center; }\n.xaxis span.mute { opacity: 0; }",
    ".xaxis span { flex: 1 1 0; min-width: 0; white-space: nowrap; text-align: center; }\n"
    "/* visibility, not opacity: an opacity-0 label is invisible to the eye\n"
    "   and fully present in the accessibility tree. */\n"
    ".xaxis span.mute { visibility: hidden; }\n"
    "/* The two bands where a tick wraps, measured rather than guessed:\n"
    "   1140-901 and 792 down. 900-793 is the widest the plot ever gets,\n"
    "   because the hero stacks there, and needs no thinning. */\n"
    "@media (max-width: 1140px) and (min-width: 901px), (max-width: 792px) {\n"
    "  .xaxis span:not(:only-child) { display: none; }\n"
    "  .xaxis span:not(:only-child):first-child,\n"
    "  .xaxis span:not(:only-child):nth-child(7),\n"
    "  .xaxis span:not(:only-child):last-child { display: block; flex: 0 0 auto; }\n"
    "}",
    "week ruler: one line at every width",
)

# ── 8 · reading-rule-dangles-at-390 ───────────────────────────────────
# A connector joins two things. When the row wraps it joined the date to
# the page edge and pointed at nothing, while its other end sat below it.
sub(
    "@media (max-width: 560px) {\n  .rail { display: none; }",
    "/* Below 600 the reading wraps, so the connector is retired and the two\n"
    "   stamps join with the middot the rest of the surface already uses.\n"
    "   The separator LEADS the second stamp — a trailing one is the same\n"
    "   dangling mark in a heavier weight. */\n"
    "@media (max-width: 600px) {\n"
    "  .reading { gap: var(--gap-tight); }\n"
    "  .reading .rule { display: none; }\n"
    "  .reading p:not(:first-child)::before { content: \"\\00b7\\00a0\"; }\n"
    "}\n"
    "@media (max-width: 560px) {\n  .rail { display: none; }",
    "reading rule: retire it when it joins nothing",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 1 applied")
