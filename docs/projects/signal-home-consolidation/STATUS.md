# Status — Signal → Home consolidation

Updated: 2026-08-04 (ship) · Overall: **verified; shipping via PRs**

## Completed
- Phase 1 audit + decisions D1–D12 + control docs (commit 1).
- App: Home (/app/home) + Today's Signal + Coming up + Needs review, all
  states; Full Briefing relocation; edge 308s with query preservation;
  orchestrator capture + recordReadState; analytics events; capture
  route hardening (commit 2).
- App: nav consolidation (rail/pills/mobile/palette/launcher/user
  button), contracts in lockstep, module boundaries, main-landmark fix,
  registry surgery (8 new experiences, 2 retired, legacy redirect cases),
  three-product copy, URL contract amendment (commit 3).
- Studio: homepage relay Act IV = Home; hero sequence ends "your daily
  signal"; header switcher + mega panel (3-up grid) + footer;
  pills/launcher home-first; /features/daily-briefing built; /signal
  301; sitemap swapped; root metadata + JSON-LD; pricing rewritten
  (3 products + briefing band, FAQs, compare table).
- Launch-asset inventory (LAUNCH-ASSET-CHANGES.md): signal-intro film
  storyboard/VO + press masters flagged P0; social/identity masters
  verified clean.

## In progress
- App critical evidence suite re-run (144 cases) after the main-landmark
  fix; receipts rebind + validate follow.
- Opus sweeps: studio audience pages (agent A), studio emails/HQ
  (agent B). App public-page sweep (agent C) done + reviewed: 2 correct
  edits accepted; its escalations (launcher string, suite-contracts
  JSON) handled by lead — launcher fixed, contracts JSON deliberately
  kept (D3, legacy ids).

## Remaining
- Evidence closure (attest + rebind 16 receipts + validate green).
- Studio: agents' output review; build + battery; venue-contract note.
- Full functional matrix + visual QA both repos; QA.md; dispatch
  entries; final report.

## Blocked
- Nothing.

## Risks
- Studio's venue-edition contract reads the frozen sibling `app/` tree
  (old worktree with protected Wave-2 work) and fails on a comment that
  is already fixed on this branch; local-only artifact. CI topology to
  verify at merge time.
- Studio work/page.tsx type error expected to be fixed by agent A
  (its file); verify at review.

## Validation state
- App: tsc clean · lint 0 errors (74 pre-existing warnings; new files 0)
  · unit/contract suite 408/408 · experience validator pending receipts
  rebind · critical suite re-running.
- Studio: tsc clean except agent-owned work/page.tsx (in flight);
  battery run pending after agents land.

## Delegated work and ownership
| Agent | Scope | Files | State |
|---|---|---|---|
| A (Opus) | Studio audience/static pages | students, teachers, weddings, venues*, work, about, press, proof, terms, compare, redeem | running |
| B (Opus) | Studio emails + dispatch preamble + HQ live claims | emails/templates, dispatch chrome, hq libs, atlas, org-intel, account fixtures | running |
| C (Opus) | App public pages | waitlist, marketing components, social, for/* | done — reviewed + accepted |
*venues: Signal-product references only; commercial terms untouched (D-003..D-006).
