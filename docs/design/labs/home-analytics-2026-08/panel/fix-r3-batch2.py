# Round 3, batch 2 — the surface. Seven confirmed findings.
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
    # ── axis-max-and-live-week-print-the-same-number ───────────────────
    # max = Math.max(D.peak, D.bestPrior) and D.peak includes the live week,
    # so whenever the running week is the tallest of the twelve — the shipped
    # fixture, and the case the chart most wants to show — the axis ceiling
    # and the live week's value are the same number, printed 14.8px apart at
    # the same height with 8px of vertical overlap, at every width. The
    # gridline still draws; only its numeral goes, and only when the live
    # mark already prints that number at that height in a stronger voice.
    (
        '  const grid = [0.5, 1].map((g) => {\n'
        '    const v = Math.round(max * g);\n'
        '    return `<span class="gridline" style="bottom:${g * 100}%"><b class="t-label" data-type="label">${v}</b></span>`;\n'
        '  }).join("");',
        '  /* The ceiling label stands down when the live mark has already said\n'
        '     that number. max is Math.max(D.peak, D.bestPrior) and D.peak counts\n'
        '     the running week, so on any fixture where this week is the best week\n'
        '     — the shipped one, and the case the chart exists to show — the top\n'
        '     gridline and the live column printed the same numeral at the same\n'
        '     height, 15px apart. Two labels for one fact is not a scale; it reads\n'
        '     as two different quantities that happen to agree. The rule still\n'
        '     draws, because the reader still needs the height. */\n'
        '  const liveValue = D.weeks.length ? D.weeks[D.weeks.length - 1].v : null;\n'
        '  const grid = [0.5, 1].map((g) => {\n'
        '    const v = Math.round(max * g);\n'
        '    const saidByTheMark = g === 1 && v === liveValue;\n'
        '    return `<span class="gridline" style="bottom:${g * 100}%">${saidByTheMark ? "" : `<b class="t-label" data-type="label">${v}</b>`}</span>`;\n'
        '  }).join("");',
        "chart: the ceiling stands down when the live mark already says it",
    ),
    # ── the-age-summary-says-one-days ──────────────────────────────────
    # Every other age on this surface goes through plural(): the mark's own
    # name says "open 1 day" and its tooltip says "1 day open". This one line
    # hard-coded "days", so quiet spoke "1 days" and first-run spoke it three
    # times.
    (
        '${D.jobs.map((j) => `${j.title}, ${j.age} days`).join("; ")}',
        '${D.jobs.map((j) => `${j.title}, ${plural(j.age, "day", "days")}`).join("; ")}',
        "ages: the spoken summary counts the way everything else does",
    ),
    # ── the-bound-stamp-wraps-and-strands-its-digit ────────────────────
    # 349px of tracked uppercase mono in a 342px content box at 390: it wrapped
    # and left the bare digit 9 alone on a second line, in every state. Two
    # non-breaking spaces move the break to after "date"; nowrap would convert
    # the wrap into a 7.2px overflow instead.
    (
        '        <span><b>Bound</b> workspace, owner, reading date and the ${D.open}</span>',
        '        <!-- The last two words are bound to the numeral. At 390 this stamp\n'
        '             is 349px in a 342px box, so it wraps — and wrapped on a space it\n'
        '             left the bare digit alone on line two, a number with nothing to\n'
        '             say what it counts. nowrap is the wrong instrument here: it\n'
        '             turns the wrap into an overflow. -->\n'
        '        <span><b>Bound</b> workspace, owner, reading date and&nbsp;the&nbsp;${D.open}</span>',
        "coverage: the digit keeps the words that name it",
    ),
    # ── error-alert-loses-a-rung-the-other-terminal-states-keep ────────
    # .center sets gap: var(--gap-line) between its children, and h1..h4,p have
    # margin 0. In empty and quiet the heading and its sentence are siblings of
    # .center and take the rung — measured 16.0px in both. In error the r1 fix
    # wrapped them in role="alert", which made them children of a plain div
    # with no gap of its own: 0.0px, in both grounds. .stack is byte-for-byte
    # the declaration needed, so this costs no new CSS.
    (
        '          <div role="alert">\n'
        '            <h2 class="t-sect" id="mError" data-type="sect">Tasks did not answer</h2>',
        '          <!-- .stack, not a bare div. The role="alert" wrapper the r1 fix\n'
        '               added made the heading and its sentence children of an element\n'
        '               with no gap, so the 16px rung the empty and quiet states keep\n'
        '               collapsed to nothing here. .stack already declares exactly the\n'
        '               column and gap this needs. -->\n'
        '          <div class="stack" role="alert">\n'
        '            <h2 class="t-sect" id="mError" data-type="sect">Tasks did not answer</h2>',
        "error: the heading and its sentence keep their rung",
    ),
    # ── loading-hands-over-the-reading-it-says-it-has-not-made ─────────
    # Round 2 neutralised every magnitude that carries geometry and left every
    # fact in the DOM as live text, hidden by color: transparent. A real
    # Ctrl+A selects and hands over the whole reading the state says it has
    # not made.
    (
        '.sk-wrap { pointer-events: none; }',
        '/* Not selectable, for the same reason it is not clickable: a state that\n'
        '   says it has not read the numbers may not hand them over. The ink is\n'
        '   transparent, not absent — round 2 neutralised the magnitudes that carry\n'
        '   geometry and left the facts as live text, so Ctrl+A returned the whole\n'
        '   reading the frame is still claiming to fetch. */\n'
        '.sk-wrap { pointer-events: none; -webkit-user-select: none; user-select: none; }',
        "loading: what it says it has not read, it cannot hand over",
    ),
    # ── tapped-mark-keeps-the-hover-ink-forever ────────────────────────
    # Under a coarse pointer the browser latches :hover onto the last element
    # touched and never releases it. All three hover rules on this surface are
    # affected; the tab strip is the worse one, because after one tap two tabs
    # read at full ink and only weight and the underline still separate the
    # current one.
    (
        '.dot:hover, .dot:focus-visible { --disc: var(--ink); }',
        '/* Hover is fenced to devices that have one. A coarse pointer latches\n'
        '   :hover onto the last element touched and never releases it, so one tap\n'
        '   left a mark inked as though the finger were still on it — and, on the\n'
        '   tab strip, left two tabs reading at full ink with only weight and the\n'
        '   underline still separating the current one. Focus is not fenced: it is\n'
        '   a real state on every device. */\n'
        '@media (hover: hover) {\n'
        '  .dot:hover { --disc: var(--ink); }\n'
        '}\n'
        '.dot:focus-visible { --disc: var(--ink); }',
        "marks: hover belongs to devices that have one",
    ),
    (
        '.tab:hover { color: var(--ink); }',
        '@media (hover: hover) { .tab:hover { color: var(--ink); } }',
        "tabs: same latch, worse consequence",
    ),
    (
        '.btn:hover { background: var(--paper-3); border-color: var(--ink-4); }',
        '@media (hover: hover) { .btn:hover { background: var(--paper-3); border-color: var(--ink-4); } }',
        "button: the third instance of the same latch",
    ),
    # ── refusal-copy-has-no-measure-ceiling ────────────────────────────
    # .limit .t-small carries no max-width and .limits collapses to one column
    # at 900, so the third refusal body set 121 characters on a line at 900px
    # and 97 at the declared 768 viewport that has a committed frame. The
    # ceiling is set from what paints, not from ch: 42ch computes to 362px and
    # still yields 64 characters, about 16% wider than the measure it claims
    # to match.
    (
        '.limit { padding: var(--gap-line); display: flex; flex-direction: column; gap: var(--gap-snug); background: var(--paper-3); border-radius: 12px; }',
        '.limit { padding: var(--gap-line); display: flex; flex-direction: column; gap: var(--gap-snug); background: var(--paper-3); border-radius: 12px; }\n'
        '/* A ceiling on the measure, set from what paints. .limits collapses to one\n'
        '   column at 900 and the refusal bodies had no bound at all, so a paragraph\n'
        '   that reads at 49-55 characters in three columns ran to 121 at 900px and\n'
        '   97 at the declared 768 frame. 330px lands the collapsed band on the same\n'
        '   measure the three-column layout already delivers, and is inert above it —\n'
        '   the column content box is 318.7px at 1440 and 310px at 390. Stated in\n'
        '   pixels rather than ch because ch measures the zero and this face sets\n'
        '   about 16% more characters per ch than the ceiling would promise. */\n'
        '.limit .t-small { max-width: 330px; }',
        "refusals: a ceiling on the measure, where the grid has collapsed",
    ),
])

# The gate assertion the chart change deliberately breaks, amended so it
# still has a failing mode. Number("") is 0 and Number("12 so far") is NaN,
# so the old membership test must parse numerically; and accepting the
# .bar-val alone would pass by construction on this fixture, because the
# live mark always prints the peak. Both halves are asserted.
edit("interaction-check.mjs", [
    (
        '  const grid = await page.evaluate(() => {\n'
        '    const lines = Array.from(document.querySelectorAll(".gridline"));\n'
        '    const max = Math.max(...window.LATELY_FIXTURE.weeks.map((w) => w.v));\n'
        '    return { n: lines.length, top: lines.map((l) => Number(l.textContent)).includes(max) };\n'
        '  });\n'
        '  ok("the chart states its own scale", grid.n >= 2 && grid.top, JSON.stringify(grid));',
        '  /* The scale is stated once, by whichever mark is entitled to state it.\n'
        '     The ceiling label stands down when the live column already prints that\n'
        '     number, so a membership test over gridline text alone now fails on a\n'
        '     correct surface. Both halves are asserted instead, because either one\n'
        '     on its own passes by construction: the mid gridline must always carry\n'
        '     a numeral, and the peak must be printed somewhere in the plot. */\n'
        '  const grid = await page.evaluate(() => {\n'
        '    const lines = Array.from(document.querySelectorAll(".gridline"));\n'
        '    const num = (el) => {\n'
        '      const m = (el.textContent || "").match(/\\d+/);\n'
        '      return m ? Number(m[0]) : null;\n'
        '    };\n'
        '    const max = Math.max(...window.LATELY_FIXTURE.weeks.map((w) => w.v));\n'
        '    const labelled = lines.map(num).filter((n) => n !== null);\n'
        '    const live = num(document.querySelector(".plot .colw:last-child .bar-val") ?? document.createElement("i"));\n'
        '    return { n: lines.length, labelled, live, max, statesPeak: labelled.includes(max) || live === max };\n'
        '  });\n'
        '  ok("the chart states its own scale", grid.n >= 2 && grid.labelled.length >= 1 && grid.statesPeak, JSON.stringify(grid));\n'
        '  ok("and it states it once, not twice at the same height",\n'
        '    !(grid.labelled.includes(grid.max) && grid.live === grid.max), JSON.stringify(grid));',
        "gate: the scale is stated once, by whichever mark is entitled to",
    ),
])

print("batch 2 applied")
