# Tasks redesign comparison scorecard

## Acceptance method

Four fresh, read-only reviewers scored the final hydrated comparison evidence as an evidence-integrity auditor, product/design chair, technical/accessibility reviewer, and devil's-advocate rejector. The values below are their arithmetic means. A score without a screenshot, test, interaction, source, accessibility, performance, or production-isolation pointer was not accepted.

The 9.9 gate remains aspirational: overall average must be at least 9.9, every category must be at least 9.5, and all automatic-fail conditions must remain false. Scores were not raised to satisfy that target.

## Final panel score

| Category | A — Quiet Command | B — Editorial Project Room | C — Signal Spatial |
| --- | ---: | ---: | ---: |
| Information architecture | 9.32 | 9.60 | 9.25 |
| Project orientation | 8.85 | 9.80 | 9.40 |
| Cross-view data integrity | 9.78 | 9.78 | 9.78 |
| Scanability and density | 9.22 | 9.38 | 9.17 |
| Interaction clarity | 9.38 | 9.40 | 9.07 |
| Direct manipulation | 9.38 | 9.30 | 9.30 |
| Progressive disclosure | 9.10 | 9.20 | 8.95 |
| Brand distinctiveness | 8.45 | 9.35 | 9.70 |
| Visual craftsmanship | 9.02 | 9.53 | 9.52 |
| State completeness | 9.78 | 9.78 | 9.75 |
| Accessibility | 9.78 | 9.78 | 9.78 |
| Responsive desktop behavior | 9.35 | 9.45 | 9.13 |
| Performance | 8.93 | 9.25 | 7.50 |
| Maintainability | 9.57 | 9.33 | 8.47 |
| Overall product coherence | 9.20 | 9.63 | 8.98 |
| **Overall average** | **9.27** | **9.50** | **9.18** |
| **Lowest category** | **8.45** | **9.20** | **7.50** |

## Gate disposition

| Option | 9.9 average | Every category ≥9.5 | Automatic fail | Critical/serious defect | Disposition |
| --- | --- | --- | --- | --- | --- |
| A | No | No | None evidenced | None unresolved | Selection-ready, below aspirational gate |
| B | No | No | None evidenced | None unresolved | Strongest single option, below aspirational gate |
| C | No | No | None evidenced | None unresolved | Selection-ready with material complexity/performance risk |

No option is a recolour or theme over one shared DOM. Each has a dedicated shell and four dedicated view implementations. No option copies competitor pixels, neglects Timeline or Calendar, uses fake interactions, fabricates dates, forks the inspector, omits keyboard focus, depends on sparse data, breaks the document at 1024px, or relies mainly on indigo. C approaches—but does not cross—the unnecessary-complexity fail line.

## Evidence receipts

- Final visual comparison: `artifacts/tasks-redesign/comparison-normal-1440.png`, `comparison-dense-1024.png`, and `comparison-normal-1920.png`; 72 responsive/density screenshots passed at 1024, 1280, 1440, 1728, and 1920px.
- Interaction and truth: 45/45 Playwright cases in `e2e/design-lab/tasks-design-lab.spec.ts` passed with zero runtime console errors, one shared inspector, cross-view edits, Board drag, bulk actions, explicit scheduling, focus restoration, keyboard behavior, and no geometry for undated tasks.
- State coverage: 12/12 empty/loading/error/read-only captures passed.
- Accessibility: 12/12 axe outputs contain zero serious, critical, or blocking findings. The 1024px target inventory found no sub-24px target lacking the 24px spacing exception and no sub-20px failure.
- Domain integrity: `fixtures.ts`, `dates.ts`, `store.tsx`, and their tests prove one 48-task fixture, explicit schedule variants, valid ranges, unique content, and no fallback dates.
- Performance: every dense surface stayed below 7,000 DOM nodes and avoided document overflow. B Timeline measured 854ms settle, 1,217 DOM nodes, and a 50ms longest observed long task. C Timeline measured 1,860ms, 1,764 nodes, and 351ms. These are comparative warm-development observations, not production Web Vitals.
- Isolation: 13/13 lab unit/guard/isolation tests passed. The built production server returned 404 for both the base lab URL and a fully populated C/Calendar URL even with `SIGNAL_TASKS_DESIGN_LAB=true` and review mode requested.
- Repository health: lint, TypeScript, design-token drift, full repository tests, experience self-tests, and the Next.js 16.2.4 production build passed.

## Option trade-offs

### A — Quiet Command

A is the cleanest operational baseline: restrained controls, strong Board/List density, clear direct manipulation, and the best maintainability score. It loses ground because its project orientation is thin, its visual language can read as a polished generic task tool, and its dense Timeline still produced 2,626 DOM nodes and a 156ms long task.

### B — Editorial Project Room

B is the strongest single option. Workspace purpose, planning-period context, progress, commitments, and selected-day context produce the highest orientation and coherence scores. Its performance is the most balanced across all four views. The cost is contextual overhead above the work and imperfect progressive disclosure at dense widths.

### C — Signal Spatial

C has the strongest brand distinction and a genuinely authored spatial planning model. Its optional planning rail and milestone language are valuable signatures. The full composition carries too many simultaneous concepts, however, and its List/Timeline/Calendar long-task evidence is materially worse. That lowers performance, maintainability, disclosure, and overall coherence.

## Evidence-backed recommendation

Recommend `HYBRID`, without treating that recommendation as Ethan's selection:

1. Use B's project shell: workspace title and purpose, planning-period orientation, progress, commitments, and selected-day agenda.
2. Use A's compact command layer, Board/List density, quieter inspector relationship, and operational restraint.
3. Use A's Timeline geometry/performance baseline with B's compact planning-story summary; do not restore repeated per-row date cells.
4. Use the restrained A/B Calendar composition with B's selected-day context.
5. Borrow only C's optional wide-desktop planning rail, milestone language, spatial grouping, and restrained Signal-specific accents. Keep the rail collapsed at 1024px and do not import C's full always-visible metadata system.
6. Preserve the shared store, shared inspector, explicit schedule union, state contracts, keyboard model, and accessibility evidence unchanged.

If one unmodified option must be chosen, B is the evidence-backed choice. No Phase 2 work begins until Ethan explicitly selects A, B, C, or an exact hybrid.

## Unresolved acceptance limits

- This is a development-only, session-only comparison lab; it does not prove production persistence or authenticated production journeys.
- Performance observations are development comparisons, not production Web Vitals.
- Planning geometry retains contained horizontal scrolling below its useful minimum width.
- Automated axe and keyboard evidence do not replace assistive-technology user testing.
- C requires substantial complexity and long-task reduction before it is the safest implementation base.
