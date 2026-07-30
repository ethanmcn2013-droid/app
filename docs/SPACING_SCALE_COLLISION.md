# The `--spacing-*` namespace collision

Status: **root cause identified, not yet fixed.** The tap-target symptom is
fixed (see "What was fixed", below). The underlying collision is still live and
needs an operator decision because the fix is cross-repo and touches ~500 call
sites.

## The mechanism

`src/ds/tokens.css` defines a semantic step scale:

```
--space-1: 4px   --space-5: 20px   --space-9:  48px
--space-2: 8px   --space-6: 24px   --space-10: 64px
--space-3: 12px  --space-7: 32px   --space-11: 80px
--space-4: 16px  --space-8: 40px   --space-12: 96px
```

`src/ds/tailwind.css` then maps each one into Tailwind v4's **numeric spacing
namespace**:

```css
@theme inline {
  --spacing-1: var(--space-1);
  /* … */
  --spacing-11: var(--space-11);
}
```

Tailwind v4 derives numeric spacing utilities from `calc(var(--spacing) * N)`
where `--spacing` is `0.25rem`. Declaring `--spacing-11` overrides **only** the
`11` key. Indices 1–12 are overridden; 13 and up fall through to Tailwind's
default. Compiled through the repo's real token chain:

| index | declaration | resolves to | Tailwind default | |
|---|---|---|---|---|
| 1–6 | `var(--space-N)` | 4–24px | 4–24px | agree |
| 7 | `var(--space-7)` | **32px** | 28px | diverges |
| 8 | `var(--space-8)` | **40px** | 32px | diverges |
| 9 | `var(--space-9)` | **48px** | 36px | diverges |
| 10 | `var(--space-10)` | **64px** | 40px | diverges |
| 11 | `var(--space-11)` | **80px** | 44px | diverges |
| 12 | `var(--space-12)` | **96px** | 48px | diverges |
| 13 | `calc(var(--spacing) * 13)` | 52px | 52px | agree |
| 14 | `calc(var(--spacing) * 14)` | 56px | 56px | agree |
| 16 | `calc(var(--spacing) * 16)` | 64px | 64px | agree |
| 20 | `calc(var(--spacing) * 20)` | 80px | 80px | agree |
| 24 | `calc(var(--spacing) * 24)` | 96px | 96px | agree |

Reproduce with Tailwind's own compiler, not by inference — see
"Reproducing the table" below.

## Why this is a broken namespace, not just a surprising one

Because the override stops at 12, **both scales are live simultaneously**. That
produces two defects that no amount of documentation fixes:

**1. Value collisions — one value, two indices.**

```
64px  <-  p-10  and  p-16
80px  <-  p-11  and  p-20
96px  <-  p-12  and  p-24
```

**2. Non-monotonicity — a higher index can be smaller.**

```
min-h-13 (52px) < min-h-10 (64px)
min-h-14 (56px) < min-h-11 (80px)
min-h-16 (64px) < min-h-11 (80px)
min-h-20 (80px) < min-h-12 (96px)
```

`min-h-11` is 80px but `min-h-14` is 56px. Nothing in the class name signals
which scale a given number belongs to, and the repo uses both: indices 14/16/20/24
appear 153 times, so authors are already writing Tailwind-scale numbers.

## Evidence that authors meant the Tailwind scale

This is the load-bearing part of the argument. Four governance artifacts state a
px intent in prose and encode it as a token that does not deliver it:

1. **`scripts/check-chrome-contract.mjs:152`**
   ```js
   mustContain(bar.source, "h-10", "Studio Bar contract: slim 40px bar (T·96, reads as a light frame edge)")
   ```
   `h-10` is **64px**. The studio bar measures **1280×64** on desktop. The gate
   passes because it greps for the class name, never the computed value. The bar
   is 60% over its own documented contract, and the contract check is green.

2. **`src/server/suite-navigation-contract.test.mjs`** — test named
   *"…preserves 44px primary targets"*, asserting `md:pointer-coarse:h-11` and
   `pointer-coarse:h-11`. Those render **80×80**.

3. **`src/modules/timeline/timeline-owner-accessibility-contract.test.mjs`** —
   asserts `min-h-11` with the message *"both owner mode controls must be at
   least 44px high"*. Rendered **80px**.

4. **`ds-foundation/scripts/build-tailwind.mjs`** — the generator's own comment:
   ```js
   // spacing → --spacing-* (utilities: p-1 … p-12 on the base-4 scale)
   ```
   The values are all divisible by 4 but are not `index * 4`. The DS author
   described the output as the base-4 scale, which is what every reader assumes.

Additional corroboration:

- `src/components/studio-bar/studio-bar.tsx` sets the bar to
  `h-14 md:h-10 md:pointer-coarse:h-11`. As Tailwind numbers that reads
  "56px on phones, slim 40px on desktop, 44px when the desktop is a
  touchscreen" — coherent. As DS numbers it is 56px → **64px** → **80px**: the
  desktop bar is *taller* than the mobile bar.
- The same file reaches for arbitrary values (`w-[60px]`, `w-[248px]`) whenever
  an exact px was needed — the numeric scale was not trusted for exact values.
- `min-h-[44px]` already appeared 4 times before this change, including on a
  control sitting in the same nav row as two `min-h-11` siblings.

**All 52 index-11 sizing utilities in the repo were tap-target patterns.** Not
one was an intentional 80px block. The `pointer-coarse:` variants settle it:
that variant exists only for touch input, where 44px is the WCAG 2.5.5 / iOS HIG
minimum. There is no reading in which `pointer-coarse:h-11` means "80px on
touch devices".

## Measured impact before the fix

Review dev server, `NEXT_PUBLIC_SIGNAL_ACCESS_MODE=review`, Playwright, 390×844
and 1280×800. 124 control instances measured; **72 at `min-height: 80px`**.

| viewport | control | before | after |
|---|---|---|---|
| mobile | studio-bar wordmark (in a 56px bar) | 48×**80** | 48×44 |
| mobile | "New task" | **80×80** | 44×44 |
| mobile | account avatar ("DO", 11px label) | **80×80** | 44×44 |
| mobile | suite menu items ×4 | 194×**80** | 194×44 |
| mobile | "View timeline" | 53.8×**80** | 53.8×44 |
| mobile | "Edit milestones" | 47.5×**80** | 47.5×44 |
| mobile | "Preview public copy" | 324×**80** | 324×44 |
| desktop | suite menu items ×4 | 194×**80** | 194×44 |
| desktop | "View timeline" / "Edit milestones" | 106×**80** / 117×**80** | ×44 |

Two findings worth calling out:

- The **mobile studio-bar wordmark overflowed its own bar**: an 80px box inside a
  56px `header`. That is a layout break, not only a hit-target problem.
- The timeline mode nav had two 80px segments sitting directly beside a 44px
  `min-h-[44px]` primary button in the same flex row — the inconsistency was
  visible on screen.

## What was fixed

46 index-11 sizing utilities across 12 files → explicit `[44px]`:

```
min-h-11 → min-h-[44px]     h-11 → h-[44px]
min-w-11 → min-w-[44px]     w-11 → w-[44px]
```

Variant prefixes preserved (`md:pointer-coarse:min-h-[44px]`, etc.). A bracketed
value cannot drift if the token scale changes again.

Deliberately **not** changed:

- `src/modules/signal/components/brief/quiet-briefing-ledger.tsx` (4 hits) —
  Signal-owned surface, excluded by operator instruction. **Still 80px.**
- `src/components/studio-bar/studio-bar.tsx` bar shell
  (`md:h-10 md:pointer-coarse:h-11`) — a container height, not a tap target.
  Dropping the shell to a literal 40px/44px while its contents are still
  inflated by the same remap (`h-8` = 40px) would leave the controls flush
  against the bar edges. Shell and contents have to move together, which is the
  `--spacing-*` fix, not a local patch.

Three contract assertions were retargeted from the `-11` literal to the literal
`44px`, so they now enforce the intent their own messages state.
`scripts/check-tap-target-scale.mjs` (wired into `pnpm test`) fails the build on
any new index-11 sizing utility, with a shrink-only ledger for the outstanding
Signal file.

## What is still live

Indices 7–10 and 12 remain remapped. Static count over `src/`:

| | uses | files |
|---|---|---|
| sizing utilities (box geometry) at 7–10, 12 | ~185 | — |
| spacing utilities (rhythm) at 7–12 | ~270 | — |
| **total affected by un-remapping** | **501** | **108** |

The worst remaining concentrations:

- `min-h-10` = **64px**, 25 uses — 20 of them form inputs in
  `src/components/app/your-work/your-work-view.tsx`. 64px text inputs.
- `h-7`/`w-7` = **32px** (Tailwind 28px), 38 uses — icon buttons.
- `h-8`/`w-8` = **40px** (Tailwind 32px), 32 uses — icon buttons, avatars, the
  studio-bar search field.
- `w-10` = **64px** (Tailwind 40px), 20 uses — avatars and marketing icon wells.

## Proposed root-cause fix

The collision lives in the DS, not in Tasks. `src/ds/tokens.css` and
`src/ds/tailwind.css` are vendored (`signal-design-system@2.0.1`, marked *do not
edit*) and generated by `ds-foundation/scripts/build-tailwind.mjs`
(`signal-ds@2.1.0`). `scripts/ds/ds-check.mjs` also forbids redefining
`--space-*` in any app CSS outside `src/ds/`, so there is no legitimate local
override — patching this in Tasks would be drift that the next vendor sync
erases.

**Recommendation: stop emitting `--spacing-*` from the DS generator.** Delete one
rule from `build-tailwind.mjs`:

```js
// spacing → --spacing-* (utilities: p-1 … p-12 on the base-4 scale)
[/^--space-(\d+)$/, (n) => `--spacing-${n.match(/\d+/)[0]}`],
```

Consequences:

- Every numeric utility becomes `index * 4px`. One scale, monotonic, no
  collisions. `min-h-11` means 44px, which is what every developer and all four
  governance artifacts already assume.
- The semantic scale stays fully available and unambiguous as `var(--space-N)`
  — `p-[var(--space-11)]` where an 80px step is genuinely wanted.
- If the DS wants the step scale to keep first-class utilities, emit it under
  **named** keys instead (`--spacing-sm|md|lg|xl`), giving `p-lg` and leaving the
  numeric namespace to Tailwind. This is the cleaner long-term API and does not
  collide by construction.

Cost and risk: **501 call sites across 108 files in this repo change computed
size**, and Notes / Timeline / Signal vendor the same DS, so each needs the same
sweep. Most changes shrink values toward what the author wrote (7→28, 8→32,
10→40), so the majority should be corrections rather than regressions — but that
is an argument for doing it deliberately with a visual pass, not for doing it
quietly. It should be its own cycle with before/after screenshots per surface,
not folded into a tap-target fix.

Sequencing suggestion:

1. Land the tap-target fix (done — it is correct under either scale, since 44px
   is an absolute accessibility floor).
2. Bump `signal-ds`, drop the `--spacing-*` rule, re-vendor into one product
   repo behind a preview deploy.
3. Sweep that repo's 7–12 call sites with measured before/after per surface,
   including the studio-bar chrome as one unit.
4. Repeat per product; then make `check-chrome-contract.mjs` and the a11y
   contract tests assert **computed px** rather than class-name substrings, so a
   token whose value drifts can no longer pass a green gate.

## Reproducing the table

Do not infer these values — compile them. Run from the repo root with
`node_modules` installed:

```js
import { compile } from "tailwindcss";
// entry: @import "tailwindcss"; @import "src/ds/tokens.css"; @import "src/ds/tailwind.css";
// then compile(entry, {...}).build(["min-h-11", "min-h-14", "p-8", …])
// and read the emitted declarations.
```

The measurement harness used for the before/after table drove Playwright against
the `tasks-review` dev server (`.claude/launch.json`) and read
`getComputedStyle` + `getBoundingClientRect` for every element carrying an
index-11 sizing utility.
