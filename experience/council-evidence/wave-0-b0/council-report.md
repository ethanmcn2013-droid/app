# Signal Studio UI Council — Wave 0 B0

**Decision: NO PASS.** Ten directors independently reviewed the current App source and marketing source. The hard gate requires every director and the Council Index to reach 9.5/10 with zero vetoes; no surface passes.

**This record supersedes the 2026-08-09 review of `d1af9ae`.** That review is not deleted — it is in git history, and D-031 records why it is re-pinned in place rather than forked to a second baseline. Its findings stand as the state of the product on that date; this one states where the product stands now.

## Provenance

- App `ba2c905482fd26a5152c2fab7337d92744e81d95`, source tree `ac4190b08992931a299d6ba493b7ff7bf5b65d255659c7d3dae0f70d4c075596`; source-identical review render of a production build, review access mode, Active Project flag off — the production default. The render was taken at `c02ddfaaba4ad7000dd5627cf68e560872db2090`, the pre-merge head of PR #151. The squash-merge that landed it on `main` as `ba2c905` left that commit unreachable from any branch here, while leaving every pinned input — `src`, `public`, `drizzle`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json` — byte-identical, each resolving to the same git tree object. The baseline therefore pins the reachable commit carrying the reviewed tree rather than the render's own sha: a receipt pinned to a commit nobody can find is not a receipt (D-033). The ten director reviews under `directors/` are untouched and still name the commit they actually read.
- Studio `6e656c807cb67e9b4acc38393f71b63356b6c791`; source-identical review render of a production build of the marketing site.
- Contract: products are Notes, Tasks, Timeline; Home is front door and daily briefing; Signal route is legacy redirect.
- Evidence: 16 renders across desktop 1440×900 and mobile 390×844, 16 axe-core WCAG 2.1 AA runs, console and HTTP capture on every render. Automated results were clean throughout: **0 axe violations, 0 console errors, 0 non-200 responses.**
- Method: one agent per lens, each opening every screenshot for a surface before scoring it, none able to see another's scores. Conducted by Claude Opus 5 under founder authorization (F1, 17 August 2026).

**Declared limits.** The panel was told to give no optimism to what the evidence cannot show, and several directors recorded the same gaps: captures are viewport-only so below-fold layout is unassessed (including the Pricing plan cards); there is no intermediate breakpoint between 390 and 1440; there is no motion, performance or native assistive-technology evidence; and the demo fixture carries only short, well-behaved content. Scores were taken conservatively against those gaps rather than generously, and none of them should be read as evidence those conditions are handled.

## Sealed ledger

| Director | Tasks boards + views | Task cards + detail | Notes | Timeline owner + sharing | Landing | About | Pricing | Vetoes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Director 01 — Executive Product Design and Council Chair | 7.5 | 8.3 | 8.5 | 8.2 | 8.0 | 8.1 | 6.9 | None |
| Director 02 — Human Interface and Interaction | 7.9 | 8.1 | 7.8 | 7.5 | 8.6 | 8.3 | 7.6 | None |
| Director 03 — User Journey and Task Success | 7.6 | 7.8 | 8.2 | 7.7 | 8.0 | 8.1 | 7.4 | None |
| Director 04 — Information Architecture and Cognitive Ergonomics | 7.4 | 7.5 | 7.9 | 7.8 | 8.0 | 7.6 | 7.8 | None |
| Director 05 — Visual Design and Art Direction | 7.6 | 7.8 | 7.7 | 8.4 | 8.2 | 8.3 | 7.8 | None |
| Director 06 — Content Design, Language and Trust | 8.4 | 7.6 | 8.5 | 8.7 | 8.2 | 8.8 | 7.4 | None |
| Director 07 — Motion, Feedback and Delight | 7.4 | 7.6 | 7.5 | 7.7 | 7.2 | 6.9 | 6.8 | None |
| Director 08 — Accessibility and Inclusive Design | 7.4 | 7.6 | 7.8 | 7.5 | 8.1 | 8.6 | 7.7 | None |
| Director 09 — Product System and Brand | 7.5 | 8.2 | 7.4 | 8.0 | 8.0 | 7.8 | 7.1 | None |
| Director 10 — Responsive, Performance and Production Quality | 6.8 | 7.6 | 7.0 | 8.2 | 8.4 | 7.8 | 6.9 | None |

## Gate matrix

| Surface | Council Index | Lowest lens | Vetoes | Decision |
|---|---:|---:|---|---|
| Tasks boards + views | 7.55 | 6.8 | None | No pass |
| Task cards + detail | 7.81 | 7.5 | None | No pass |
| Notes | 7.83 | 7.0 | None | No pass |
| Timeline owner + sharing | 7.97 | 7.5 | None | No pass |
| Landing | 8.07 | 7.2 | None | No pass |
| About | 8.03 | 6.9 | None | No pass |
| Pricing | 7.34 | 6.8 | None | No pass |

Suite floor: **6.8/10**. Highest Council Index: Landing at 8.07. Lowest: Pricing at 7.34. Total vetoes: 0.

## Highest-leverage corrections, per surface

**Tasks boards + views** (index 7.55, floor 6.8)
  - Make the two views agree: fit the List table to a 1440px viewport so priority is never clipped mid-word, and give the board card a distinct assignee treatment showing the real owner (Orla) separate from tag chips, so a board reader and a list reader draw the same conclusion about who holds the work.
  - Split the pill vocabulary: give interactive chips (status filters, editable fields) a single consistent treatment with a chevron or hover border, and demote static tags to borderless text or a distinctly softer token — then fix the clipped Priority column so no field is unreadable without an unsignalled scroll.
  - Stop the desktop List table clipping the priority column at 1440 — either fit the columns to the viewport or give the table its own horizontal scroll with a visible edge affordance, so 'Hig' / 'Low' / 'No…' read as whole words.

**Task cards + detail** (index 7.81, floor 7.5)
  - Reorder the mobile layout so the metadata rail (repeats, tags, contact, project, source) sits directly under the description rather than below the conversation, and relabel 'open source' and 'Make copies' to name what they actually do.
  - Adopt one rule for the field column — every editable property gets the same chip treatment and hover affordance, every read-only one gets plain text — so TAGS and PROJECT stop looking different from CONTACT and REPEATS for no reason.
  - Rewrite the opaque controls in outcome language — 'open source' → 'Open the note this came from', 'Make copies' → 'Duplicate this task', and make clear whether 'Draft a reply' writes for you to edit or posts.

**Notes** (index 7.83, floor 7.0)
  - Fix the reading pane for short notes — anchor the metadata footer directly under the body instead of to the bottom of the viewport — and promote 'Save note' to a filled primary so the capture product's core action is its most confident button.
  - Give the note body an explicit edit affordance and give 'Save note' one primary treatment with a real disabled state, so the composer and the note both show plainly whether they can be acted on.
  - Put a 'Turn into task' action in the note reading pane for every note, not just rows already flagged 'To review', so the capture-to-execution path works from wherever the user is standing.

**Timeline owner + sharing** (index 7.97, floor 7.5)
  - Rebalance the axis so the near future gets the space the completed past currently holds — label the four clustered milestones inline and make 'Today' the strongest mark on the line.
  - Make the Timeline/Milestones segmented control state unmistakable — selected segment filled and marked, unselected clearly recessed — and separate it from 'Preview' so the view switch is not read as a fourth action button.
  - Label the future half of the axis — carry month ticks through Aug/Sep/Oct and expand or make openable the collapsed '4 milestones' cluster, so the countdown and the axis tell the same story.

**Landing** (index 8.07, floor 7.2)
  - Put real product into the first desktop screen — a live Timeline or board frame beside the headline — so 'See the system at work' is answered at the fold, and align the hero's left edge to the header grid.
  - Add a current-page state to the nav and resolve the mobile header so 'Products' either lives inside the menu or the whole nav is exposed — one level, one rule.
  - Add a persistent Sign in entry to the marketing nav at both viewports so returning users can reach the signed-in app without guessing the subdomain.

**About** (index 8.03, floor 6.9)
  - Rework the desktop composition to fill the dead lower-left quadrant — bring the body column back under the headline and pull the 'The mistake was assuming…' line above the fold — and sign the note with the founder's name.
  - Retire the hollow-circle marker as decoration here — it is a completion toggle in Tasks and a milestone in Timeline — and reserve the shape for controls and state across the suite.
  - Bind the desktop headline and body into one reading path — close the empty quadrant between them — and give the persuaded reader an explicit next step on the page.

**Pricing** (index 7.34, floor 6.8)
  - Get a price into the first desktop screen — collapse the two stacked heroes into one and lift the plan comparison above the fold, with the reassurance strip following the numbers it reassures about rather than preceding them.
  - Redraw the three-fact strip so it cannot be mistaken for a segmented control — drop the cell dividers and equal-width boxing for plain inline statements — and lift at least one real CTA into the first screen.
  - Bring the four plans and their prices onto the first screen as four scannable cards with a CTA each, rather than naming them inside a prose sentence above the fold.

Each director's full independent review, with per-surface rationale and the evidence it names, is committed beside this report under `directors/`. Their SHA-256 digests are sealed into the baseline.

The baseline is evidence, not certification: the strict product state×viewport and continuous-journey receipt contract remains reserved for a future 9.5 pass attempt, and no green check may be read as a 9.5 claim (D-029).
