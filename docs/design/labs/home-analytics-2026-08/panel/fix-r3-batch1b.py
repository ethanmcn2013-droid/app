# Round 3, batch 1b — the four edits batch 1 discarded.
#
# fix-r3-batch1.py's first-run group missed on one pair (a four-space
# indent typed where the file has two), and edit() writes only after every
# pair in a call matches — so the whole group was discarded and the three
# calls after it never ran. That is the trap RESUME.md names; it behaved
# exactly as documented. Everything below is the remainder, re-matched.
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


# ── 6 · first-run-height-assertion-certifies-its-own-literal ───────────
edit("interaction-check.mjs", [
    (
        '/* first-run-plot-has-no-scale · a mark whose height is a typed literal\n'
        '   encodes nothing. The single week stands at the pitch it will hold when\n'
        '   the twelve-week chart arrives, and it says in words what it draws. */',
        '/* first-run-plot-has-no-scale · the single week stands at the pitch it\n'
        '   will hold when the twelve-week chart arrives, and it says in words what\n'
        '   it draws.\n'
        '\n'
        '   The height here is 100 for EVERY possible fixture value and must be: a\n'
        '   solo week is its own maximum, and lately.html:281-285 argues why there is\n'
        '   no scale to derive it against. So the invariant is not "the height comes\n'
        '   from the value" — there is no relation to hold down — it is "the solo\n'
        '   mark fills its plot". This assertion was named for the first and tests\n'
        '   the second; it is source-sensitive either way (edit 100 to 50 and it goes\n'
        '   red) but a check whose name and subject disagree is how the vacuous class\n'
        '   starts. */',
        "first-run: name what the assertion actually guards",
    ),
    (
        '      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,\n'
        '      value: f.weeks[f.weeks.length - 1].v,\n',
        '      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,\n',
        "first-run: drop the read nothing compares",
    ),
    (
        '  ok("the first-run mark\'s height comes from its value, not a literal", plot.h === 100, `--h ${plot.h}`);',
        '  ok("the solo mark fills its plot, because one week is its own maximum", plot.h === 100, `--h ${plot.h}`);',
        "first-run: rename to the invariant it holds",
    ),
])

# ── 7 · error-reading-assertion-cannot-fail ────────────────────────────
edit("interaction-check.mjs", [
    (
        '  ok("the error state claims no reading it does not hold", !err.claimsLastGood, `${err.instances} stamps`);',
        '  /* Both halves. The phrase guard is a literal-regression guard and it does\n'
        '     fail on a verbatim reintroduction — but it was the only predicate here,\n'
        '     while the count beside it was computed and thrown away. The count is the\n'
        '     positive statement of the policy: main prints no successful reading in\n'
        '     the state built to say the reading failed. The header stamp is sanctioned\n'
        '     and lives outside main, which is why the scope stays. */\n'
        '  ok("the error state claims no reading it does not hold",\n'
        '    !err.claimsLastGood && err.instances === 0, `${err.instances} stamps in main`);',
        "error: assert the count the block already computed",
    ),
])

# ── 8 · two gate holes, named by refuters whose findings were refuted ──
edit("interaction-check.mjs", [
    (
        '  for (const state of ["full", "partial", "quiet", "first-run", "error"]) {\n'
        '    const page = await open({ state, reducedMotion: true });\n'
        '    const anchored = await page.evaluate(() => {',
        '  /* loading is in this loop now. It was the one state the anchored check\n'
        '     omitted, and it is the state whose entire claim is that it has not\n'
        '     finished reading — so what it says about the reading instant was the\n'
        '     least guarded copy on the surface. */\n'
        '  for (const state of ["full", "partial", "quiet", "first-run", "error", "loading"]) {\n'
        '    const page = await open({ state, reducedMotion: true });\n'
        '    const anchored = await page.evaluate(() => {',
        "anchored: the loading state is in the loop",
    ),
    (
        '      if (claim.reassures) {\n'
        '        ok(`nothing is sitting means nothing is drawn sitting · ${state} @ ${variant}`,',
        '      /* The guard s own precondition, asserted where it must hold. The block\n'
        '         below is keyed on the all-clear sentence existing; nothing else in\n'
        '         the lab asserts that it does, so a copy edit would have skipped the\n'
        '         block and taken its assertions with it in silence. */\n'
        '      if (state === "quiet") {\n'
        '        ok(`the quiet state still says the all-clear this guard keys on · ${variant}`,\n'
        '          claim.reassures, JSON.stringify({ reassures: claim.reassures }));\n'
        '      }\n'
        '      if (claim.reassures) {\n'
        '        ok(`nothing is sitting means nothing is drawn sitting · ${state} @ ${variant}`,',
        "all-clear: assert the precondition the guard is keyed on",
    ),
])

# ── the same bug in the round-1 assertion source the gate was spliced from
edit("panel/round-1-batch4-assertions.js", [
    (
        r'        const re = new RegExp("\\\\b" + m + "\\\\b(?!\\\\s+\\\\d{4})", "g");',
        r'        const re = new RegExp("(?<!\\d\\s)\\b" + m + "\\b(?!\\s+\\d{4})", "g");',
        "source: month guard",
    ),
    (
        r'      const hits = banned.filter((w) => new RegExp("\\\\b" + w + "\\\\b", "i").test(text));',
        r'      const hits = banned.filter((w) => new RegExp("\\b" + w + "\\b", "i").test(text));',
        "source: vocabulary guard",
    ),
])

print("batch 1b applied")
