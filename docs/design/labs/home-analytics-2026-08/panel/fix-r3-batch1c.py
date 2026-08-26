# Round 3, batch 1c — the probe I wrote was itself half-vacuous.
#
# fix-r3-batch1.py added a liveness probe for the month guard and built two
# of its three cases as regex LITERALS carrying doubled backslashes, which
# is the exact defect the batch exists to close: /\\d/ matches a literal
# backslash followed by d, so `dated` and `day` were false whatever the
# probe was given, and `!dated && !day` passed on nothing.
#
# One construction, used three times, with a fresh RegExp per call so the
# g flag's lastIndex cannot make the result depend on call order either.
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
        r'      const re = new RegExp("(?<!\\d\\s)\\bAugust\\b(?!\\s+\\d{4})", "g");'
        "\n"
        r'      return { bare: re.test("finished in August, before the week is out"), dated: /(?<!\\d\\s)\\bAugust\\b(?!\\s+\\d{4})/.test("August 2026"), day: /(?<!\\d\\s)\\bAugust\\b(?!\\s+\\d{4})/.test("4 August") };',
        r'      /* One construction, three probes, a fresh RegExp per call. Written'
        "\n"
        r'         first as two regex literals carrying doubled backslashes — which'
        "\n"
        r'         is the defect this whole block exists to close, and would have'
        "\n"
        r'         made two of the three cases false whatever they were given. A'
        "\n"
        r'         fresh instance each time also keeps the g flag s lastIndex from'
        "\n"
        r'         making the answer depend on the order the cases are read. */'
        "\n"
        r'      const src = "(?<!\\d\\s)\\bAugust\\b(?!\\s+\\d{4})";'
        "\n"
        r'      const hit = (s) => new RegExp(src).test(s);'
        "\n"
        r'      return { bare: hit("finished in August, before the week is out"), dated: hit("August 2026"), day: hit("4 August") };',
        "probe: one construction, three live cases",
    ),
])

print("batch 1c applied")
