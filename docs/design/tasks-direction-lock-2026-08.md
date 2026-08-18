# Tasks · direction locked · Studio Floor

**Locked by the founder, 2026-08-18.** Branch `design/tasks-exploration`.
Still exploration: no PR, no merge, no deploy, contract gates knowingly unmet
until product lock-in.

## What was chosen

**Direction C · Studio Floor**, from the three presented at
`docs/design/labs/tasks-2026-08/DIRECTIONS.md`.

The architecture is now the working master for Tasks, and the working
hypothesis for Notes and Timeline when their turn comes:

- A **floor** the whole app sits on, not a frame drawn around it.
- One **sheet** holding the product, lifted off the floor.
- The spine **off the wall**: a floating capsule carrying the suite, pointing
  at the sheet it opened.
- Statuses as **trays**, so a card is somewhere rather than merely listed.
- The verbs — search, add, account — collected into one **dock** at the foot
  of the sheet. On a phone the capsule and the dock are the same object.
- Identity on the **sheet's own head**, the way a file names itself.

## What was rejected with it

- **A · Ledger.** Not chosen.
- **B · Atelier.** Not chosen.

Both remain captured at `docs/design/labs/tasks-2026-08/shots/` and described
in `DIRECTIONS.md`. Nothing from them is deleted; elements may still be folded
into the master if they earn it.

## What the founder called out as not yet good enough

Recorded verbatim in intent, because the next round is judged against it:

1. **The task cards are not world class.** The strongest single objection. The
   card system is being rebuilt, not tuned.
2. **The palette is wrong.** Not the grey, not the white, not the paper. The
   ground, the sheet and the trays all need to stop being neutral.
3. **The bar is 9.5 across the board**, not "better than what shipped".

The voice and copy were called out as right and are not being changed.

## Consequences already accepted

Studio Floor contradicts three pinned decisions. They were argued in
`DIRECTIONS.md` before the lock and are now carried forward as accepted:

| Pinned decision | Status after the lock |
|---|---|
| Board pass 3, decision 1 · "Pure white field" | **Superseded.** The canvas is a floor holding a sheet. Reinforced by the founder's own objection to white and grey. |
| Board pass 3, decision 1 · the deleted 5% lane tint | **Partially superseded.** Trays may carry a surface, but never a per-status colour. The original objection was to colour-coding, and that objection stands. |
| Design-system law 2 · "hairlines, not shadows" | **Narrowed, not broken.** Only objects that genuinely float carry a shadow: the sheet, the capsule, the dock, and a card in flight. Everything flat keeps hairlines. |
| "Studio bar + rail · keep. Surgical fixes only." | **Superseded** by the re-exploration brief. The top rail is retired. |

`board-pass3-contract.test.mjs` and `check-chrome-contract.mjs` will both need
rewriting at implementation. Neither is touched during exploration.

## What happens next

Three elevated variations of Studio Floor, differing in ground material and in
card anatomy, are at `docs/design/labs/tasks-2026-08/floor.html`. One of them
becomes the master. After that: Notes, then Timeline, then implementation.
