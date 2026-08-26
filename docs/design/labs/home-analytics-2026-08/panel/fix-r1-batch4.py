# Round 1, batch 4 — provenance, the twin, the refusals, the tooltip anchor,
# and the cheap refinements the refuters sharpened rather than killed.
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

# ── 1 · coverage-strip-sits-outside-every-landmark ────────────────────
sub(
    '      <div class="coverage t-label" data-type="label">',
    '      <footer class="coverage t-label" data-type="label" aria-label="What this reading was built from">',
    "coverage: a landmark of its own",
)
sub(
    '        <span><b>Lab</b> weekly counts and ages are lab-authored; ${esc(D.workspace)}, ${esc(D.owner)}, the reading date and the ${D.open} are bound to the shipping fixture</span>\n      </div>',
    '        <span><b>Lab</b> counts and ages are lab-authored</span>\n      </footer>',
    "coverage: close the landmark, and stop setting a sentence in the stamp voice",
)

# ── 2 · dark-denominator-card-is-a-glare-panel ────────────────────────
# --ink inverts to #ffffff in the twin, so the quietest plate in the row
# became the brightest object on a near-black page — and at 900px and below
# it spans the full width. Ink 5 keeps it unmistakably an inverted plate at
# a third less emitted light, and needs no text changes: the inherited
# paper lands at 11.98:1 and the existing t-small at 7.07:1.
sub(
    "[data-v=\"dark\"] .bar.part { background: repeating-linear-gradient(135deg, var(--accent) 0 2px, rgba(255, 255, 255, 0) 2px 6px); }",
    "[data-v=\"dark\"] .bar.part { background: repeating-linear-gradient(135deg, var(--accent) 0 2px, rgba(255, 255, 255, 0) 2px 6px); }\n"
    "/* The plate keeps its job in the twin without keeping its luminance.\n"
    "   Pure white here is 34% more emitted light than Ink 5 and sits in the\n"
    "   middle of a row whose real marks are 3px meters. */\n"
    "[data-v=\"dark\"] .kpi.lead { background: var(--ink-2); border-color: var(--ink-2); }\n"
    "[data-v=\"dark\"] .sk-wrap .kpi.lead { background: var(--paper); border-color: var(--line-soft); }",
    "twin: the denominator plate stops glaring",
)

# ── 3 · stale-tip-strands-on-scroll ───────────────────────────────────
# The tip was placed once in viewport coordinates and the surface scrolls
# inside its own container, so a pinned label ended up 372px from the mark
# it named, sitting on a different card's numeral.
sub(
    "  const place = (el) => {\n    tip.innerHTML = el.dataset.tip;\n    tip.classList.add(\"on\");",
    "  /* Filling and placing are separated so the scroll handler can reposition\n"
    "     without re-parsing the tip's markup on every frame. */\n"
    "  const fill = (el) => { tip.innerHTML = el.dataset.tip; };\n"
    "  const place = (el) => {\n    tip.classList.add(\"on\");",
    "tip: split fill from place",
)
sub(
    "  const show = (el, pin = false) => { place(el); if (pin) pinned = el; };",
    "  let showing = null;\n"
    "  const show = (el, pin = false) => { showing = el; fill(el); place(el); if (pin) pinned = el; };",
    "tip: track what raised it",
)
sub(
    "  const hide = (force = false) => { if (pinned && !force) return; tip.classList.remove(\"on\"); };\n"
    "  const drop = () => { pinned = null; tip.classList.remove(\"on\"); };",
    "  const hide = (force = false) => { if (pinned && !force) return; tip.classList.remove(\"on\"); showing = null; };\n"
    "  const drop = () => { pinned = null; showing = null; tip.classList.remove(\"on\"); };\n"
    "\n"
    "  /* The surface scrolls inside .scroll, not the document, so no scroll\n"
    "     event reaches a window listener without capture. A focus-raised tip\n"
    "     is hidden and restored when its mark comes back; only a touch pin is\n"
    "     retired, because dropping a focused mark's label leaves a visibly\n"
    "     focused mark with no name anywhere on the screen. */\n"
    "  let queued = false;\n"
    "  const onMove = () => {\n"
    "    queued = false;\n"
    "    if (!showing) return;\n"
    "    const b = showing.getBoundingClientRect();\n"
    "    if (b.bottom < 0 || b.top > window.innerHeight) {\n"
    "      if (pinned) drop(); else tip.classList.remove(\"on\");\n"
    "      return;\n"
    "    }\n"
    "    if (pinned === showing || document.activeElement === showing) tip.classList.add(\"on\");\n"
    "    if (tip.classList.contains(\"on\")) place(showing);\n"
    "  };\n"
    "  const queueMove = () => { if (!queued) { queued = true; requestAnimationFrame(onMove); } };\n"
    "  window.addEventListener(\"scroll\", queueMove, { capture: true, passive: true });",
    "tip: follow or retire its mark",
)
sub(
    "  window.addEventListener(\"resize\", relayout);",
    "  window.addEventListener(\"resize\", () => { relayout(); queueMove(); });",
    "tip: re-place after a resize re-lays the marks",
)

# ── 4 + 5 · august-inside-a-july-reading, and the studio vocabulary ───
# The three refusals are the movement no competitor has and they were the
# worst-written thing on the screen: snapshot writers, callers, a date
# recorder, structured decision records, three periods, and the only "we"
# on the surface. Tile two also named a month the reading has not reached.
sub(
    """const LIMITS = [
  ["Open work over time", "The snapshot writer has no callers yet, so there are no earlier readings to compare."],
  ["How a date moved", "The date recorder switched on in August. History accrues forward only."],
  ["Decisions still open", "Notes keeps no structured decision record to read. That is a Notes change, not this one."],
];""",
    """/* Written for the owner, not for the team that built it. The second tile\n"""
    """   states a condition rather than a start date: nothing records a date move\n"""
    """   yet, so naming the month one begins would be a fact the fixture does not\n"""
    """   hold — and the month it used to name had not happened at the reading. */
const LIMITS = [
  ["Open work over time", "Nothing was written down about how much was open in earlier weeks, so there is nothing yet to compare this against."],
  ["How a date moved", "When a date gets moved, nothing keeps a record of it yet. Once something does, only moves from that day on will be in it."],
  ["Decisions still open", "Notes doesn’t keep a list of which decisions are still open, so nothing here can count them. That would be a change in Notes."],
];""",
    "refusals: the reader's language",
)
sub(
    '''      <div class="ghost rise" style="--i:2">
        <div class="ghost-plot" aria-hidden="true">${ghostCols}</div>
        <div class="ghost-say">
          <p class="t-head" data-type="head">This is the chart we would draw</p>
          <p class="t-small dim" data-type="small">and it stays empty until the recorder has run for three periods.</p>
        </div>
      </div>''',
    '''      <figure class="ghost rise" style="--i:2">
        <div class="ghost-plot" aria-hidden="true">${ghostCols}</div>
        <figcaption class="ghost-say">
          <p class="t-head" data-type="head">Open work over time — the chart that would go here</p>
          <p class="t-small dim" data-type="small">Once open work starts being counted each week, it fills in after about a month.</p>
        </figcaption>
      </figure>''',
    "ghost: name the refusal it draws, and be the figure it is",
)
sub(
    ".ghost { position: relative; margin-top: var(--gap-line); padding: var(--gap-room); border: 1px dashed var(--line); border-radius: 12px; }",
    "/* A figure carries a UA margin; the ladder is the only thing that sets\n"
    "   space here. The columns stand on a baseline, drawn as faintly as they\n"
    "   are, so the absence has the shape of a chart rather than a texture. */\n"
    ".ghost { position: relative; margin: var(--gap-line) 0 0; padding: var(--gap-room); border: 1px dashed var(--line); border-radius: 12px; }\n"
    ".ghost-plot::after { content: \"\"; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--line); }",
    "ghost: a baseline for its columns",
)
sub(
    ".ghost-say .t-head { max-width: 26ch; }",
    ".ghost-say .t-head { max-width: 34ch; }",
    "ghost: room for the refusal's own name",
)

# ── 6 · rail-glyphs-outside-the-locked-faces ──────────────────────────
# Geist carries none of U+2302, U+270E or U+2611, so three of the four rail
# marks were drawn by whatever the operating system supplied — a filled
# pencil among three outlines, and a different shape on every machine.
sub(
    '''    <nav class="rail" aria-hidden="true">
      <i class="on">&#8962;</i><i>&#9998;</i><i>&#9745;</i><i>&#8599;</i>
    </nav>''',
    '''    <nav class="rail" aria-hidden="true">
      <i class="on">${RAIL.home}</i><i>${RAIL.notes}</i><i>${RAIL.tasks}</i><i>${RAIL.timeline}</i>
    </nav>''',
    "rail: vector marks",
)
sub(
    "function label(text) {",
    '''/* The rail is drawn, not set. Geist carries none of the three characters
   this used to use, so an OS fallback painted them — a filled pencil beside
   three outlines, and a different shape on every machine. audit.mjs reads
   the authored family, never the painted one, so it could not see it.
   Sixteen on sixteen, at 1.5 stroke, the same pen as ICON. */
const RAIL = {
  home: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 7 8 2.5 13.5 7v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  notes: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.2 2.8a1.7 1.7 0 0 1 2.4 2.4L6.4 12.4l-3.2.8.8-3.2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  tasks: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 8.2 7.3 10l3.4-3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  timeline: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function label(text) {''',
    "rail: the four marks",
)
sub(
    "  font-style: normal; font-size: 13px; color: var(--ink-2);",
    "  color: var(--ink-2);",
    "rail: no type on a textless mark",
)

# ── 7 · openable-is-a-promise-nothing-keeps ───────────────────────────
sub(
    "Counted at the moment each job reached a done column. Every one of them is openable.",
    "Counted at the moment each job reached a done column.",
    "hero: stop advertising a move the surface does not carry",
)

# ── 8 · no-pressed-state-anywhere ─────────────────────────────────────
# Under a coarse pointer there is no hover, so a press is the only channel
# that can confirm a card registered a touch. The dot's press goes on the
# custom property, not on the pseudo's transform, which an animation with
# fill:both would outrank permanently.
sub(
    "a.kpi:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }",
    "a.kpi:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n"
    "a.kpi:active { transform: translateY(0); }",
    "press: the card's lift goes back down",
)
sub(
    ".btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }",
    ".btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }\n"
    ".btn:active { border-color: var(--ink-3); transform: translateY(1px); }",
    "press: the button takes the press",
)
sub(
    ".dot:hover, .dot:focus-visible { --disc: var(--ink); }",
    ".dot:hover, .dot:focus-visible { --disc: var(--ink); }\n"
    "/* On the property, not on the pseudo's transform: the pop keyframes run\n"
    "   with fill:both and would outrank a plain declaration forever. */\n"
    ".dot:active { --disc: var(--ink-2); }",
    "press: the mark takes the press",
)
sub(
    "  border: 0; padding: 0; background: transparent;",
    "  border: 0; padding: 0; background: transparent; cursor: pointer;",
    "press: the marks invite the pointer",
)

io.open(p, "w", encoding="utf-8").write(s)
print("batch 4 applied")
