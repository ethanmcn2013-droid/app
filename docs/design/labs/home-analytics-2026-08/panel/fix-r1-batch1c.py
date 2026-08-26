# Batch 1, third pass.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(HERE, "..")

def edit(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    for old, new, label in pairs:
        if old not in s:
            sys.stderr.write("MISS: %s\n" % label)
            sys.exit(2)
        s = s.replace(old, new, 1)
        print("  ok  %s" % label)
    io.open(path, "w", encoding="utf-8").write(s)

master = os.path.join(LAB, "lately.html")
edit(master, [
    # The tag and the columns are both positioned with auto z-index, so
    # they paint in DOM order and the columns won. It sits at the record's
    # height, where no historical week reaches, so it covers no mark.
    (
        ".record-tag { position: absolute; left: 0;",
        ".record-tag { position: absolute; z-index: 1; left: 0;",
        "record tag: paint above the columns",
    ),
    # A connector is hidden when it joins nothing, and nothing is a
    # question about the rendered box, not about a width someone guessed.
    # The breakpoint moved once already when the margins were reset.
    (
        "/* Below 600 the reading wraps, so the connector is retired and the two\n"
        "   stamps join with the middot the rest of the surface already uses.\n"
        "   The separator LEADS the second stamp — a trailing one is the same\n"
        "   dangling mark in a heavier weight. */\n"
        "@media (max-width: 600px) {\n"
        "  .reading { gap: var(--gap-tight); }\n"
        "  .reading .rule { display: none; }\n"
        "  .reading p:not(:first-child)::before { content: \"\\00b7\\00a0\"; }\n"
        "}\n",
        "/* When the reading wraps, the connector joins the date to the page\n"
        "   edge and points at nothing while its other end sits on the line\n"
        "   below. It is retired and the two stamps join with the middot the\n"
        "   rest of the surface already uses — LEADING the second stamp, since\n"
        "   a trailing one is the same dangling mark in a heavier weight.\n"
        "   Measured from the rendered box, not from a typed breakpoint: the\n"
        "   wrap width moved the first time the margins were corrected. */\n"
        ".reading[data-wrapped] { gap: var(--gap-tight); }\n"
        ".reading[data-wrapped] .rule { display: none; }\n"
        ".reading[data-wrapped] p:not(:first-child)::before { content: \"\\00b7\\00a0\"; }\n",
        "reading rule: measured, not guessed",
    ),
    (
        "  deswarm();\n  window.addEventListener(\"resize\", deswarm);",
        "  /* The reading line's connector, measured after layout. */\n"
        "  const reading = root.querySelector(\".reading\");\n"
        "  const measureReading = () => {\n"
        "    if (!reading) return;\n"
        "    reading.removeAttribute(\"data-wrapped\");\n"
        "    const tops = Array.from(reading.querySelectorAll(\"p\")).map((p) => Math.round(p.getBoundingClientRect().top));\n"
        "    if (new Set(tops).size > 1) reading.setAttribute(\"data-wrapped\", \"\");\n"
        "  };\n"
        "  deswarm();\n"
        "  measureReading();\n"
        "  window.addEventListener(\"resize\", () => { deswarm(); measureReading(); });",
        "reading rule: measure on load and resize",
    ),
])

gate = os.path.join(LAB, "interaction-check.mjs")
edit(gate, [
    # The row's marks share a FLOOR, not a top: the meter is a 3px rule and
    # the card that has no meter carries a line of words in its place. The
    # first version of this assertion compared tops and was measuring the
    # difference between a rule and a sentence.
    (
        "        const marks = Array.from(document.querySelectorAll(\".kpi .meter, .kpi > .t-label.dim\")).map((e) => Math.round(e.getBoundingClientRect().top));",
        "        const marks = Array.from(document.querySelectorAll(\".kpi .meter, .kpi > .t-label.dim\")).map((e) => Math.round(e.getBoundingClientRect().bottom));",
        "kpi assertion: marks share a floor, not a top",
    ),
    (
        "      ok(\"every meter in the row shares one line · \" + state + \" @ \" + w, rows.markSpan <= 1, rows.markSpan + \"px across \" + rows.m);",
        "      ok(\"every mark in the row shares one floor · \" + state + \" @ \" + w, rows.markSpan <= 1, rows.markSpan + \"px across \" + rows.m);",
        "kpi assertion: rename to what it measures",
    ),
])
print("batch 1c applied")
