# Round 3, batch 3 — the last seven confirmed findings.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(HERE, "..")


def edit(name, pairs):
    path = os.path.join(LAB, name)
    s = io.open(path, encoding="utf-8").read()
    for old, new, label in pairs:
        if old not in s:
            sys.stderr.write("MISS: %s\n" % label)
            sys.exit(2)
        s = s.replace(old, new, 1)
        print("  ok  %s" % label)
    io.open(path, "w", encoding="utf-8").write(s)


edit("lately.html", [
    # ── denominator-plate-keeps-a-portrait-layout-in-a-banner-box ──────
    # At 1440 the lead card is a portrait tile and exactly right: 204x156.6,
    # ink filling 57% of its inner width, area 1.00x a sibling's. Below 900
    # the row goes two-up and the card spans both columns, but its contents
    # do not change — the same stacked label, numeral and phrase in a box
    # more than twice as wide. flex: 0 1 auto, not 0 0 auto: the goal is to
    # stop the phrase inheriting the grow from .kpi > .t-small, not to forbid
    # it ever compressing, which is the wrong guarantee for a fixture-driven
    # line whose denominator can reach three digits.
    (
        '  .kpi.lead { grid-column: 1 / -1; }',
        '  /* The plate is composed as a portrait tile and stays one below 900,\n'
        '     where it spans both columns and becomes a banner more than twice as\n'
        '     wide. Its parts lie down with it. flex-wrap makes the overflow\n'
        '     behaviour explicit rather than leaning on the engine s automatic\n'
        '     minimum size, and flex: 0 1 auto only removes the grow inherited\n'
        '     from .kpi > .t-small — the phrase may still shrink, which a\n'
        '     denominator that can reach three digits needs. */\n'
        '  .kpi.lead { grid-column: 1 / -1; flex-direction: row; align-items: baseline; gap: var(--gap-snug); flex-wrap: wrap; }\n'
        '  .kpi.lead > .t-label { height: auto; }\n'
        '  .kpi.lead > .t-small { flex: 0 1 auto; }',
        "denominator: the plate lies down when its box does",
    ),
    # ── nothing-balances-a-last-line ───────────────────────────────────
    # text-wrap computes to wrap on every element on the surface. Forty-two
    # one-word last lines on light and forty-two on dark — identical, so it
    # is not a ground artefact. Both halves land together: `pretty` on the
    # first-run note WITHOUT the bound date relocates the break into the date
    # itself, "Yours arrive on 10 / August 2026.", which is worse than the
    # widow it replaces.
    (
        '.reading[data-wrapped] { gap: var(--gap-tight); }',
        '/* Last lines. Nothing on this surface asked for balance, so forty-two\n'
        '   line boxes across the seven states ended on a single word — the ghost\n'
        '   caption on "here", the fourth KPI card on "else", the first-run note on\n'
        '   a bare year. `balance` for short blocks that are read as a unit,\n'
        '   `pretty` for running copy where only the last line is at stake. */\n'
        '.ghost-say .t-head, .center .t-sect, .center .t-body,\n'
        '.kpi > .t-small, .ages .band-head .t-head { text-wrap: balance; }\n'
        '.limit .t-small, .hero-note, .note .t-body { text-wrap: pretty; }\n'
        '\n'
        '.reading[data-wrapped] { gap: var(--gap-tight); }',
        "type: last lines are balanced, running copy is pretty",
    ),
    (
        'Yours arrive on ${esc(D.comparisonArrives)}.</p>',
        'Yours arrive on ${esc(D.comparisonArrives).replace(/ /g, "\\u00a0")}.</p>',
        "first-run: the date does not break, so pretty cannot break it badly",
    ),
    # ── the-lab-stamp-repeats-its-own-key ──────────────────────────────
    # Five stamps read as key plus value. This one read "LAB counts and ages
    # are lab-authored" — key, then a value that repeats the key, and a
    # garden path where "Lab" could be read as the subject of "counts".
    # Moving the repeat out of the value is what the other five already do.
    (
        '        <span><b>Lab</b> counts and ages are lab-authored</span>',
        '        <span><b>Lab-authored</b> counts and ages</span>',
        "coverage: the stamp says its key once",
    ),
    # ── one-of-four-labels-drops-the-verb-the-others-keep ──────────────
    # The plural string does two jobs: it is the card's visible phrase and,
    # in partial, the noun phrase inside "Jobs ___: not available". A finite
    # verb is right for the first and wrong for the second, which is why this
    # one card had none. Separate the two, then fix the visible one.
    (
        'function kpi({ n, word, glyph, tone, i, unavailable = false }) {',
        '/* naPhrase exists because the plural string was doing two jobs. As the\n'
        '   card s own sentence it wants a finite verb — "are past the day they\n'
        '   were due" — and as the noun phrase inside "Jobs ___: not available" it\n'
        '   cannot have one. One card carried the noun phrase in both places and\n'
        '   so read as the only card in the row without a verb. */\n'
        'function kpi({ n, word, glyph, tone, i, unavailable = false, naPhrase }) {\n'
        '  const na = naPhrase ?? word.many;',
        "kpi: the visible phrase and the unavailable noun phrase are two strings",
    ),
    (
        '    : `Jobs ${word.many}: not available, because Timeline did not answer`;',
        '    : `Jobs ${na}: not available, because Timeline did not answer`;',
        "kpi: the unavailable name takes the noun phrase",
    ),
    (
        '      <span class="t-small dim-2" data-type="small" aria-hidden="true">${esc(known ? phrase : word.many)}</span>',
        '      <span class="t-small dim-2" data-type="small" aria-hidden="true">${esc(known ? phrase : na)}</span>',
        "kpi: the unavailable card prints the noun phrase",
    ),
    (
        '${kpi({ n: D.overdue, word: { one: "is past the day it was due", many: "past the day they were due" }, glyph: ICON.past, tone: TONE.past, i: 2, unavailable: partial })}',
        '${kpi({ n: D.overdue, word: { one: "is past the day it was due", many: "are past the day they were due" }, naPhrase: "past the day they were due", glyph: ICON.past, tone: TONE.past, i: 2, unavailable: partial })}',
        "kpi: the overdue card keeps the verb its three siblings keep",
    ),
    # ── tab-strip-activates-into-a-dead-history-entry ──────────────────
    # All three tabs are anchors to a bare #. The two siblings will carry
    # real routes in the product, so they are left alone; the current tab has
    # nowhere to go here or there, and a current tab must not re-navigate to
    # itself.
    (
        '  document.addEventListener("keydown", (e) => { if (e.key === "Escape") drop(); });',
        '  /* The tab that is already current has nowhere to go — not in this lab\n'
        '     and not in the product — so activating it only pushed a history entry\n'
        '     and snapped the document to the top. Its two siblings are left alone:\n'
        '     they carry real routes after the port, and guarding them here would\n'
        '     be guarding against the thing they exist to do. */\n'
        '  const currentTab = root.querySelector(\'.tab[aria-current="page"]\');\n'
        '  if (currentTab) currentTab.addEventListener("click", (e) => e.preventDefault());\n'
        '\n'
        '  document.addEventListener("keydown", (e) => { if (e.key === "Escape") drop(); });',
        "tabs: the current tab does not re-navigate to itself",
    ),
    # ── tooltip-text-stays-in-the-accessibility-tree ───────────────────
    # The tip is hidden with opacity and its innerHTML is never cleared, so
    # after a blur the last mark's title and day count remain in the tree.
    # aria-hidden takes the subtree out with nothing lost: zero focusable
    # descendants, pointer-events none, no aria-describedby pointing at it.
    # The innerHTML is deliberately NOT cleared — hide() runs on every
    # pointerleave and re-parsing the markup on each one is the cost round 1
    # split fill from place to avoid.
    (
        '<div class="tip t-small" id="tip" role="presentation"></div>',
        '<!-- aria-hidden, not emptied. The tip is a visual echo of a name the\n'
        '     mark already carries, so nothing is lost by taking it out of the\n'
        '     tree — and it holds no focusable descendant and nothing points at it\n'
        '     with aria-describedby. Clearing innerHTML instead would put the\n'
        '     markup re-parse back on every pointerleave, which is what round 1\n'
        '     separated fill from place to avoid. -->\n'
        '<div class="tip t-small" id="tip" role="presentation" aria-hidden="true"></div>',
        "tooltip: the echo leaves the tree when it leaves the screen",
    ),
    # ── focused-mark-loses-its-name-to-a-pointer-leave ─────────────────
    # hide() guards only the touch pin, not focus: a pointer crossing any
    # mark and leaving took the tip away from a mark that was still focused
    # and still ringed, so the keyboard reader lost the only place a job's
    # title appears. Gated on the ring, not on the dataset, so a
    # mouse-clicked mark — focused but not :focus-visible — clears as it does
    # today. hide() itself is untouched: it is also the blur handler and the
    # pinned gate, and widening it widens the blast radius for no gain.
    (
        '    el.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hide(); });',
        '    /* Hand the tip back to a mark that is still visibly focused. The\n'
        '       pointer leaving is not the keyboard leaving, and the mark s title\n'
        '       lives nowhere else on the screen. Gated on :focus-visible rather\n'
        '       than on focus, so a mouse-clicked mark still clears. */\n'
        '    el.addEventListener("pointerleave", (e) => {\n'
        '      if (e.pointerType === "touch") return;\n'
        '      const held = document.activeElement;\n'
        '      if (!pinned && held && held.dataset && held.dataset.tip && held.matches(":focus-visible")) {\n'
        '        show(held);\n'
        '        return;\n'
        '      }\n'
        '      hide();\n'
        '    });',
        "marks: a focused mark keeps its name when a pointer crosses it",
    ),
])

print("batch 3 applied")
