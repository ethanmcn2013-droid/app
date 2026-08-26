# Signal Studio · the master artefact

**Published:** https://claude.ai/code/artifact/832d5b84-e6a0-43e6-a151-1f80dc17bd76

Notes, Tasks and Timeline as one running application, on one world of data, with a
working spine between them. One self-contained page.

**Read `COMPOSITION.md` first** — it is every decision made where the three sources
disagreed. `BUILD-LIST.md` is everything noticed and deliberately not built.

## The commands

```
node build.mjs                     src/ → master.html            (the living build)
node verify.mjs                    the gate. 130 checks, ~3 min
node verify.mjs --only=seam        one section: fidelity | console | seam |
                                   spine | contract | grounds | motion | labgates
node tools/pairs.mjs               shots/PAIRS.html — the fidelity pairs, lookable
node tools/gates.mjs               the three labs' own audits, against this file
```

`master.html` is generated and is never hand-edited. `_wrapped.html` and
`_gate-*.html` are written by `tools/wrap.mjs` (which `verify.mjs` calls) and exist
only because the published artifact supplies the page skeleton that a local browser
does not.

## The parts

| | |
|---|---|
| `src/shell.css` | the shared Studio Floor — the floor, the spine, the sheet's base |
| `src/tasks.css` · `notes.css` · `timeline.css` | each product, scoped to its own app element |
| `src/fixture.js` | one world — one clock, one cast, one venue, and the join between them |
| `src/app.js` | the suite: the spine, the router, the state container, the seam |
| `src/tasks.js` · `notes.js` · `timeline.js` | the three renderers, as close to unmodified as they could be kept |
| `src/foundation.css` · `icons.js` | shared, byte-identical in both source labs |

`src/` is the source. It was derived once from the three frozen labs by
`tools/split.mjs`, which refuses to overwrite without `--force` — every one of its
30 edits is an asserted patch that throws unless it matches exactly once. The exact
bytes it was derived from are in `_source/`.

## The lab tools

| | |
|---|---|
| `tools/css.mjs` | a strict CSS reader that keeps comments and offsets |
| `tools/survey.mjs` | what the three stylesheets actually share — where the token deltas came from |
| `tools/shell-diff.mjs` | the 21 colliding class names, rule by rule |
| `tools/split.mjs` | the one-shot derivation |
| `tools/gates.mjs` | repoints the three labs' own audits at this file |
| `tools/wrap.mjs` · `shot.mjs` · `labshot.mjs` · `pairs.mjs` | harness |

## Not registered with `apply.mjs`

Deliberately, and it must stay that way. See `COMPOSITION.md` §12.
