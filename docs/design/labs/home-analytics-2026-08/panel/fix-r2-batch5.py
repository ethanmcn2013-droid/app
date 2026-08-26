# Round 2, batch 5 — eight confirmed findings, each with the refuter's fix
# where it replaced the seat's.
import io, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.join(HERE, "..")
p = os.path.join(LAB, "lately.html")
s = io.open(p, encoding="utf-8").read()

def sub(old, new, label):
    global s
    if old not in s:
        sys.stderr.write("MISS: %s\n" % label)
        sys.exit(2)
    s = s.replace(old, new, 1)
    print("  ok  %s" % label)

# ── 1 · rise-fill-outranks-every-interaction-rule ─────────────────────
# `both` puts the keyframe's end state in the animation origin, above every
# author declaration, forever — so the card's hover lift and its press had
# never painted. `backwards` keeps the hidden state through the stagger
# delay and releases the element to the cascade when the run ends. rise's
# end state is identical to the resting state, so no pixel moves.
sub(
    ".rise { animation: rise 0.5s var(--ease) both; animation-delay: calc(var(--i) * 65ms); }",
    "/* backwards, not both. A forwards fill sits in the animation origin and\n"
    "   outranks every author declaration permanently: the KPI card's hover\n"
    "   lift and its press were pinned dead by their own entrance, and the\n"
    "   assertion that was meant to catch it grepped the stylesheet for the\n"
    "   selector instead of rendering it. The end state is the resting state,\n"
    "   so releasing it changes nothing that is drawn. */\n"
    ".rise { animation: rise 0.5s var(--ease) backwards; animation-delay: calc(var(--i) * 65ms); }",
    "entrance: release the element to the cascade",
)
sub(
    "a.kpi:active { transform: translateY(0); }",
    "a.kpi:active { transform: translateY(0); background: var(--paper-3); border-color: var(--ink-4); }",
    "press: a channel that does not depend on hover",
)
sub(
    "a.kpi:hover { border-color: var(--line); transform: translateY(-2px); }",
    "a.kpi:hover { border-color: var(--line); transform: translateY(-2px); }\n"
    ".kpi { transition: border-color 0.14s var(--ease), transform 0.14s var(--ease), background-color 0.14s var(--ease); }",
    "press: ease the background with the rest",
)

# ── 2 · keyboard-cannot-scroll-the-reading-surface ────────────────────
# Every pixel of the page sat inside a div with height:100vh and overflow
# auto, and html and body were pinned to 100%, so the document had nothing
# to scroll. Space, PageDown, ArrowDown and End all moved zero at every
# width until the reader had put focus inside the region some other way.
sub(
    "html, body { height: 100%; }",
    "/* The document is the scroller. With every pixel inside a 100vh div and\n"
    "   html/body pinned to 100%, the primary reading gesture — space, page\n"
    "   down — moved nothing on a fresh load, at any width, in any state. */\n"
    "html { height: 100%; }\nbody { min-height: 100%; }",
    "scroll: give the page back to the document",
)
sub(
    ".app { display: flex; min-height: 100%; background: var(--paper-2); }",
    ".app { display: flex; min-height: 100vh; background: var(--paper-2); }",
    "scroll: the shell is at least a screen tall",
)
sub(
    ".rail {\n  width: 56px; flex: none;",
    "/* Sticky rather than stretched, so the product's rail stays put while\n"
    "   the document scrolls under it. Inert below 561, where it is hidden. */\n"
    ".rail {\n  position: sticky; top: 0; height: 100vh; align-self: flex-start;\n  width: 56px; flex: none;",
    "scroll: the rail stays put",
)
sub(
    ".canvas { flex: 1 1 auto; min-width: 0; overflow: hidden; }\n.scroll { height: 100vh; overflow-y: auto; overflow-x: hidden; }",
    ".canvas { flex: 1 1 auto; min-width: 0; }\n"
    "/* clip, not hidden: overflow:hidden on one axis forces the other to\n"
    "   auto and would reinstate the trap this fix exists to remove. */\n"
    ".scroll { overflow-x: clip; }",
    "scroll: stop being a scroll container",
)

# ── 3 · fortnight-label-escapes-its-card ──────────────────────────────
# The label hung off one side of its rule with no counter-anchor, so on a
# quiet account — axis 15, rule at 93% — it left the strip at every width
# and was guillotined mid-word by an ancestor's clip, which is why the
# document reported no overflow at all.
sub(
    ".fortnight span { position: absolute; top: 0; left: var(--gap-tight); color: var(--ink-3); white-space: nowrap; }",
    ".fortnight span { position: absolute; top: 0; left: var(--gap-tight); color: var(--ink-3); white-space: nowrap; }\n"
    "/* An anchor with only one bound leaves the card the moment the rule sits\n"
    "   near the end of a derived axis. Flipped by measurement, not by a typed\n"
    "   breakpoint, and reset before every measurement so it can flip back. */\n"
    ".fortnight[data-flip] span { left: auto; right: var(--gap-tight); }",
    "fortnight: a label with two bounds",
)
sub(
    "  const relayout = () => { deswarm(); measureReading(); };",
    "  /* The fortnight label, measured against the strip it belongs to. */\n"
    "  const measureFortnight = () => {\n"
    "    const rule = root.querySelector(\".fortnight\");\n"
    "    const strip = root.querySelector(\".strip\");\n"
    "    if (!rule || !strip) return;\n"
    "    rule.removeAttribute(\"data-flip\");\n"
    "    const span = rule.querySelector(\"span\");\n"
    "    const box = strip.getBoundingClientRect();\n"
    "    const r = span.getBoundingClientRect();\n"
    "    if (r.right > box.right + 0.5) rule.setAttribute(\"data-flip\", \"\");\n"
    "  };\n"
    "  const relayout = () => { deswarm(); measureReading(); measureFortnight(); };",
    "fortnight: measure it where the marks are measured",
)

# ── 4 · kpi-cards-announce-their-fact-twice ───────────────────────────
# A link takes its name from its contents, so the authored sentence arrived
# prefixed by the loose numerals it was written to replace.
sub(
    '      ${known\n        ? `<span class="t-num" data-type="bignum">${n}</span>`\n        : `<span class="t-num na" data-type="bignum">&mdash;</span>`}\n'
    '      <span class="t-small dim-2" data-type="small">${esc(known ? phrase : word.many)}</span>\n'
    '      ${known\n        ? `<span class="meter" aria-hidden="true"><i class="${n === 0 ? "zero" : ""}" style="--f:${share};--i:${i}"></i></span>`\n'
    '        : `<span class="t-label dim" data-type="label">Not available</span>`}',
    '      ${known\n        ? `<span class="t-num" data-type="bignum" aria-hidden="true">${n}</span>`\n        : `<span class="t-num na" data-type="bignum" aria-hidden="true">&mdash;</span>`}\n'
    '      <span class="t-small dim-2" data-type="small" aria-hidden="true">${esc(known ? phrase : word.many)}</span>\n'
    '      ${known\n        ? `<span class="meter" aria-hidden="true"><i class="${n === 0 ? "zero" : ""}" style="--f:${share};--i:${i}"></i></span>`\n'
    '        : `<span class="t-label dim" data-type="label" aria-hidden="true">Not available</span>`}',
    "kpi: the sentence is the whole name",
)

# ── 5 · status-indigo-is-the-only-mark-the-dark-twin-forgets ──────────
# The four status glyphs hard-coded their hues, so alone on the surface
# they did not take the ground flip: Indigo 600 sat at 2.55:1 on the dark
# plate, forty pixels from its own meter painting Indigo 400.
for name, hexv, tone in [
    ("still", "#d97706", "--amber"),
    ("past", "#ef4444", "--red"),
    ("nobody", "#4f46e5", "--accent"),
    ("waiting", "#059669", "--emerald"),
    ("clear", "#059669", "--emerald"),
]:
    sub('stroke="%s"' % hexv, 'stroke="currentColor"', "glyph %s: take the ground flip" % name)

sub(
    'function label(text) {',
    "/* Each status mark carries its own tone on the wrapper, so the glyph can\n"
    "   inherit it and the twin's indigo step reaches the one mark that used to\n"
    "   miss it. The four tones are the reserved status four; --accent is the\n"
    "   only one the dark ground redefines, which is exactly the one that had\n"
    "   to move. */\n"
    "const TONE = { still: \"--amber\", past: \"--red\", nobody: \"--accent\", waiting: \"--emerald\", clear: \"--emerald\" };\n"
    "\n"
    "function label(text) {",
    "glyphs: a tone per status",
)
sub(
    '      <span class="glyph" aria-hidden="true">${glyph}</span>',
    '      <span class="glyph" aria-hidden="true" style="color:var(${tone})">${glyph}</span>',
    "kpi: wear the tone",
)
sub(
    "function kpi({ n, word, glyph, i, unavailable = false }) {",
    "function kpi({ n, word, glyph, tone, i, unavailable = false }) {",
    "kpi: take the tone",
)
for k in ["still", "past", "nobody", "waiting"]:
    sub("glyph: ICON.%s, i:" % k, "glyph: ICON.%s, tone: TONE.%s, i:" % (k, k), "row: pass the %s tone" % k)
sub(
    '<span class="glyph" aria-hidden="true">${ICON.clear}</span>',
    '<span class="glyph" aria-hidden="true" style="color:var(--emerald)">${ICON.clear}</span>',
    "quiet: the clear mark keeps its tone",
)

# ── 6 · focused-mark-lands-flush-on-the-window-edge ───────────────────
# The browser's minimal scroll parked the first mark on the window edge with
# the bottom of its ring and the whole ruler below the fold, and held every
# mark there for the rest of the traversal. 48 is the rung that clears the
# card; 24 does not.
sub(
    "  left: calc(var(--x) * 1%); transform: translateX(-50%);\n}",
    "  left: calc(var(--x) * 1%); transform: translateX(-50%);\n"
    "  /* Focus brings the ruler and the card's own edge with it. */\n"
    "  scroll-margin-bottom: var(--gap-hall);\n"
    "  scroll-margin-top: var(--gap-room);\n}",
    "marks: focus arrives with its ruler",
)

# ── 7 · resize-strands-focus-below-the-fold ───────────────────────────
sub(
    '  window.addEventListener("resize", () => { relayout(); queueMove(); });',
    "  /* A resize re-lays the marks and the browser does not follow focus, so\n"
    "     a reader loses the ring and the mark's title — which lives nowhere\n"
    "     else on this screen — with no way back but Tab. */\n"
    '  window.addEventListener("resize", () => {\n'
    "    const held = document.activeElement;\n"
    "    relayout();\n"
    "    if (held && held !== document.body && root.contains(held)) {\n"
    "      const b = held.getBoundingClientRect();\n"
    "      if (b.top < 0 || b.bottom > window.innerHeight) held.scrollIntoView({ block: \"nearest\" });\n"
    "    }\n"
    "    queueMove();\n"
    "  });",
    "resize: keep the reader's place",
)

# ── 8 · the-all-clear-sentence-drops-one-of-its-four-categories ───────
sub(
    "moved inside a fortnight, none is past its day, and every one has a name on it.",
    "moved inside a fortnight, none is past its day, every one has a name on it, and none is waiting on anything else.",
    "quiet: the all-clear names all four",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 5 applied")
