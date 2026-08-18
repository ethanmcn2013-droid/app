# Notes engagement · disaster-recovery snapshot · 2026-08-18

NOT the engagement. The real work — branch `design/notes-exploration`
(master `docs/design/labs/notes-2026-08/notebook.js` + `master.css`, the
gates `notes-audit.mjs`/`notes-interaction-check.mjs`, the panel runner,
rounds 1–3 of fixes) — exists only on the desktop machine that ran the
Notes session and was never pushed. This directory preserves what was
recoverable from the published artifacts, so a reclaimed container is no
longer total loss:

- `panel.recovered.json` — the full three-round panel record (scores,
  every confirmed and refuted finding with element/problem/fix detail),
  extracted from the Notes Elevation Log artifact as published 09:20 UTC.
- `console.compiled.html` — the Notes Design Console as published: the
  master's complete CSS (scoped under `.deck`), its renderer and fixture
  compiled in. The design is reconstructable from this file.

Delete this directory the moment `design/notes-exploration` lands on the
remote — the branch supersedes it entirely.
