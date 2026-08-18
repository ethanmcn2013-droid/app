import io

# ── A · the phone ──────────────────────────────────────────────────
h = 'docs/design/labs/notes-2026-08/direction-a.html'
s = io.open(h, encoding='utf-8').read()
s = s.replace("""  .run { padding-bottom: 104px; }
  .dockWrap { padding-bottom: 12px; }
  .dockHint { display: none; }""",
"""  .run { padding-bottom: 148px; }
  .dockWrap { padding-bottom: 12px; }
  .dockHint { display: none; }
  /* The placeholder is one sentence and it is not shortened for a small
     screen. So the field opens at two lines here rather than clipping it
     mid-word, which is the whole reason the sentence exists. */
  .dockField { min-height: calc(1.5em * 2); }
  .dock { align-items: flex-start; padding-top: 6px; }
  .dockGlyph, .dockSend { margin-top: 2px; }""")
io.open(h, 'w', encoding='utf-8', newline='\n').write(s)

# ── B · the phone ──────────────────────────────────────────────────
h = 'docs/design/labs/notes-2026-08/direction-b.html'
s = io.open(h, encoding='utf-8').read()
s = s.replace("""  .headInner, .bandInner { padding: 0 18px; }""",
"""  .headInner, .bandInner { padding: 0 18px; }
  /* The workspace name is the one fact a phone can afford to drop: the
     product is named beside it and there is only ever one notebook. */
  .headName, .headRule { display: none; }
  /* The band's sentence and its control both have to survive. Stacking
     them keeps the sentence whole rather than wrapping the button. */
  .band .bandInner { height: auto; padding-top: 11px; padding-bottom: 11px; flex-wrap: wrap; row-gap: 9px; }
  .bandInner .chip { margin-left: 0; white-space: nowrap; }
  /* The write zone loses its desktop air; on a phone the first note has
     to be reachable without scrolling past an empty field. */
  .writeMain { padding-bottom: 12px; }
  .writeFoot { margin-top: 10px; }
  .writeAside { padding: 8px 0 0; }
  /* The capsule already carries the account on a phone, and the locked
     architecture merges the two objects here. A second avatar in the
     dock is the same control twice. */
  .dockAvatar, .dock .dockRule:last-of-type { display: none; }""")
io.open(h, 'w', encoding='utf-8', newline='\n').write(s)

# ── C · the phone ──────────────────────────────────────────────────
h = 'docs/design/labs/notes-2026-08/direction-c.html'
s = io.open(h, encoding='utf-8').read()
s = s.replace("""  .dockField { min-width: 0; }
  .dockField span, .dockField kbd { display: none; }""",
"""  .dockField { min-width: 0; }
  .dockField span, .dockField kbd { display: none; }
  /* The capsule carries the account on a phone. A second avatar in the
     dock is the same control twice. */
  .dockAvatar { display: none; }
  .dock .dockRule:last-of-type { display: none; }""")
io.open(h, 'w', encoding='utf-8', newline='\n').write(s)

print("phones patched")
