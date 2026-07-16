# Council reviews and refinements

## Council method

Phase 1 uses independent, read-only reviewers. The chair owns synthesis and code changes; council members do not edit shared implementation files. Scores are evidence claims, not votes, and incompatible recommendations are resolved explicitly rather than averaged.

The 15-category rubric order used below is:

1. Information architecture
2. Project orientation
3. Cross-view data integrity
4. Scanability and density
5. Interaction clarity
6. Direct manipulation
7. Progressive disclosure
8. Brand distinctiveness
9. Visual craftsmanship
10. State completeness
11. Accessibility
12. Responsive desktop behavior
13. Performance
14. Maintainability
15. Overall product coherence

## Pre-implementation council

Seven specialists reviewed the production baseline before implementation: product architecture and information hierarchy; visual and brand design; interaction design; accessibility; front-end architecture and performance; state coverage and QA; benchmark and red-team criticism.

### Resolved decisions

- Use the real hierarchy `Account → Planning period → Workspace → View → Task`; do not fabricate a Project entity.
- Keep Board, List, Timeline, and Calendar as peers backed by one task record and one explicit schedule union.
- Use one normalized in-memory store and one shared inspector across all options and views.
- Build A/B/C as separate compositions and view DOMs while sharing domain primitives.
- Preserve explicit unscheduled work; a missing date never receives fallback geometry.
- Keep the fixture large and adverse enough to expose wrapping, density, overflow, relationship, and schedule failures.
- Require keyboard/menu/date-control alternatives for every drag operation.
- Guard the lab at the server boundary before dynamically importing client code.
- Use Signal Studio task tokens and semantic status colours; avoid gradients, glow, glass, decorative dashboards, and indigo-only styling.

### Disagreements resolved

- **Context versus work density:** B keeps the richest workspace brief; A minimizes it; C keeps context and planning relationships spatially adjacent. This disagreement became an option differentiator rather than a compromised shared shell.
- **Inspector versus preview:** all options use the same authoritative inspector. A may add a lightweight preview, B may keep purpose copy in the surface, and C may use a planning rail, but none replaces or forks inspector state.
- **Desktop responsiveness:** planning surfaces retain legible geometry using contained scrolling below their useful minimum width. The document itself must not overflow.
- **Virtualization:** not added for the 48-task Phase 1 fixture. DOM count and warm development timing are measured; repeated Timeline date cells are reduced when evidence shows avoidable cost.

## Review Round 1 — Internal Design Council

Round 1 examines final screenshots, dense and narrow evidence, live interactions, source contracts, axe output, and comparative performance observations. Findings and the chair’s first refinement pass are recorded after all seven reports return.

### Seven-role result

| Role | Blocking defects | Main conclusion |
| --- | --- | --- |
| Product architecture / IA | None | Structure is sound; strengthen planning-period/saved-view truth and reduce exposed secondary controls. |
| Visual / brand | None | A has the best restraint, B the best contextual hierarchy, C the richest operational density; semantic colour and narrow typography need care. |
| Interaction | None | B is the best baseline; interaction alternatives exist but need stronger discoverability and visible focus evidence. |
| Accessibility | None | Do not call the work accessibility-complete without keyboard, focus, live-region, target-size, and two-dimensional planning evidence. |
| Front-end / performance | None | Shared model and guard are credible; reduce repeated Timeline DOM and keep inspector/planning disclosure explicit. |
| State coverage / QA | None | Prove empty/loading/error/read-only and narrow states as first-class evidence, not only fixture inventory. |
| Benchmark / red team | None for the lab | B is the strongest base; A risks generic restraint, C risks ClickUp-like bloat, and none should be represented as production-ready. |

### Unweighted council score average

These are the arithmetic averages of the seven independent score vectors, not the chair’s final evidence score:

| Category | A | B | C |
| --- | ---: | ---: | ---: |
| Information architecture | 7.86 | 8.29 | 7.57 |
| Project orientation | 7.43 | 8.14 | 7.14 |
| Cross-view data integrity | 8.71 | 8.71 | 8.71 |
| Scanability and density | 8.14 | 8.00 | 7.86 |
| Interaction clarity | 7.43 | 7.86 | 7.57 |
| Direct manipulation | 6.86 | 7.43 | 7.71 |
| Progressive disclosure | 6.71 | 7.14 | 6.14 |
| Brand distinctiveness | 7.86 | 8.43 | 8.57 |
| Visual craftsmanship | 7.86 | 8.29 | 7.86 |
| State completeness | 6.71 | 7.57 | 7.29 |
| Accessibility | 7.86 | 7.86 | 7.29 |
| Responsive desktop | 7.00 | 7.43 | 6.29 |
| Performance | 8.57 | 9.00 | 7.86 |
| Maintainability | 8.29 | 8.29 | 7.14 |
| Overall coherence | 8.29 | 8.86 | 8.00 |
| **Overall average** | **7.70** | **8.09** | **7.53** |

### Chair resolution and first refinement pass

- **Accepted:** state modes needed explicit proof. Added three-option browser contracts for empty/loading/error/read-only and captured 12 state screenshots.
- **Accepted:** target size needed evidence. Added a 1024px inventory over all 12 surfaces; no effective target below 20px remains without the WCAG 2.2 24px spacing exception. C/Calendar overflow controls were raised to a 24px minimum after the first audit found four failures.
- **Accepted:** non-colour semantics needed strengthening. Priority dots now include screen-reader text even when the visible label is intentionally compact.
- **Accepted:** view purpose and prototype persistence needed clearer semantics. View tabs now expose purpose descriptions and the ribbon says `non-persistent`, `Local lab`, `session-only`, and `reload resets`.
- **Accepted before reports completed:** B/Timeline’s repeated per-row date-cell DOM was replaced by a shared grid with pointer-derived date drops.
- **Evidence added:** focus-visible checks are now part of every A/B/C × view accessibility run; mutation announcements already use a polite live region and visible undo toast.
- **Rejected as a misread:** the inspector is not persistent in the default screenshots. It opens only after a task is chosen. The visible B agenda and C planning rail are option-specific, complementary surfaces; C’s rail is collapsible and yields when the inspector opens.
- **Deferred to selection:** the council’s proposed hybrid—B context, A restraint, selected C planning depth—cannot be implemented in Phase 1 without choosing for Ethan. It remains the chair recommendation, not an implicit selection.

## Review Round 2 — Red-Team Panel

A fresh seven-lens panel attempts to reject each option for product coherence, visual craft, interaction clarity, accessibility, responsive behavior, technical quality, and derivative-design risk. Credible critical and serious findings are fixed before acceptance review.

### Panel result

- Product coherence, interaction clarity, accessibility, and technical-quality critics found no evidence-backed critical or serious rejection basis for A, B, or C.
- Responsive critic found no critical defect and no confirmed serious defect; B remained conditional because its 1024px context/agenda hierarchy was visibly competitive.
- Visual-craft and derivative-risk critics found no critical defects. They consistently marked B’s 1024px Timeline bands and Calendar agenda, plus C’s narrow-width planning rail, as serious visual-hierarchy risks.
- A received no rejection basis from every Round 2 lens.
- B and C remained conditional until the responsive hierarchy changes below were inspected at native 1024px.

### Critical and serious remediation

- **B/Timeline:** at 1060px and below, the planning story becomes one compact summary line; explanatory copy and milestone strip yield to the unscheduled tray and dated planning grid.
- **B/Calendar:** at 1060px and below, the grid/agenda split changes from a 500px/288px minimum to a 540px/220px relationship, with reduced agenda padding and secondary copy. Native 1024 inspection shows the month grid as the dominant surface.
- **B/workspace context:** compact narrow desktop height is reduced from 142px to 112px so the active work begins earlier.
- **C/planning rail:** below 1180px the rail is collapsed before the first interactive paint, leaving an explicit vertical `Planning` reveal control. At 1440px and above it opens before capture. Both states are hydration-aware and test-enforced; the inspector still displaces the rail when opened at wide inspector breakpoints.
- **C/Calendar:** the collapsed 1024 composition gives the calendar the dominant width and retains contained command-layer scrolling.

### Native inspection disposition

The chair inspected B/Timeline, B/Calendar, and C/Calendar at 1024×1000 after the changes. The serious hierarchy risks were resolved without hiding tasks, removing schedule semantics, or introducing document overflow. No unresolved Round 2 critical or serious issue remains.

## Review Round 3 — Acceptance Panel

The acceptance panel checks the final rubric against screenshots, tests, interaction flow, source, accessibility output, performance observations, browser console evidence, and production-isolation proof. A score without an evidence pointer is discarded.

### Four-role result

Four fresh reviewers independently examined the final 1440px, dense 1024px, and 1920px contact sheets plus the complete evidence packet. Their roles were evidence integrity, product/design acceptance, technical/accessibility acceptance, and devil's-advocate score integrity.

- All four found no automatic-fail condition for A, B, or C.
- All four found no unresolved critical or serious defect and no serious/critical/blocking axe result.
- Every reviewer ranked B first by arithmetic average. One recommended B directly; three recommended an exact hybrid with B as the structural base, A as the operational restraint, and only selected C signature elements.
- Every reviewer rejected an inflated 9.9 pass. The panel means are A 9.27, B 9.50, and C 9.18; the full category matrix is in `07-comparison-scorecard.md`.
- B leads project orientation and overall coherence. A leads restraint and maintainability. C leads brand distinction but carries the clearest complexity and performance penalty.

### Final evidence disposition

- Browser: 45/45 capability, state, interaction, keyboard, focus, date-integrity, and axe cases passed with zero console errors.
- Visual: 72/72 hydration-aware responsive/density captures passed; 12/12 state captures passed. C is asserted collapsed at 1024px and expanded at 1440px and above.
- Accessibility: all 12 axe files contain zero blocking rules. The 1024px target audit found zero under-24px targets without adequate spacing and zero under-20px failures.
- Performance: B Timeline's final dense observation was 854ms settle, 1,217 DOM nodes, and a 50ms longest long task. C Timeline remained the limiting surface at 1,860ms, 1,764 nodes, and 351ms.
- Repository: lint, TypeScript, design-token drift, 13/13 design-lab unit/guard/isolation tests, the full repository suite, experience self-tests, and the Next.js 16.2.4 build passed.
- Production isolation: the built server returned 404 for the base lab path and a fully populated C/Calendar path despite the lab flag being enabled and review mode requested.

### Acceptance decision

Phase 1 is ready for Ethan's design-direction selection, not for production launch. No option reaches the aspirational 9.9 gate. The chair recommends an exact hybrid: B's project shell and orientation, A's command/work-surface restraint and Timeline baseline, B's selected-day Calendar context, and only C's optional wide-desktop planning rail, milestone language, and restrained spatial accents. This is a recommendation, not a selection; Phase 2 remains prohibited.

## Refinement ledger

- Replaced repetitive fixture-purpose copy with 48 distinct descriptions and updated the canonical fixture hash.
- Corrected C/List table sizing so the frozen task column no longer consumes the operational fields at 1440px.
- Removed opacity from B/List’s 7px width receipt after axe measured 2.91:1 contrast; targeted axe rerun passed.
- Replaced B/Timeline’s per-row date-cell matrix with one shared date grid and pointer-derived drops. Dense DOM count fell from 2,898 to 1,198 nodes and the observed warm development settle changed from 2,313ms/669ms longest long task to 800ms/50ms in consecutive local runs. These are comparative development observations, not production Web Vitals.
- Captured a successful representative interaction video after correcting a recording-only selector that assumed C’s planning rail exposed every unscheduled task without scrolling.
- Darkened the shared muted-text and success tokens after the semantic-token conversion produced marginal 4.39:1 and 4.45:1 contrast failures; all 12 final axe scans pass.
- Stabilized the shared preview action after C/Calendar's unmount cleanup exposed a maximum-update-depth loop; all 12 option/view routes now open with zero console errors.
- Removed C's narrow planning-rail hydration race by using a commit marker plus layout-time viewport synchronization. Screenshot tests now wait for real hydration and assert both the 1024px collapsed and 1440px expanded states.
