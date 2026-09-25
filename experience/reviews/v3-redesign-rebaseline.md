# v3 redesign re-baseline

**Date:** 24 September 2026
**Branch:** `design/suite-redesign-v3` (PR #201)
**Authority:** founder instruction for the redesign sprint: the app is not to be held back by earlier design contracts, registries or constraints, and the old ones may be updated, changed or deleted. The Tasks Kanban board's structure and behaviour are the one thing kept.

## What changed

The redesign replaces the app shell (one sidebar and top bar instead of the studio bar, icon rail, mobile tab bar and the Tasks Floor's spine and dock) and redesigns Home, Inbox, My tasks, Settings, Projects, Overview, Messages and the new-task dialog. It also adds Files and Analytics. The v3 token layer in `src/ds/v3.css` sets colour, type, radius and shadow for both themes, and its text tokens pass WCAG AA.

## Why the registry was re-baselined

Materiality receipts in `experience/evidence-runs/` are bound to the critical-fixture manifest and to the source hash of the design they reviewed. A redesign of this size changes both at once, so the old receipts cannot be refreshed one surface at a time: each one would attest to a design that no longer exists.

`scripts/experience/rebaseline-v3.mjs` therefore:

1. refreshes every entry's `materialityHash` to the redesigned source;
2. retires the `materialityReview` receipts (the receipt files stay in Git as history);
3. registers the new routes (Files, Analytics and any other new page) with page defaults;
4. stamps `lastReviewedAt` with the re-baseline date.

## What still guards quality

- The critical-experience Playwright capture in `design-quality.yml` still renders every critical page and surface and runs axe on it. The v3 tokens were corrected until those checks passed.
- Unit, contract and security tests are unchanged in intent. Tests that asserted the old chrome's markup were rewritten to guard the new shell's behaviour (see `src/server/suite-navigation-contract.test.mjs`).
- Receipts are re-captured through the normal review flow (`pnpm experience:review`) as each v3 surface is signed off.
