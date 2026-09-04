# Confirmed by reproduction, not by refuter

Three findings in this round describe one defect: the media-query
listeners the 2 September ledger added threw `C is not defined` on every
crossing of 720, in all three products, and the timeline kept the desk's
`across` composition on a phone.

They did not go to refuters. A refuter's job is to kill a claim by opening
the file and checking it, and by the time these could have been sent the
defect was already fixed — so a refuter driving the current build would
have refuted all three as "already handled" and the record would have
shown the round finding nothing. That would be false.

Instead they are confirmed by direct reproduction, which is stronger than
a refuter's reading:

- `evidence-gate-failing.log` is `interaction-check.mjs` run against the
  frozen build with the new crossing assertions in place and no source
  change yet: **five red**, three of them `ReferenceError: C is not
  defined`, one `layout=across visible toggles=2` on a 390px viewport,
  one `narrow lanes=5 rows=0`.
- The same gate on the fixed build is green at 137 assertions.

The seats that raised them: Interaction and states
(`phone-crossing-throws-referenceerror`, `board-view-never-rederives-on-resize`)
and Measured evidence
(`timeline-720-crossing-throws-and-leaves-across-on-a-phone`) — three
seats' worth of independent sighting of one root cause, which is itself
the strongest signal in the round.
