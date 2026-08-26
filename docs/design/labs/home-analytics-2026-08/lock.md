# The lock · Lately

What the panel may not re-open, and the receipts for each entry. From here
on `elevate.config.json` is enforced mechanically by `audit.mjs`, so a
change to anything below is a design decision, not a tweak.

---

## The pick, and why there was no directions bake-off

`elevate`'s explore phase ends at a founder pick between two or three fully
resolved directions. **That pick has already happened**, twice, on the
record, before this engagement opened:

1. The first prototype of Lately was built as an **editorial briefing**, in
   the register the five Wave 5 lab compositions were written in under
   `studio/BRAND.md` §5.1's chart prohibition.
2. The operator rejected it outright and named the replacement: *"a
   beautiful, delightful analytics page that is visually impressive and
   useful… the beautiful graphs and animations and the kpi cards are the
   signal."* §5.1 was amended the same day; the ban became a standard.
3. Commit `2899693b` rebuilt the surface as an instrument. That is the
   direction this engagement elevates.

Re-running a bake-off against a decision the operator has already made
twice would spend a third of a three-round budget re-litigating it. The
direction is locked to **the instrument**, and the exploration budget goes
where the brief says it should: the chart forms, the composition, the
motion, the twin and the phone.

## The palette

Every colour that paints on this surface is one of these, at some alpha.
`audit.mjs` checks the declared value; contrast is judged on the composited
one. Each entry has a job; none is here for taste.

| Token | Hex | Its job |
|---|---|---|
| Paper | `#ffffff` | card ground, light |
| Paper 2 | `#fafafa` | page ground, light |
| Paper 3 | `#f4f4f5` | limit tiles and quiet plates |
| Ink | `#111111` | primary text; the denominator plate |
| Ink 2 | `#3f3f46` | secondary text; light-mode context marks in the twin |
| Ink 3 | `#71717a` | tertiary text — 4.83:1 on paper, 4.68:1 on paper 2, and **never** placed on paper 3, where it measures 4.48 |
| Ink 4 | `#a1a1aa` | secondary text on the dark ground (7.0:1 on `#18181b`); tertiary rule work in light |
| Ink 5 | `#d4d4d8` | the context mark — every column that is not live |
| Line | `#e4e4e7` | reserved hairline step |
| Indigo 600 | `#4f46e5` | the live mark, light. 6.6:1 on paper |
| Indigo 500 | `#6366f1` | the sequential step above 600; shared by both grounds |
| Indigo 400 | `#818cf8` | the live mark, dark. 5.9:1 on `#18181b`; 600 on a near-black ground reads as a bruise |
| Amber 600 | `#d97706` | status 1 — hasn't moved. Mark only: 3.24:1 as text |
| Red 500 | `#ef4444` | status 3 — past the day. Mark only: 3.76:1 as text |
| Emerald 600 | `#059669` | status 4 — clear. Mark only: 3.55:1 as text |
| Ground | `#0f0f10` | page ground, dark |
| Ground 2 | `#18181b` | card ground, dark |
| Ground 3 | `#27272a` | limit tiles, dark |

**Status order is fixed** — amber → indigo → red → emerald. All six
validator checks pass in both modes at that order; red adjacent to amber
fails CVD separation at 4.4, so they are never adjacent. Each status ships
with its own **shape** as well as its colour, and its word in ink.

## The ladders

- **Type ramp** 11 · 12 · 13 · 15 · 17 · 20 · 26 · 34 · 64. Enforced in the
  render and again in the stylesheet source, so a literal cannot bypass it.
- **Leading**, by role, not by size: flat 1 · hero 1.04 · tight 1.15 ·
  head 1.25 · label 1.35 · lede 1.45 · body 1.55. A 15px control and a 15px
  paragraph are two different objects; `data-type` on the element tells the
  gate which is which, so the check and the design cannot drift apart.
- **Letterfit**, same argument: display −0.03em · head −0.015em · flat 0 ·
  unit 0.04em · label 0.09em.
- **Space** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72, as named tokens. The gate
  reads the source for raw px in `margin`, `padding` and `gap`, because a
  render cannot tell a token from the number it resolves to.
- **Radii** 0 · 2 · 4 · 6 · 8 · 12 · 16 · 999.
- **Motion** durations 0 · 0.08 · 0.14 · 0.22s on transitions;
  easings `cubic-bezier(0.23, 1, 0.32, 1)` and `cubic-bezier(0.4, 0, 0.2, 1)`.

## The URL contract

The master answers three keys and **stops on anything else** — it does not
render the default and let you believe you asked for it.

```
?state=  full · partial · quiet · first-run · empty · loading · error
?v=      light · dark
?motion= play · settled     (default: play for a person, settled for automation)
```

`?motion=` was added at scaffold time and is load-bearing for the record,
not a convenience: twenty-six of fifty-six frames differed between two
identical shot runs because the harness photographs 350ms into a 1.7-second
entrance. A frame that is not reproducible cannot evidence a change.
Automation lands on the settled surface; `?motion=play` drives the
choreography so the behaviour gate can prove it still runs.

## The configuration that is graded

The shipping configuration and its ground-flipped twin, and nothing else:
`v=light` and `v=dark`, seven states, four viewports — 56 combinations,
every one of them measured every round.

## The benchmarks

**xAI / Grok** and **SpaceX** for dense, technical, confident instrument
readings; **Linear, Stripe and Vercel** as the standing suite bar. Named
verbatim to every seat, and **not moved mid-engagement**: one engagement
swapped its benchmark set at round 8 and its floor fell 8.2 → 6.4, not
because the work got worse but because it was being measured against
something else.
