# Launch-asset changes — external creative presenting four products

Assets outside the two web repos that verbally or visually present the
four-product model. None were edited in this pass: `signal-motion` is
the Codex motion lane (workspace contract — do not rewrite the other
lane's work), and `collateral` masters are rendered print/press
artifacts. Inventory below; every item names its exact required change.

Replacement language (canonical): headline "Notes. Tasks. Timeline. One
clear system." · support "Capture the thinking. Move the work. See the
plan." · briefing positioning "Your daily signal, built into Home." ·
never "four products" / "fourth product" / Signal-as-product.

## signal-motion (Codex lane — brief Codex, do not edit directly)

| Asset | Where used | Problem | Required change | Blocks launch? | Priority |
|---|---|---|---|---|---|
| `docs/signal-intro/MASTER_STORYBOARD.md` (drives the flagship intro film) | Flagship brand film, homepage/social | Storyboard narrates four products with Signal as the fourth act | Re-script act IV: the day's read happens **in Home** ("Today's Signal"); product acts reduce to three; closing loop returns to Home. Composition: keep the indigo-dot grammar; the dot lands home in the final frame. | **Yes** — a launch film claiming four products contradicts every page | P0 |
| `docs/signal-intro/VOICEOVER.md` | Same film | VO lines enumerate "Notes, Tasks, Timeline, Signal" | Replace enumeration with "Notes, Tasks, Timeline — one clear system", briefing line: "and every morning, your daily signal, built into Home." | Yes (with the storyboard) | P0 |
| `docs/signal-intro/PHASES.md`, `MOTION_REVIEW.md` | Production docs for the film | Same enumeration in phase descriptions | Update alongside the re-script; review criteria gain "no four-product claim". | With the film | P1 |
| `docs/meet-dot`, `docs/the-period` shorts | Social shorts | Verify per-script; the dot/period conceits are brand-safe | Sweep scripts for product-count claims when next touched | No | P2 |

## collateral (rendered masters — regenerate after copy fix)

| Asset | Where used | Problem | Required change | Blocks launch? | Priority |
|---|---|---|---|---|---|
| `masters/press/press-release.html` | Press kit | Body enumerates four products | Re-render with three products + "daily briefing built into Home" paragraph; keep the founder-story arc untouched otherwise | Yes if press kit ships at launch | P0 |
| `masters/press/founder-story.html` | Press kit | Same enumeration in the product paragraph | Same replacement language; the story itself is history and stays | Yes with press kit | P0 |
| `masters/social/*`, `masters/identity/*`, `masters/ambassador/*`, `masters/venue/*` | Social/OOH/venue kits | Verified this pass: **no** four-product enumerations found in these masters | None (re-verify visually at regeneration for grid compositions) | No | P2 |

## Other workspace directories

| Asset | Problem | Required change | Blocks launch? |
|---|---|---|---|
| `hero-gallery` (four-hero review app, private repo) | Internal review tool of four pre-consolidation heroes | None — internal historical tool; do not ship links to it | No |
| `creative-partner-deck`, `plan.signalstudio.ie` deck | May pitch four products | Sweep decks before next external send; product slide → three + Home briefing beat | Only if sent externally |
| App/studio OG images (`opengraph-image.tsx`, `social/*`) | Checked in-repo this pass: no four-product compositions remain ("four" hits are Tasks' four *views*, which stay true) | None | No |

## Not launch assets (recorded to close the question)
- `signal-review`, `signal-directors`, `analytics-demo`, `component-lab`,
  `ds-foundation`, archived worktrees: internal tooling/history — no
  public exposure, no change.
