# Round 3, batch 2b — two assertions of mine that were wrong before they
# were trusted. Both went red on a correct surface, which is the harmless
# direction, but a probe that cannot see its own subject is the same class
# of defect this round has been finding all the way through.
#
#  1. The terminal-states rung probe selected the heading as "h1, h2, h3".
#     The quiet state's heading is a <p class="t-head"> — the state is
#     composed alike, not marked up alike — so the probe returned null for
#     quiet and the assertion failed on a rung that measures 16px.
#
#  2. The loading-selection probe read the whole document. Ctrl+A returns
#     the header and the coverage footer too, and the footer legitimately
#     carries the bound nine — the finding that the footer should stop
#     saying so was REFUTED this round. The claim is about what the
#     SKELETON hands over, so the probe must be scoped to the skeleton.
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
    (
        '        const head = c.querySelector("h1, h2, h3");\n'
        '        if (!head) return null;\n'
        '        const par = head.parentElement.querySelector("p");',
        '        /* By role, not by tag. These three states are composed alike and\n'
        '           marked up differently: empty and error head with an h2.t-sect,\n'
        '           quiet with a p.t-head. A probe keyed on the tag saw two of the\n'
        '           three and reported the third as absent. */\n'
        '        const head = c.querySelector(".t-sect, .t-head, h1, h2, h3");\n'
        '        if (!head) return null;\n'
        '        const par = Array.from(head.parentElement.children)\n'
        '          .find((el) => el !== head && el.matches("p.t-body"));',
        "rung probe: find the heading by role, not by tag",
    ),
    (
        '  const selected = await page.evaluate(() => {\n'
        '    const f = window.LATELY_FIXTURE;\n'
        '    const text = String(window.getSelection() ?? "");\n'
        '    const magnitudes = [String(f.bound.openCount), String(f.weeks[f.weeks.length - 1].v)];\n'
        '    return { leaked: magnitudes.filter((n) => new RegExp(`\\\\b${n}\\\\b`).test(text)), len: text.length };\n'
        '  });\n'
        '  ok("and a real selection returns none of its magnitudes",\n'
        '    selected.leaked.length === 0, JSON.stringify(selected));',
        '  /* Scoped to the skeleton. Select-all returns the header and the coverage\n'
        '     footer as well, and the footer legitimately carries the bound nine —\n'
        '     the claim that it should stop saying so was raised this round and\n'
        '     refuted. What is asserted is the skeleton s own contract: a frame that\n'
        '     says it has not read the numbers hands none of them over. */\n'
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
        "selection probe: scope it to the skeleton it is a claim about",
    ),
])

print("batch 2b applied")
