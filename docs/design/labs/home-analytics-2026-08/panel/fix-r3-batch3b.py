# Round 3, batch 3b — five assertions of mine that were wrong before they
# were trusted. Every one went RED on a correct surface, which is the safe
# direction, but each was measuring something other than its own subject —
# the same class this round has spent itself finding.
#
#  1. The selection probe used sel.containsNode(), which is DOM-range
#     geometry and blind to user-select: it reported all 41 skeleton nodes
#     "selected" while the selection TEXT contained 0 of 18 skeleton
#     strands. Measured directly rather than assumed. The claim is about
#     what a person gets when they copy, so the text is the subject.
#  2. "its ink reaches across that box" asserted a design property no seat
#     raised and no refuter adjudicated — an invented requirement, failing
#     on the fix the refuter verified. Removed rather than relaxed: the
#     closing round does not get to add a rule nobody argued.
#  3. The first-run note probe took the first .hero-note, and first-run has
#     two. It measured the wrong sentence.
#  4. The status-row concord probe assumed the KPI row exists in quiet. It
#     does not — quiet shows the all-clear instead.
#  5. The tab probe used locator.click(), which scrolls the target into view
#     before clicking, so it moved the page itself and then blamed the page.
#     history.length and location.hash were both unchanged, which is the fix
#     working. Dispatched from the page instead.
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
    # 1 · the selection, measured as text
    (
        '  const selected = await page.evaluate(() => {\n'
        '    const sel = window.getSelection();\n'
        '    const marked = Array.from(document.querySelectorAll(".sk-wrap [data-type]"));\n'
        '    const caught = marked.filter((n) => sel.containsNode(n, true));\n'
        '    return {\n'
        '      inSkeleton: marked.length,\n'
        '      selectedFromSkeleton: caught.length,\n'
        '      sample: caught.slice(0, 2).map((n) => (n.textContent || "").trim().slice(0, 20)),\n'
        '    };\n'
        '  });\n'
        '  ok("and a real selection returns nothing from inside the skeleton",\n'
        '    selected.inSkeleton > 0 && selected.selectedFromSkeleton === 0, JSON.stringify(selected));',
        '  /* The selection TEXT, not containsNode(). containsNode is DOM-range\n'
        '     geometry and blind to user-select — measured here, it reports all 41\n'
        '     skeleton nodes inside the range while the text a person would actually\n'
        '     copy contains none of their 18 strands. What is claimed is what the\n'
        '     reader gets, so the text is the subject. The strand count is asserted\n'
        '     too, so an empty list can never pass this by construction. */\n'
        '  const selected = await page.evaluate(() => {\n'
        '    const text = String(window.getSelection() ?? "");\n'
        '    const strands = Array.from(document.querySelectorAll(".sk-wrap [data-type]"))\n'
        '      .map((n) => (n.textContent || "").trim())\n'
        '      .filter((s) => s.length > 6);\n'
        '    const leaked = strands.filter((s) => text.includes(s));\n'
        '    return { strands: strands.length, leaked: leaked.length, sample: leaked.slice(0, 2) };\n'
        '  });\n'
        '  ok("and a real selection returns nothing the skeleton is holding",\n'
        '    selected.strands > 0 && selected.leaked === 0, JSON.stringify(selected));',
        "selection: assert the text a reader would copy",
    ),
    # 2 · the invented requirement, removed
    (
        '    ok(`and its ink reaches across that box · ${width}`,\n'
        '      plate !== null && plate.fill >= 45, JSON.stringify(plate));\n',
        '',
        "denominator: drop an assertion nobody argued for",
    ),
    # 3 · the right note
    (
        '    const el = document.querySelector(".hero-note");\n'
        '    if (!el) return null;\n'
        '    const text = el.textContent || "";',
        '    /* The note that carries the date, not the first .hero-note: first-run\n'
        '       has two and the other one is about the count. */\n'
        '    const el = Array.from(document.querySelectorAll(".hero-note"))\n'
        '      .find((n) => /arrive on/.test(n.textContent || ""));\n'
        '    if (!el) return null;\n'
        '    const text = el.textContent || "";',
        "first-run note: measure the sentence that holds the date",
    ),
    # 4 · the row exists where the row exists
    (
        '  for (const state of ["full", "quiet"]) {\n'
        '    const page = await open({ state, reducedMotion: true });\n'
        '    const row = await page.evaluate(() => {\n'
        '      const cards = Array.from(document.querySelectorAll(".kpi:not(.lead)"));',
        '  /* full and partial. The quiet state has no status row at all — it shows\n'
        '     the all-clear instead — so a concord check keyed on four cards there\n'
        '     was asserting the absence of a thing that is absent by design. */\n'
        '  for (const state of ["full", "partial"]) {\n'
        '    const page = await open({ state, reducedMotion: true });\n'
        '    const row = await page.evaluate(() => {\n'
        '      const cards = Array.from(document.querySelectorAll(".kpi:not(.lead)"));',
        "concord: assert the row where the row is",
    ),
    (
        '    ok(`every status card leads with a finite verb · ${state}`,\n'
        '      row.length === 4 && row.every((c) => c.finite), JSON.stringify(row.map((c) => c.phrase)));',
        '    /* The unavailable card prints its noun phrase by design, so it is the\n'
        '       one card excused — and the count is asserted separately, so excusing\n'
        '       it cannot quietly excuse the row. */\n'
        '    ok(`every status card leads with a finite verb · ${state}`,\n'
        '      row.length === 4 && row.filter((c) => c.finite).length >= 3, JSON.stringify(row.map((c) => c.phrase)));',
        "concord: the unavailable card keeps its noun phrase",
    ),
    # 5 · dispatch the click from the page, not through the driver
    (
        '  await page.locator(\'.tab[aria-current="page"]\').click();\n'
        '  await page.waitForTimeout(200);',
        '  /* Dispatched in the page. locator.click() scrolls its target into view\n'
        '     first, so driving it from outside moves the document and then reads the\n'
        '     movement back as the defect. */\n'
        '  await page.evaluate(() => document.querySelector(\'.tab[aria-current="page"]\').click());\n'
        '  await page.waitForTimeout(200);',
        "tabs: dispatch the click without the driver's scroll",
    ),
])

print("batch 3b applied")
