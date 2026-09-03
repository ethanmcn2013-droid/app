# Connections and Resources · directions · 2026-09

Design exploration only. Branch `design/project-drive-connections-exploration`,
no PR and no deploy. The reference “before” is recorded in `REFERENCE.md`.
Every direction uses the same Glenmara House fixture, real Signal fonts and all
eight brief states at 390, 768, 1280 and 1440 pixels.

## The brief all directions answer

Attaching a file should remain an ordinary task action while three facts become
easy for a venue operator to answer: whose Drive receives new board files, who
Google says can open them now, and what will remain where it is during a
disconnect or handover. The directions differ in what they make memorable—not
in permissions, routing, legal promises, scope, file limits or shell.

| Job | A · Custodian | B · Ledger | C · Threshold |
|---|---|---|---|
| Name the current storage owner | Human-centred ownership mast | First fact in evidence header | Permanent first stop on ownership rail |
| Show live access, not inferred membership | Warm people roster with a plain Google timestamp | Board role and Google access in separate columns | People checkpoint after the custodian |
| Keep setup truthful | Named progress and individual readiness | Measured 3/5 progress above evidence rows | The access step becomes current |
| Make mismatch impossible to miss | Bordered exception card before roster | Exception summary plus the exact rows | The journey stops at its access checkpoint |
| Explain a handover before confirmation | From/to people card and consequence list | Compact before/after record | A visible threshold future files cross |
| Keep Resources quiet | Provenance in the row’s small print | Stored-in and opens-for columns | A slim destination spine into settled rows |
| Preserve one Attach action | Existing control is untouched | Existing control is untouched | Existing control completes the rail’s final step |
| Handle Drive fallback | One concise exception above files | Same exception, with explicit storage result | Destination message changes without changing intake |

## A · Custodian

**Thesis.** A board’s storage arrangement is easiest to trust when it starts
with one accountable human. Orla is the stable visual anchor; folder and access
facts sit beneath her, while normal operation becomes almost invisible. This is
the warmest and most recognisably Signal answer.

**What it deliberately sacrifices.**

- It takes more height than the ledger because names and reassurance get room.
- Board role and Google access are adjacent rather than rigorously columnar.
- Comparing all five people at once is slower than in Direction B.

**Where it breaks a standing decision.**

1. It renames the former Settings “Storage” destination to **Connections** and
   makes quota secondary. This is already required by the product brief; the
   argument is that the durable user question is accountability, not bytes.
2. It allows a pale indigo owner field inside the otherwise white Settings
   grammar. The field makes the one permanent storage owner findable without
   spending accent on every status.

**Proposed token changes (additive, named).**

- `--x-connection-owner-wash: rgba(79, 70, 229, 0.06)`
- `--x-connection-confirmed-dot: #111111`

**Candidate delight moments.**

- After Attach completes, the new row settles by five pixels and its quiet
  “In Orla’s Drive” provenance appears at the same moment.
- Changing owner morphs only the accountable-person field; the surrounding
  board remains still, reinforcing that existing work did not move.

## B · Ledger

**Thesis.** Trust comes from evidence that can be scanned and compared. The
surface is a restrained access instrument: owner, folder and last check form a
single header; board role and Google access are never allowed to masquerade as
one fact. This is the fastest operational answer for a power user.

**What it deliberately sacrifices.**

- It is cooler and more administrative than Signal’s usual conversational UI.
- Column compression needs careful mobile collapse and can hide useful context.
- The owner is unambiguous but less emotionally memorable than A or C.

**Where it breaks a standing decision.**

1. It introduces a true table into a Settings surface that normally prefers
   cards. The exception is justified because rows share four comparable facts;
   pretending otherwise would make mismatches harder to see.
2. It uses a strong black rule above the ledger. The rule is structural—not
   decorative—and makes the live evidence read as one instrument.

**Proposed token changes (additive, named).**

- `--x-access-rule-strong: rgba(17, 17, 17, 0.16)`
- `--x-access-evidence-label: rgba(17, 17, 17, 0.48)`

**Candidate delight moments.**

- A retried access row changes in place from “Waiting” to “Confirmed”; the
  table does not reorder, flash or celebrate routine safety work.
- Resource provenance aligns into a stable column as files arrive, making the
  result feel certain rather than animated for its own sake.

## C · Threshold

**Thesis.** The product should show one continuous journey from choosing a file
custodian, through keeping access true, to attaching as usual. A persistent
ownership rail turns handover from a scary modal into a comprehensible change
of threshold: future files cross; existing files stay behind.

**What it deliberately sacrifices.**

- It uses the most vertical space and carries the highest initial concept load.
- Its dark custodian field is more expressive than the existing quiet cards.
- The journey metaphor may feel excessive once a board has been stable for a
  long time, so production would need to soften completed steps.

**Where it breaks a standing decision.**

1. It adds a persistent local rail within Settings content. It does not replace
   Settings navigation; it argues that ownership, access and Attach are one
   causal story that deserves visible sequence.
2. It spends a full ink field on the current custodian. This is permitted only
   because the field names the permanent accountable person and is not reused
   as a generic card style.

**Proposed token changes (additive, named).**

- `--x-handover-track: rgba(79, 70, 229, 0.12)`
- `--x-custodian-field: #111111`

**Candidate delight moments.**

- Attach progress travels down the same thin destination spine and resolves
  into a file row, with an equivalent immediate state under reduced motion.
- During handover, the “future files” marker crosses between Orla and Maeve;
  existing-file copy remains fixed on Orla’s side throughout.

## Zones for founder reactions

The comparison surface keeps these numbers stable across all directions and
generates a copyable reaction digest.

| # | Zone | What is in it |
|---|---|---|
| 1 | Chrome and hierarchy | Real Tasks shell, Settings entry, headings and density |
| 2 | Ownership story | Custodian mast, evidence header or ownership rail |
| 3 | Live access truth | Google-derived people states and attention handling |
| 4 | Resources and provenance | Existing Attach grammar, rows, upload and fallback |
| 5 | Motion and reassurance | Setup progress, settled-file transition and reduced-motion parity |

## Selection rule

Choose one thesis—A, B or C—then name any zones from the other directions that
must survive. The selected thesis governs production composition; borrowed
parts cannot turn it into an unprincipled hybrid. Lock-in records the founder’s
choice and objections verbatim before registry changes or app implementation.
