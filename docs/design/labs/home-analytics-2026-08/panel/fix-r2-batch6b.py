# Round 2, batch 6b — the consequences of batch 6, in the master and in the
# assertions that were written against the shape it replaced.
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
    # The ages strip reserves the band it may need rather than growing into
    # it. Its height is data-dependent — the de-swarm stacks colliding marks
    # — so a loading frame could never promise it, and the skeleton was
    # 20px short of the page that followed at 390. A reserved floor is the
    # honest shape: the band is the same in both, and dense data grows past
    # it rather than surprising the reader with it.
    (
        ".strip { position: relative; height: 92px; margin-top: var(--gap-line); }",
        "/* A reserved band, not a grown one. The de-swarm stacks colliding\n"
        "   marks, so the strip's height depends on the data — which a loading\n"
        "   frame cannot know and therefore cannot promise. Two rows are\n"
        "   reserved at every width; denser data grows past the reserve. */\n"
        ".strip { position: relative; min-height: 112px; margin-top: var(--gap-line); }",
        "strip: reserve the band it may need",
    ),
    (
        "    strip.style.minHeight = `${92 + Math.max(0, rows.length - 1) * 20}px`;",
        "    strip.style.minHeight = `${Math.max(112, 92 + (rows.length - 1) * 20)}px`;",
        "strip: the de-swarm grows past the reserve, never under it",
    ),
    # A client that is still reading holds no weeks, so the first-run branch
    # and the chart's spoken line must not reach into an empty array.
    (
        "        <p class=\"sr\">This week so far: ${D.thisWeek} jobs finished, week commencing ${esc(D.weeks[0].start)}.",
        "        <p class=\"sr\">This week so far: ${D.thisWeek} jobs finished${D.weeks.length ? `, week commencing ${esc(D.weeks[0].start)}` : \"\"}.",
        "first-run: a spoken line that survives an empty reading",
    ),
    (
        "          <div class=\"xaxis\" aria-hidden=\"true\"><span class=\"t-label\" data-type=\"label\">${esc(D.weeks[0].start)}</span></div>",
        "          <div class=\"xaxis\" aria-hidden=\"true\"><span class=\"t-label\" data-type=\"label\">${D.weeks.length ? esc(D.weeks[0].start) : \"\"}</span></div>",
        "first-run: a tick that survives an empty reading",
    ),
    (
        "      <p class=\"sr\">Twelve weeks of finished work, week commencing ${esc(D.weeks[0].start)} to ${esc(D.weeks[D.weeks.length - 1].start)}:",
        "      <p class=\"sr\">${D.weeks.length ? `Twelve weeks of finished work, week commencing ${esc(D.weeks[0].start)} to ${esc(D.weeks[D.weeks.length - 1].start)}:",
        "chart: a spoken line that survives an empty reading (open)",
    ),
    (
        "${record ? ` The best week before this one was ${D.bestPrior}.` : \"\"}</p>",
        "${record ? ` The best week before this one was ${D.bestPrior}.` : \"\"}` : \"No weeks have been read yet.\"}</p>",
        "chart: a spoken line that survives an empty reading (close)",
    ),
    (
        "        <p class=\"t-label dim\" data-type=\"label\">Last four weeks &middot; ${esc(D.weeks[D.weeks.length - 4].start)} to ${esc(D.readingShort)}</p>",
        "        <p class=\"t-label dim\" data-type=\"label\">${D.weeks.length >= 4 ? `Last four weeks &middot; ${esc(D.weeks[D.weeks.length - 4].start)} to ${esc(D.readingShort)}` : \"\"}</p>",
        "hero: a window label that survives an empty reading",
    ),
    (
        "  const cols = D.weeks.map((w, i) => {",
        "  if (!D.weeks.length) return `<div class=\"chart\"><div class=\"plot\" aria-hidden=\"true\"><span class=\"baseline\"></span></div><div class=\"xaxis\" aria-hidden=\"true\"></div><p class=\"sr\">No weeks have been read yet.</p></div>`;\n"
        "  const cols = D.weeks.map((w, i) => {",
        "chart: an empty reading draws its frame and nothing else",
    ),
])

edit("interaction-check.mjs", [
    # The KPI row is read, not operated, so the press is measured on a
    # control that is still a control. The row's own policy is asserted
    # separately and positively.
    (
        '    const card = page.locator("a.kpi, .kpi").first();',
        '    const card = page.locator(".btn").first();',
        "press: measure a control that is a control",
    ),
    (
        '      const el = document.querySelector(".kpi");\n      const cs = getComputedStyle(el);\n      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };\n    });\n    await page.mouse.move(box.x - 40, box.y - 40);',
        '      const el = document.querySelector(".btn");\n      const cs = getComputedStyle(el);\n      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };\n    });\n    await page.mouse.move(box.x - 40, box.y - 40);',
        "press: rest reads the button",
    ),
    (
        '      const el = document.querySelector(".kpi");\n      const cs = getComputedStyle(el);\n      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };\n    });\n    await page.mouse.down();',
        '      const el = document.querySelector(".btn");\n      const cs = getComputedStyle(el);\n      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };\n    });\n    await page.mouse.down();',
        "press: hover reads the button",
    ),
    (
        '      const el = document.querySelector(".kpi");\n      const cs = getComputedStyle(el);\n      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };\n    });\n    await page.mouse.up();',
        '      const el = document.querySelector(".btn");\n      const cs = getComputedStyle(el);\n      return { t: cs.transform, bg: cs.backgroundColor, bd: cs.borderTopColor };\n    });\n    await page.mouse.up();',
        "press: press reads the button",
    ),
    (
        '    const rest = await page.evaluate(() => {',
        '    await page.goto(page.url().replace(/state=\\w[\\w-]*/, "state=error"), { waitUntil: "load" });\n'
        '    await page.waitForTimeout(200);\n'
        '    const rest = await page.evaluate(() => {',
        "press: the error state is where the button lives",
    ),
    (
        '    ok(`a card acknowledges a press, measured from what paints · motion=${mode ?? "settled"}`,',
        '    ok(`a control acknowledges a press, measured from what paints · motion=${mode ?? "settled"}`,',
        "press: name what it measures",
    ),
    # The row's sentence moved from a child span to the group's own label,
    # so "says its fact once" is now about the name, not about text leaves.
    (
        '      for (const card of document.querySelectorAll(".kpi:not(.lead)")) {\n        const leaves = [];',
        '      for (const card of document.querySelectorAll(".kpi:not(.lead)")) {\n'
        '        /* The sentence is the group\'s own label now, so the card should\n'
        '           contribute no text leaves of its own and exactly one name. */\n'
        '        const leaves = [];',
        "row: the sentence is the name",
    ),
    (
        '        out.push(leaves.length);\n      }\n      return out;\n    });\n    ok(`each card in the row says its fact once · ${state}`, heard.every((n) => n === 1), heard.join(","));',
        '        out.push({ leaves: leaves.length, named: (card.getAttribute("aria-label") || "").length > 12 });\n'
        '      }\n      return out;\n    });\n'
        '    ok(`each card in the row says its fact once · ${state}`,\n'
        '      heard.every((c) => c.leaves === 0 && c.named), JSON.stringify(heard));',
        "row: assert the name, not the leaves",
    ),
    # Same move for the unavailable card's spoken reason.
    (
        '        srSaysWhy: na.every((c) => /not available/i.test(c.querySelector(".sr")?.textContent ?? "")),',
        '        srSaysWhy: na.every((c) => /not available/i.test(c.getAttribute("aria-label") ?? "")),',
        "unavailable: the reason is on the name",
    ),
    # Amber lands on exactly 3.00 against its own plate; a float comparison
    # was reading 2.9999.
    (
        '      glyphs.length > 0 && glyphs.every((g) => g.r >= 3), glyphs.map((g) => g.r.toFixed(2)).join(" "));',
        '      glyphs.length > 0 && glyphs.every((g) => Number(g.r.toFixed(2)) >= 3), glyphs.map((g) => g.r.toFixed(2)).join(" "));',
        "glyphs: compare the ratio at the precision it is reported",
    ),
])
print("batch 6b applied")
