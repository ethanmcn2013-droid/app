# Round 3, batch 1 — the gate.
#
# Seven confirmed findings, every one of them an assertion that certified a
# finding already recorded closed, plus two gate holes named by refuters
# whose findings were themselves refuted. This batch runs first because a
# blind instrument invalidates every measurement taken after it.
#
# Raw strings throughout: this file writes regex escapes, and a heredoc has
# eaten them twice in this engagement already (L-12).
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


# ── 1 · gate-word-boundaries-are-double-escaped-and-cannot-fail ────────
# Four source backslashes compile to a LITERAL backslash followed by b.
# main's innerText holds no backslash in any state, so both guards were
# structurally empty: eight assertions across four states each, guarding
# two round-1 findings recorded closed on evidence that would have passed
# either way. The refuter proved the seat's own fix goes red on "4 May" in
# the chart's spoken line, so the month guard needs the date lookbehind as
# well as the corrected escape.
edit("interaction-check.mjs", [
    (
        r'        const re = new RegExp("\\\\b" + m + "\\\\b(?!\\\\s+\\\\d{4})", "g");',
        r'        /* Two source backslashes, not four. Four compile to a literal'
        "\n"
        r'           backslash followed by b, which main never contains — the guard'
        "\n"
        r'           was structurally empty for four rounds. The lookbehind is the'
        "\n"
        r'           refuter s correction: a month preceded by a day-of-month is a'
        "\n"
        r'           date ("4 May" in the chart s spoken line), not a bare month, and'
        "\n"
        r'           without it the corrected escape turns the gate red on a surface'
        "\n"
        r'           that is right. */'
        "\n"
        r'        const re = new RegExp("(?<!\\d\\s)\\b" + m + "\\b(?!\\s+\\d{4})", "g");',
        "regex: month guard compiles a word boundary, and knows a date from a month",
    ),
    (
        r'      const hits = banned.filter((w) => new RegExp("\\\\b" + w + "\\\\b", "i").test(text));',
        r'      const hits = banned.filter((w) => new RegExp("\\b" + w + "\\b", "i").test(text));',
        "regex: vocabulary guard compiles a word boundary",
    ),
    # An instrument that cannot be shown alive is not an instrument. Both
    # guards now prove themselves against a fixed probe before they are
    # trusted against the page.
    (
        '    ok(`no month is named without its year · ${state}`, dates.length === 0, dates.join(", "));',
        '    /* The instrument, proved alive on a fixed probe before it is trusted\n'
        '       on the page. This is the assertion the vacuous-guard class needs:\n'
        '       not "did it find nothing", but "would it find something". */\n'
        '    const monthProbe = await page.evaluate(() => {\n'
        '      const re = new RegExp("(?<!\\\\d\\\\s)\\\\bAugust\\\\b(?!\\\\s+\\\\d{4})", "g");\n'
        '      return { bare: re.test("finished in August, before the week is out"), dated: /(?<!\\\\d\\\\s)\\\\bAugust\\\\b(?!\\\\s+\\\\d{4})/.test("August 2026"), day: /(?<!\\\\d\\\\s)\\\\bAugust\\\\b(?!\\\\s+\\\\d{4})/.test("4 August") };\n'
        '    });\n'
        '    ok(`the month guard can still see a bare month · ${state}`,\n'
        '      monthProbe.bare && !monthProbe.dated && !monthProbe.day, JSON.stringify(monthProbe));\n'
        '    ok(`no month is named without its year · ${state}`, dates.length === 0, dates.join(", "));',
        "regex: the month guard proves itself alive on a probe",
    ),
])

# ── 2 · kpi-row-name-is-checked-for-length-only ────────────────────────
# Round 2 moved the row's sentence off a .sr leaf and onto the group's own
# aria-label. The grammar gate was not moved with it, so `.kpi .sr` is null
# on all four status cards and nothing in 461 assertions read a status
# card's name for content — line 1547 checked only that it was longer than
# twelve characters. Three planted defects, including a falsified
# denominator, left the gate green.
edit("interaction-check.mjs", [
    (
        '      for (const el of document.querySelectorAll(".kpi")) {\n'
        '        check(el.textContent, "card");\n'
        '        check(el.querySelector(".sr")?.textContent, "card name");\n'
        '      }',
        '      for (const el of document.querySelectorAll(".kpi")) {\n'
        '        check(el.textContent, "card");\n'
        '        /* The name, not the leaf. Round 2 moved this sentence onto the\n'
        '           group s own label and left the grammar check reading .sr, which\n'
        '           is null on every status card — so the row s only content check\n'
        '           was its length. A planted singular verb, a planted plural and a\n'
        '           falsified denominator all passed. */\n'
        '        check(el.getAttribute("aria-label"), "card name");\n'
        '        check(el.querySelector(".sr")?.textContent, "card sr");\n'
        '      }',
        "grammar: read the name, which is where the sentence now lives",
    ),
])

# ── 3 · record-draws-last-cannot-fail-for-its-own-claim ────────────────
# The right-hand disjunct was a term of line 532's own test that the
# entrance runs, and it is independently true of any entrance whose columns
# animate. Assert the declared timeline instead of a sampled frame: it
# removes the flake with the vacuity.
edit("interaction-check.mjs", [
    (
        '  ok("the previous best draws last, after the columns have grown", Number(early.record) < Number(late.record) || early.lastBar < late.lastBar);',
        '  /* The declared timeline, not a photographed frame. The old test read\n'
        '     `record opacity rose OR the last bar grew`, and the right-hand half is\n'
        '     a term of the check two lines above that the entrance runs at all —\n'
        '     true of any entrance, so the claim could not fail for its own subject.\n'
        '     The invariant is that the rule finishes after every column has: the\n'
        '     columns end at 1280ms (i*40 + 340 + 500) and the rule ends at 1700ms\n'
        '     (1100 + 600). Drop the delay and it goes red. */\n'
        '  const seq = await p2.evaluate(() => {\n'
        '    const endOf = (el, name) => {\n'
        '      const a = el.getAnimations().find((x) => x.animationName === name);\n'
        '      if (!a) return null;\n'
        '      const t = a.effect.getComputedTiming();\n'
        '      return Number(t.delay) + Number(t.activeDuration);\n'
        '    };\n'
        '    const bars = Array.from(document.querySelectorAll(".plot .colw .bar"))\n'
        '      .map((b) => endOf(b, "grow")).filter((n) => n !== null);\n'
        '    const rec = document.querySelector(".record");\n'
        '    const tag = document.querySelector(".record-tag");\n'
        '    return {\n'
        '      lastColumn: bars.length ? Math.max(...bars) : null,\n'
        '      record: rec ? endOf(rec, "draw") : null,\n'
        '      tag: tag ? endOf(tag, "rise") : null,\n'
        '    };\n'
        '  });\n'
        '  ok("the previous best draws last, after the columns have grown",\n'
        '    seq.lastColumn !== null && seq.record !== null && seq.record > seq.lastColumn,\n'
        '    JSON.stringify(seq));\n'
        '  ok("and its tag lands after the rule it labels",\n'
        '    seq.tag !== null && seq.tag > seq.record, JSON.stringify(seq));',
        "record: assert the declared timeline, not a sampled frame",
    ),
])

# ── 4 · settled-is-proved-by-a-check-that-cannot-see-it ────────────────
# The columns finish at 1280ms and open() samples at 1800ms, so the check
# read the same height whether the surface settled or ran its entrance. It
# certified nothing it was named for. Two pages, one instant at 150ms, and
# the difference between them is the whole claim.
edit("interaction-check.mjs", [
    (
        '  const still = await settled.evaluate(() => {\n'
        '    const bar = document.querySelector(".bar");\n'
        '    return { h: bar.getBoundingClientRect().height, hero: document.getElementById("count").textContent.trim() };\n'
        '  });\n'
        '  ok("settled means every column is already at its height", still.h > 8, `${still.h}px`);\n'
        '  await settled.close();',
        '  await settled.close();\n'
        '\n'
        '  /* Measured at 150ms, not at 1800. The twelfth column finishes at 1280ms,\n'
        '     so a sample taken at 1800 reads full height whether the surface settled\n'
        '     or ran the whole entrance — the check passed on both and proved neither.\n'
        '     Two pages, one instant, and the difference between them is the claim. */\n'
        '  const heightAt150 = async (motion) => {\n'
        '    const c = await browser.newContext({ viewport: { width: 1440, height: 960 } });\n'
        '    const p = await c.newPage();\n'
        '    const u = new URL(MASTER);\n'
        '    u.searchParams.set("state", "full");\n'
        '    u.searchParams.set("v", "light");\n'
        '    if (motion) u.searchParams.set("motion", motion);\n'
        '    await p.goto(u.href, { waitUntil: "load" });\n'
        '    await p.waitForTimeout(150);\n'
        '    const h = await p.evaluate(() => document.querySelector(".plot .colw .bar").getBoundingClientRect().height);\n'
        '    await p.close(); await c.close();\n'
        '    return h;\n'
        '  };\n'
        '  const hSettled = await heightAt150(null);\n'
        '  const hPlaying = await heightAt150("play");\n'
        '  ok("settled means every column is already at its height",\n'
        '    hSettled > 8, `${hSettled.toFixed(2)}px at 150ms`);\n'
        '  ok("and the entrance is the thing settled is measured against",\n'
        '    hPlaying < hSettled - 8,\n'
        '    `settled ${hSettled.toFixed(2)}px vs play ${hPlaying.toFixed(2)}px, both at 150ms`);',
        "settled: sample at 150ms, and prove it against the entrance it replaces",
    ),
])

# ── 5 · pinned-tip-guard-scrolls-a-container-that-no-longer-scrolls ────
# Round 2 made the document the scroller. .scroll carries overflow-x: clip
# and, by design, overflow-y: visible, so it is not a scroll container and
# scrollBy on it is a no-op. The guard for stale-tip-strands-on-scroll has
# not scrolled anything since.
edit("interaction-check.mjs", [
    (
        '  await page.evaluate(() => document.querySelector(".scroll").scrollBy(0, 260));',
        '  /* The document, not .scroll. Round 2 moved scroll ownership to the\n'
        '     document; .scroll now carries only overflow-x: clip, so scrollBy on it\n'
        '     is a no-op and this guard has been scrolling nothing ever since. */\n'
        '  await page.evaluate(() => window.scrollBy(0, 260));',
        "pinned tip: scroll the thing that actually scrolls",
    ),
])

# ── 6 · first-run-height-assertion-certifies-its-own-literal ───────────
# Refuted as filed and confirmed on the refuter's reading: the assertion is
# not vacuous — edit the 100 to a 50 and it goes red — it is MISNAMED, and
# the `value` it reads is dead. A solo week is its own maximum, so its
# height is 100 for every possible fixture value BY DESIGN. Name what it
# guards and drop the read nothing compares.
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
        '   the second; it is source-sensitive either way (edit 100 to 50 and it\n'
        '   goes red) but a check whose name and subject disagree is how the\n'
        '   vacuous class starts. */',
        "first-run: name what the assertion actually guards",
    ),
    (
        '      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,\n'
        '      value: f.weeks[f.weeks.length - 1].v,\n',
        '      h: bar ? Number(bar.style.getPropertyValue("--h")) : null,\n',
        "first-run: drop the read nothing compares",
    ),
    (
        '    ok("the first-run mark\'s height comes from its value, not a literal", plot.h === 100, `--h ${plot.h}`);',
        '    ok("the solo mark fills its plot, because one week is its own maximum", plot.h === 100, `--h ${plot.h}`);',
        "first-run: rename to the invariant it holds",
    ),
])

# ── 7 · error-reading-assertion-cannot-fail ────────────────────────────
# Refuted as filed — the phrase guard DOES fail on a verbatim reintroduction
# of the r1 defect, and "absent from the fixed source" is true of every
# negative regression assertion in the file. Confirmed on the refuter's
# residual: the block computes an `instances` count and never asserts it.
# State the policy positively as well as grepping for the string.
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
# Growing the gate is never frozen, so these are taken even though the
# findings that surfaced them did not survive refutation.
edit("interaction-check.mjs", [
    # The anchored loop ran over five states and silently omitted loading —
    # the one state whose whole claim is that it has not finished reading.
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
    # `if (claim.reassures)` skipped its own block when the copy changed, so
    # the all-clear could be renamed and take three assertions with it in
    # silence. Assert the guard's own precondition where it must hold.
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

# The same four-backslash bug sits in the round-1 assertion source that the
# gate was spliced from. Left alone it is a landmine for anyone who re-runs
# the splice.
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

print("batch 1 applied")
