# Notes · the full state sweep · 2026-08

Twenty-nine states of Signal Notes as it stands, driven through the real
interface against the review fixture (The Orchard, the pinned 16 July clock)
at `http://localhost:3510`. 1440×960 at DPR 2. Zero console errors.

This is the "before" the 2026-08 Notes re-exploration is judged against. The
pinned eight-state, four-viewport set at `../reference-2026-08/notes-*` is the
same build; this folder covers the twenty-one states that set does not reach.

- 23 states from `scripts/design/notes-scenes.mjs` (inherited, unmodified)
- 6 states from `scripts/design/notes-scenes-extra.mjs` (this programme)

`notes-scenes.mjs` fails on four scenes against this build: the voice flow
gained a consent stage it does not know about, and the photo primary action is
now "Read with AI". The sibling exists for that reason and is documented in
`docs/design/labs/notes-2026-08/DIRECTIONS.md` §0.

Verdicts: `capture-report.txt` and `capture-report-extra.txt`.
