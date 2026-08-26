# Round 2, batch 6 — the loading state, the two axes, and the row's role.
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

# ── 9 · loading-frame-is-a-movement-short ─────────────────────────────
# The skeleton drew two movements of three and stopped, so it promised a
# page a third shorter than the one that arrives — and the movement it
# dropped is the protected one. Movement three reads no data at all: its
# three refusals and its twelve ghost heights are constants, true before
# any source answers, so it arrives complete rather than as skeleton.
sub(
    '  loading: () => shell(\n    `<div class="sk-wrap" aria-hidden="true">${movementOne() + movementTwo()}</div>` +\n    `<p class="sr" role="status">Loading this reading.</p>`),',
    '  loading: () => shell(\n'
    '    `<div class="sk-wrap" aria-hidden="true">${movementOne() + movementTwo()}</div>` +\n'
    '    `<p class="sr" role="status">Loading this reading.</p>` +\n'
    '    /* The refusals need no source, so they arrive whole rather than as\n'
    "       skeleton, and the frame becomes the height of the page that\n"
    "       follows instead of two thirds of it. */\n"
    '    movementThree()),',
    "loading: draw every section that arrives",
)

# ── 10 · skeleton-draws-the-data-it-says-it-is-still-reading ──────────
# The skeleton was the arrived reading with its ink out — the real weekly
# shape, the real ages, the previous best's height, and a zero-width meter
# standing for a number nobody had read. In the product this branch cannot
# be built at all from a client that holds none of it.
sub(
    "  for (const el of root.querySelectorAll(\".sk-wrap .sr\")) el.remove();",
    "  /* A state that says it is still reading may not publish the reading.\n"
    "     Every magnitude is neutralised in place — heights, fills, ages, the\n"
    "     partial-week treatment and the previous-best tag — so the geometry\n"
    "     survives and the numbers do not leak. Done before the de-swarm, so\n"
    "     nothing downstream has to be re-run. */\n"
    "  if (state === \"loading\") {\n"
    "    const wrap = root.querySelector(\".sk-wrap\");\n"
    "    if (wrap) {\n"
    "      for (const b of wrap.querySelectorAll(\".bar\")) { b.style.setProperty(\"--h\", 46); b.classList.remove(\"part\"); }\n"
    "      for (const v of wrap.querySelectorAll(\".bar-val\")) v.style.setProperty(\"--h\", 46);\n"
    "      for (const m of wrap.querySelectorAll(\".meter i\")) { m.style.setProperty(\"--f\", 0.4); m.classList.remove(\"zero\"); }\n"
    "      const dots = Array.from(wrap.querySelectorAll(\".dot\"));\n"
    "      dots.forEach((d, i) => d.style.setProperty(\"--x\", ((i + 0.5) / dots.length) * 100));\n"
    "    }\n"
    "  }\n"
    "  for (const el of root.querySelectorAll(\".sk-wrap .sr\")) el.remove();",
    "loading: publish no reading",
)
sub(
    ".sk-wrap svg, .sk-wrap .record, .sk-wrap .fortnight { visibility: hidden; }",
    "/* The tag goes with the rule it labels: hiding one and not the other left\n"
    "   a wash box floating at the true previous-best height. */\n"
    ".sk-wrap svg, .sk-wrap .record, .sk-wrap .record-tag, .sk-wrap .fortnight { visibility: hidden; }",
    "loading: the tag goes with its rule",
)
# The accessor must survive a client that holds nothing, which is the
# condition the loading state exists for.
sub(
    "  weeks: state === \"first-run\" ? F.weeks.slice(-1) : F.weeks,\n  jobs: SCOPE.jobs,",
    "  /* A client that is still reading holds no weeks and no jobs. The state\n"
    "     that draws that condition must not throw on it. */\n"
    "  weeks: state === \"first-run\" ? (F.weeks ?? []).slice(-1) : (F.weeks ?? []),\n"
    "  jobs: SCOPE.jobs ?? [],",
    "accessor: survive an empty reading",
)
sub(
    "D.oldest = Math.max(...D.jobs.map((j) => j.age));",
    "D.oldest = D.jobs.length ? Math.max(...D.jobs.map((j) => j.age)) : 0;",
    "accessor: an empty strip has no oldest",
)
sub(
    "D.peak = Math.max(...D.weeks.map((w) => w.v));",
    "D.peak = D.weeks.length ? Math.max(...D.weeks.map((w) => w.v)) : 0;",
    "accessor: an empty chart has no peak",
)
sub(
    "  bestPrior: Math.max(...F.weeks.slice(0, -1).map((w) => w.v)),",
    "  bestPrior: (F.weeks ?? []).length > 1 ? Math.max(...F.weeks.slice(0, -1).map((w) => w.v)) : 0,",
    "accessor: an empty chart has no previous best",
)
sub(
    "  thisWeek: F.weeks[F.weeks.length - 1].v,",
    "  thisWeek: (F.weeks ?? []).length ? F.weeks[F.weeks.length - 1].v : 0,",
    "accessor: an empty chart has no current week",
)

# ── 11 · week-ticks-spread-by-flexbox-when-they-are-thinned ───────────
# The r1 thinning switched the three survivors to flex: 0 0 auto in a
# space-between row, so they were distributed by the container rather than
# standing on their weeks — the same mechanism the age axis was fixed for,
# surviving on the week axis. Hiding rather than removing keeps the flex
# basis; making the survivor a flex container centres its ink on its own
# box even when the label is wider than the column.
sub(
    "@media (max-width: 1140px) and (min-width: 901px), (max-width: 792px) {\n"
    "  .xaxis span:not(:only-child) { display: none; }\n"
    "  .xaxis span:not(:only-child):first-child,\n"
    "  .xaxis span:not(:only-child):nth-child(7),\n"
    "  .xaxis span:not(:only-child):last-child { display: block; flex: 0 0 auto; }\n"
    "}",
    "@media (max-width: 1140px) and (min-width: 901px), (max-width: 792px) {\n"
    "  .xaxis span:not(:only-child) { display: flex; justify-content: center; flex: 1 1 0; visibility: hidden; }\n"
    "  .xaxis span:not(:only-child):first-child,\n"
    "  .xaxis span:not(:only-child):nth-child(7),\n"
    "  .xaxis span:not(:only-child):last-child { visibility: visible; }\n"
    "}",
    "week ruler: every tick stands on its own week",
)

# ── 12 · first-run-week-label-stands-300px-from-its-mark ──────────────
sub(
    ".plot.solo .colw .bar-val { left: 0; right: auto; transform: none; }",
    ".plot.solo .colw .bar-val { left: 0; right: auto; transform: none; }\n"
    "/* The ruler is narrowed with the plot it labels. Left out of the solo\n"
    "   treatment, its single tick centred itself in the whole chart column\n"
    "   and stood 298px from the only mark on the chart. */\n"
    ".plot.solo ~ .xaxis { width: 57px; padding-right: 0; }",
    "first-run: the tick stands on its week",
)

# ── 13 · kpi-cards-are-links-that-open-nothing ────────────────────────
# The hero stopped advertising a move the surface does not carry in r1; the
# row was still offering three link roles that append a bare '#'. The
# destination is on the port packet, and the affordance ships with it.
sub(
    "  return known && n > 0\n"
    "    ? `<a class=\"kpi rise\" href=\"#\" style=\"--i:${i}\">${body}</a>`\n"
    "    : `<div class=\"kpi rise\" style=\"--i:${i}\">${body}</div>`;",
    "  /* Never a link. Nothing on this surface opens a filtered list, and a\n"
    "     role the screen cannot honour is the same promise the hero stopped\n"
    "     making in round 1. The destination is on the port packet; the\n"
    "     affordance ships when it does. */\n"
    "  return `<div class=\"kpi rise\" role=\"group\" aria-label=\"${esc(name)}\" style=\"--i:${i}\">${body}</div>`;",
    "row: five figures, not three dead links",
)
sub(
    "a.kpi:hover { border-color: var(--line); transform: translateY(-2px); }\n"
    ".kpi { transition: border-color 0.14s var(--ease), transform 0.14s var(--ease), background-color 0.14s var(--ease); }\n"
    "a.kpi:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n"
    "a.kpi:active { transform: translateY(0); background: var(--paper-3); border-color: var(--ink-4); }",
    "/* The row is read, not operated, so it carries no hover or press. What\n"
    "   the entrance used to pin dead is now simply not declared. */",
    "row: retire the states a read-only row does not need",
)
sub(
    '      <span class="sr">${esc(name)}</span>`;',
    '      `;',
    "row: the name is on the group, not inside it",
)

# ── 14 · the dead live-column rule ────────────────────────────────────
# .bar.live can never paint: the last week is always the running one, so
# the ternary's live branch is unreachable. Found while measuring the
# non-text contrast floor.
sub(
    ".bar.live { background: var(--accent); }\n",
    "",
    "chart: delete a rule that cannot paint",
)
sub(
    '    const cls = w.partial ? "bar part" : (live ? "bar live" : "bar");',
    '    const cls = w.partial ? "bar part" : "bar";',
    "chart: and the branch that reached for it",
)

# ── 15 · the quiet marks, half of the non-text floor ──────────────────
# The refuter confirmed the shortfall and showed the seat's fix inverts the
# chart: the current week is a hatch at 1.71:1, fainter than the columns it
# was being contrasted against, so darkening the columns alone makes the
# live mark the weakest thing in the frame. The strip half is safe and is
# taken; the chart half is deferred to the port packet with its numbers.
sub(
    "  --mark-ctx:   #d4d4d8;",
    "  --mark-ctx:   #d4d4d8;\n  --mark-quiet: #71717a;",
    "tokens: a quiet mark that clears the floor (light)",
)
sub(
    "  --mark-ctx:   #3f3f46;",
    "  --mark-ctx:   #3f3f46;\n  --mark-quiet: #71717a;",
    "tokens: a quiet mark that clears the floor (dark)",
)
sub(
    ".meter i.zero { background: var(--mark-ctx); }",
    ".meter i.zero { background: var(--mark-quiet); }",
    "meters: a zero mark that can be seen",
)
sub(
    "/* The disc is a pseudo, not the button.",
    "/* A ring, not a fill, for a mark inside the fortnight. The 2px stroke is\n"
    "   the graphical object and clears 3:1 in both grounds, and hollow versus\n"
    "   solid is a fill difference — which is what the lock sanctions — so the\n"
    "   three marks past the line keep their separation without leaning on hue.\n"
    "   Darkening the quiet fill instead would have cut that separation from\n"
    "   4.25:1 to 1.30:1 and left the strip's only real reading carried by\n"
    "   colour alone. */\n"
    "/* The disc is a pseudo, not the button.",
    "marks: the argument for a ring",
)
sub(
    "  border-radius: 999px; background: var(--disc);",
    "  border-radius: 999px; background: transparent; box-shadow: inset 0 0 0 2px var(--disc);",
    "marks: a ring inside the fortnight",
)
sub(
    ".dot.old { --disc: var(--accent); }",
    ".dot.old::before { background: var(--disc); }\n.dot.old { --disc: var(--accent); }",
    "marks: solid past the fortnight",
)
sub(
    ".dot { \n  --disc: var(--mark-ctx);",
    ".dot { \n  --disc: var(--mark-quiet);",
    "marks: the quiet ring takes the quiet token",
) if ".dot { \n  --disc: var(--mark-ctx);" in s else sub(
    "  --disc: var(--mark-ctx);",
    "  --disc: var(--mark-quiet);",
    "marks: the quiet ring takes the quiet token",
)
sub(
    ".sk-wrap .dot::before, .sk-wrap .meter i, .sk-wrap .glyph { background: var(--wash); }",
    ".sk-wrap .dot::before, .sk-wrap .meter i, .sk-wrap .glyph { background: var(--wash); box-shadow: none; }",
    "loading: the skeleton keeps solid marks",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 6 applied")
