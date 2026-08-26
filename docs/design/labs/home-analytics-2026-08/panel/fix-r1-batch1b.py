# Batch 1, second pass. The gutter was right; the two anchors were not.
import io, os, sys

LAB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
p = os.path.join(LAB, "lately.html")
s = io.open(p, encoding="utf-8").read()

def sub(old, new, label):
    global s
    if old not in s:
        sys.stderr.write("MISS: %s\n" % label)
        sys.exit(2)
    s = s.replace(old, new, 1)
    print("  ok  %s" % label)

# The live week's value reads INTO the rail by right-aligning to its own
# column's right edge — which is the rail's left edge — rather than being
# pushed past it. The axis values keep the far right. They then sit a
# gutter apart at every width instead of on top of each other.
sub(
    "/* The live week is the last column, so its value reads out into the\n"
    "   rail rather than centring over a mark at the plot's edge. */\n"
    ".colw:last-child .bar-val { left: 100%; right: auto; transform: none; padding-left: var(--gap-tight); }",
    "/* The live week is the last column, so its value right-aligns to the\n"
    "   rail's edge rather than centring over a mark at the plot's edge. */\n"
    ".colw:last-child .bar-val { left: auto; right: 0; transform: none; }",
    "gutter: right-align the live value inside the plot",
)

# The previous best is 8 and no historical week tops 7, so the LEFT end of
# the record line is clear paper at every width while its right end runs
# permanently under the hatched partial column — which is a protected
# object and must not be knocked out by a label's paper background.
sub(
    ".record-tag { position: absolute; right: 0; bottom: calc(var(--r) * 1%); color: var(--ink-3); background: var(--paper); padding-left: var(--gap-hair); margin-bottom: 4px;",
    ".record-tag { position: absolute; left: 0; bottom: calc(var(--r) * 1%); color: var(--ink-3); background: var(--paper); padding-right: var(--gap-hair); margin-bottom: 4px;",
    "record tag: anchor left, where the rule is clear",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 1b applied")
