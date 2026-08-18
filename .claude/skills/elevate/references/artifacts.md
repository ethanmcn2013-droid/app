# The artifacts

Every engagement publishes exactly two living pages, plus one record at
close. They are the founder's window into the loop — designed to be read
from a phone in an office far from the machine doing the work. Treat their
freshness as a contract.

## The heartbeat rules

- Both pages republish at the END of every round, seconds apart, to the
  SAME URLs all engagement (redeploy the same file path; never mint new
  URLs mid-engagement). The founder reads the timestamps as a pulse: a
  fresh pair means a round just closed; a stale pair past ~1.5 round-times
  means the session is stalled and needs a restart.
- Push the branch in the same breath. Artifacts prove progress; the branch
  preserves it.
- Both pages are held to the engagement's own palette lock. A report that
  broke the rule it is reporting on would be a poor argument for the rule.
  Run `verify-artifact.mjs` (light/dark/mobile) before each republish.

## 1 · The Design Console

The real master with a control panel on it — never a picture of one, never
a reimplementation. Built by `scripts/build-console.mjs`, which COMPILES
the master into the console shell:

- The master's CSS is scoped under one `.deck` element (`:root`/`html`/
  `body` become `.deck`; every selector is prefixed; decision attributes
  like `[data-cards="flat"]` attach directly to `.deck` because that is
  where the panel writes them).
- `@media (max-width: N)` blocks are rewritten to `.deck[data-w="…"]` for
  each preview width, so responsive behaviour is live and switchable inside
  the page rather than theoretical.
- Fonts, fixture, icons and renderer all travel inline — a published
  artifact allows no external hosts (Google Fonts excepted).

Console anatomy: a quiet ink side panel (the console is not the product —
it stays quieter than the thing it drives) carrying: the room presets
("start from a finished version, then change anything underneath"), the
named design decisions as toggles, screen/width controls, a copyable
"this combination" recipe, and a reset. The stage holds the deck. A foot
note states the lock: every control writes the attribute the product
reads, every combination is buildable, nothing here can reach an
unratified colour.

After every build, `verify-console.mjs` must pass.

## 2 · The Elevation Log

The record of a locked design being taken to a gate. Built by
`scripts/build-report.mjs` from three inputs it can never drift from:

- `panel.json` — the scored rounds (shape below);
- the palette inventory, extracted from the MASTER'S OWN STYLESHEET at
  build time (the receipt cannot disagree with the file it describes);
- the current frames, re-shot this round and packed to WebP data URIs.

Log anatomy, in order: masthead (engagement name, standfirst, the facts
row — rounds, findings, confirmed, gate); **the gate chart** — every seat,
faint bars for earlier rounds, solid for now, one indigo line at the gate;
**the palette receipt** — the three swatches and the generated
value-in-use table; **the rounds**, newest first — each with its headline,
its counts pill (N findings · N confirmed · N refuted), and its worst
findings as seat / cost / problem → done; **the current build** — every
state at the grading viewport, click to open full size; **the rooms**;
a link card to the console; and the **how-the-panel-works foot** — seats,
blindness, refuter-defaults-refuted, drive-from-round-1, scores may fall,
the gate is unanimous.

### panel.json shape (the report shell renders exactly this)

```json
{
  "gate": 9.5,
  "seats": ["UI composition", "Typography", "Interaction and states",
            "UX and information design", "Brand and copy",
            "Product taste and emotional resonance", "Measured evidence"],
  "rounds": [
    {
      "round": 1,
      "scores": { "UI composition": 6.3, "...": 0 },
      "findings": 35, "confirmed": 20, "refuted": 15, "fixed": 20,
      "headline": "Two blockers and a keyboard trap. …",
      "worst": [
        { "seat": "Interaction and states", "cost": 2,
          "problem": "what was wrong, specifically and measurably",
          "done": "what was done about it, past tense, verified" }
      ]
    }
  ]
}
```

Write the round entry immediately after the fixes verify — the headline is
written while the round is fresh, in the log's register: plain, specific,
unimpressed by effort. Refuted findings stay in the engagement's working
records even though the log's `worst` shows only confirmed work.

## 3 · The Session Record (at close)

One page, built once, when the loop ends — the 15-minute founder read.
Anatomy (follow `assets/examples/` and the log's own style): **the
number** — the lowest seat, huge, against the gate, with every seat listed;
**the arc** — one lane per round, min-to-max bars, the gate line, with the
dips explained honestly; **what exists now** — the master, the console, the
gates, with their sizes and counts; **the honest distance** — every
remaining item with a size in hours or days, plus the harshest seat's
verdict quoted verbatim; **next** — "You — 15 minutes" and "Me — on your
word" columns. Publish as its own artifact; it does not replace the log.

## Publishing mechanics

Use the environment's artifact publishing (same file path → same URL).
Record both URLs in `elevate.config.json` under `artifacts` at first
publish so later sessions — including a resumed session after a crash —
republish to the same addresses instead of minting new ones. Artifacts are
private by default; the founder chooses sharing.
