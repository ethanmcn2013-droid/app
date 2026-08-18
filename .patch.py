import io

# ══ the writing column is the measure, not a share of the paper ═══
p = 'docs/design/labs/notes-2026-08/master.css'
s = io.open(p, encoding='utf-8').read()
old = """.top[data-two] {
  display: grid; grid-template-columns: minmax(0, 1fr) 296px; column-gap: 30px;
  align-items: start; grid-template-rows: auto;
}"""
assert old in s
s = s.replace(old, """.top[data-two] {
  /* The writing column IS the measure. Given a share of the paper it was
     wider than the measure and capped inside itself, so a twenty-word
     note floated in a column of dead white with the margin cramped
     beside it. The margin takes whatever is left. */
  display: grid; grid-template-columns: minmax(0, var(--measure)) minmax(276px, 1fr); column-gap: 34px;
  align-items: start; grid-template-rows: auto;
}""", 1)

s = s.replace(""".headFacts { display: flex; align-items: center; gap: 14px;""",
"""/* What the house is facing, at the head of the sheet. The top-line fact
   was a generic count of unread items while the thing that actually
   presses on this person — a wedding in two days with notes unresolved —
   was already in the data and printed only as a group rule. */
.headNext { display: inline-flex; align-items: baseline; gap: 8px; flex: none; min-width: 0; }
.headNext b { font-size: var(--t-15); line-height: var(--lh-base); font-weight: 600; letter-spacing: var(--tr-16); color: var(--ink-1); white-space: nowrap; }
.headNext span { font-size: var(--t-13); line-height: var(--lh-base); color: var(--ink-2); letter-spacing: var(--tr-14); white-space: nowrap; }
.headFacts { display: flex; align-items: center; gap: 14px;""", 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

# ══ the head leads with what the house is facing ══════════════════
p = 'docs/design/labs/notes-2026-08/notebook.js'
s = io.open(p, encoding='utf-8').read()
old = """      <header class="head">
        <span class="word">notes</span>
        <span class="headRule" aria-hidden="true"></span>
        <h1 class="headName">${esc(N.workspace)}</h1>
        ${chip}"""
assert old in s
s = s.replace(old, """      <header class="head">
        <span class="word">notes</span>
        <span class="headRule" aria-hidden="true"></span>
        <h1 class="headName">${esc(N.workspace)}</h1>
        ${next()}
        ${chip}""", 1)

old = """  function pendingChip(n) {"""
assert old in s
s = s.replace(old, """  /* The one fact this notebook has that no other product's would: the day
     the house is running, and how long there is. */
  function next() {
    const soon = N.next;
    if (!soon) return "";
    const waiting = work().filter((n) => n.pending && n.aboutKey === "mara-finn").length;
    return `
      <span class="headNext">
        <b>${esc(soon.label)}</b>
        <span>${esc(soon.when)}, in ${soon.days} day${soon.days === 1 ? "" : "s"}${waiting ? `, ${waiting} still to decide` : ""}</span>
      </span>`;
  }

  function pendingChip(n) {""", 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print("the writing column is the measure; the head leads with what the house is facing")
