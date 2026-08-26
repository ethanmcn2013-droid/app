# Build list — noticed, deliberately not built

Round one of a new artefact is exactly where new surface is most expensive: across
rounds 12 to 15 of Tasks, 53% / 39% / 54% / 68% of each round's confirmed defect
cost came from surface built since the previous review. Rising, not falling. So
everything below is written down and not built.

Ordered by what I would schedule first, not by size.

---

## 1 · Timeline's 845 behaviour assertions, against this file

`_wt-timeline-redesign/scripts/design/interaction-check.mjs` is the largest gate in
the three engagements and it is **genuinely repointable** — it drives the master
through `?state=` and `?v=`, both of which reach the composed file. It is not done.

This is the single largest piece of outstanding verification in the build. Everything
else in this list is a feature; this is a measurement I did not take.
Half a day, mostly mechanical: the same URL patch `tools/gates.mjs` already applies
to the other three, plus whatever it asserts about the window scrolling that the
sheet now does instead.

The Tasks and Notes interaction checks are a different case and are argued in
`COMPOSITION.md` §10 — they drive the console's harness, which does not exist here.
Rewriting them against the suite is a day and is not the same task.

---

## 2 · The ledger should read the board, not a snapshot of it

Notes' "what has crossed into Tasks" pile now derives its lane column from the board
**at load** (`COMPOSITION.md` §3). It should read it live: move a card on the board,
go to Notes, and the ledger should say where the card is now. That is the suite
being real rather than being consistent once.

Two hours. It needs a decision first about whether Notes may hold a live reference
into Tasks' working set, or whether the suite brokers it — the second is right and
is slightly more work.

---

## 3 · The crossing times and the completion dates disagree

`s3` says it crossed two days ago; the board says the task was completed on 2 July,
two weeks earlier. Tasks records no created-at, so there is nothing to reconcile
against without adding a field to the fixture. A day, and a decision before it is
work: either Tasks' fixture gains a created date, or Notes' ledger stops printing a
relative time for a crossing older than the board can account for.

---

## 4 · The ink twin has no sheet edge

On `?p=timeline&ground=ink` the sheet and the floor are both `#111111`, so the sheet
disappears and the artifact floats on the floor with only the capsule to locate it.
The lab never had this problem because the artifact was the page.

Not on the shipping room — paper is what ships and ink is a deep link. The honest
fix is one of the two edges Timeline already draws (`.tl-device` at `--fore-16`,
`.tl-paperEdge` at `--fore-10`) applied at `full` medium on the ink ground, which is
a design decision about whether the twin is a sheet or a room. Two hours after that
decision.

---

## 5 · Home, Inbox, Help, More and the account tile

Six doors that say they are not here yet. Out of scope by the brief and left exactly
as the two products drew them. Listing them here so the list is complete, not
because I think they should be next.

---

## 6 · The three surfaces the suite makes newly obvious

Noticed while composing, all out of scope, none started:

- **The seam only runs one way.** A task on the board carries `fromNote` and cannot
  open the note it came from. The join in `src/fixture.js` already holds both ends,
  so the data is there; what is missing is a control on the card and a decision about
  whether Tasks is allowed to send you to Notes mid-board.
- **A crossing lands silently on the board you are not looking at.** Send from Notes
  and the card appears in Tasks with no trace when you next arrive — no arrival beat,
  no count moving under the tile. The Tasks lock's completion beat is the obvious
  model for it. This is the most tempting thing in the list and it is the one most
  likely to cost a round.
- **The spine has no unread or count affordance.** Deliberate: inventing one is
  inventing a notification system.

---

## 7 · Smaller

- **`?state=` is per-product and the URL only carries one.** `?p=notes&state=voice`
  works; there is no way to deep-link Tasks-in-planning *and* Notes-in-voice at once.
  Nobody has asked for it and the contract in the brief does not require it.
- **`tools/split.mjs` is a one-shot with `--force`.** If the labs ever move, the 30
  asserted patches throw and the derivation has to be re-reconciled by hand. That is
  the intended behaviour and it is the right one, but it means the labs really are
  frozen now.
- **`verify.mjs` takes about three minutes.** It opens roughly sixty pages. It could
  share browser contexts; it does not.
- **The three products each keep a `resize` listener and a `ResizeObserver` live
  while off the floor.** Harmless — they repaint a hidden box — but it is work being
  done for nothing three times over.
- **`shots/PAIRS.html` is lab furniture** and is not registered anywhere. If it
  should be an artifact for the record, it needs a pass at its own bar first.
