# Shared Timeline as a countdown (6 October 2026)

Branch `design/app-v3-timeline-countdown`, PR #231. Sprint to-do item 7: the Timeline redesign from `design/v3-design-source-snapshot`.

## What changed

The shared Timeline artifact (`src/modules/timeline/components/artifact/`), the page guests see at `/s/[token]`, moves from the 18 August "Option D rail" to the Countdown. The founder picked that direction on 28 September (B, with A's to-scale strip and D's finale). Only the four artifact files were ported. The snapshot's other Timeline style files were older than `main` and are left as `main` has them.

Fixed while porting:

- The snapshot drew "Share this timeline" in the header and again at the finale. Now the finale offers it only where the header is hidden. A contract test pins this.
- A jumped-to row rang for 900ms. It now rings for 220ms, within the ui-wave3 contract's 300ms limit for Timeline feedback.

## Registry, fixtures and the critical spec

- No registered source changed. The `/s/[token]` route files are untouched, and the artifact component is not registered by source.
- `experience/critical-fixtures.json`: the case "tasks.page.s-by-token / link-only wedding artifact" proved "populated" with the old rail's milestone button ("Menu tasting at The Orchard. Our next milestone. 1 August 2026. Milestone 3 of 9."). It now proves it with the Countdown's own words, "Our next milestone", which appears once and is visible at all four sizes.
- `experience/tests/critical-experiences.spec.ts`: the shared Timeline block asserted the old rail's countdown/progress toggle, rail buttons and arrow keys. It now asserts:
  - the 79-day count and its labelled group;
  - the today marker;
  - from 1280, the to-scale strip's progress ("2 of 9 milestones complete") and a milestone link that jumps to its row;
  - below 1280, no strip;
  - 44px buttons on a phone.

  The response headers, the single view request and the no-external-requests checks are unchanged.

## Receipts

A receipt is bound to the fixture manifest and the spec it was reviewed under, so both changes unbound the fifteen receipts the Home and Overview port had written. Each one is re-attached here with a receipt that carries the original review text. Their sources and hashes are unchanged, and the earlier receipts stay where they were. All fifteen cite `experience/evidence-runs/tasks-playwright-152b697e705e4e2deaa90833-fdf3d010f52663aa.json`: the critical capture, 132 of 132, on a demo build of `f947ad5`.

## Evidence

Lab `shots/app-reviews/2026-10-06-timeline-countdown/`: a review-mode build of `/s/<demo token>` at 1920, 1440, 768 and 390, with one Share at each size and no console errors.
