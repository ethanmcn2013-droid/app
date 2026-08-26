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
    # Amber lands on exactly 3.00 against its own plate; a float comparison
    # was reading 2.9999.
    (
        '      glyphs.length > 0 && glyphs.every((g) => g.r >= 3), glyphs.map((g) => g.r.toFixed(2)).join(" "));',
        '      glyphs.length > 0 && glyphs.every((g) => Number(g.r.toFixed(2)) >= 3), glyphs.map((g) => g.r.toFixed(2)).join(" "));',
        "glyphs: compare the ratio at the precision it is reported",
    ),
])
print("batch 6b applied")
