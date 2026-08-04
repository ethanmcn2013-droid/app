# Tasks delight motion contract

## Thesis

Motion in Tasks makes a change of owner, status, position, or time arrive in its
new truth, while the command that asks for the change remains immediate.

## Character

| Trait | Means | Does not mean |
|---|---|---|
| Precise | Immediate acknowledgement, exact origins, short controlled settling | Mechanical or abrupt |
| Calm | One dominant movement, stable reading surfaces, no ambient motion | Slow |
| Tactile | One-to-one manipulation and legible destinations | Bounce, tilt, or imitation physics |
| Trustworthy | Optimistic truth, delayed pending state, coherent rollback | Success theatre |

## Budgets

- One dominant movement at a time.
- One expressive signature in the Tasks journey: the first meaningful
  completion.
- Acknowledgement latency is zero for keyboard commands and no more than the
  80ms instant token for press feedback.
- Pointer movement remains one-to-one.
- Route and representation changes are immediate.
- No looping ambient motion.
- Reduced motion preserves state through opacity, colour, outline, text, and
  announcements without spatial travel.

## Existing semantic tokens

| Token | Value | Use | Forbidden use |
|---|---:|---|---|
| `--motion-instant` | 80ms | Press, hover, focus, tiny state feedback | Navigation choreography |
| `--motion-fast` | 140ms | Anchored layers, disclosure content | Large panels |
| `--motion-base` | 220ms | Placement, layout settlement, removal | Keyboard commands |
| `--motion-moderate` | 320ms | Task inspector arrival | Menus and tooltips |
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | Enter, exit, response | Continuous movement |
| `--ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | Visible relocation | Entry |
| `--spring-glide` | `cubic-bezier(0.16,1,0.3,1)` | Controlled spatial settle | Routine hover |

## Shared primitives

| Primitive | Ledger coverage | Contract |
|---|---|---|
| Command response | TSK-001–002, 012–014, 030, 039, 042, 044, 046–048, 053, 058, 063, 072, 074–075, 077, 087, 089 | Cut or instant token; never wait for choreography |
| Anchored layer | TSK-005, 012–013, 021–022, 045, 067, 076, 079–084 | Origin-aware scale from 0.98 plus opacity; 140ms in, faster out; opacity-only reduced |
| Source selection and inspector | TSK-017–020, 040, 066, 074–075, 091 | Source remains visibly selected; panel arrives from working edge; exact focus return |
| Direct movement | TSK-026–030, 034, 043–044, 055–058, 069, 106 | One-to-one input, quiet pickup, explicit destination, controlled settle; keyboard cuts |
| Placement receipt | TSK-007, 035–038, 068, 090, 100 | New object resolves in its final slot; nearby layout settles once |
| Disclosure shell | TSK-003, 009–010, 031–032, 041, 049–050, 070–071, 086 | Stable shell; bounds establish before content; reversible |
| Completion state | TSK-024–025, 078 | Immediate state, local routine settle, one once-only restrained signature |
| Async truth | TSK-004, 006, 038, 081, 088, 093–103 | Pending only after 300ms; resolve in place; whole-state rollback and actionable error |
| Deliberate stillness | TSK-011, 014, 054, 060, 065, 073, 085, 103–104, 106 | Preserve calm or wait for a complete interaction/device model |

## Important exceptions

| Exception | Reason | Review condition |
|---|---|---|
| Detail panel may use the 320ms moderate token | It crosses the full working edge and preserves object continuity | Recheck after desktop and compact-view recordings |
| Board lane and planning rail animate layout bounds | Their width changes the available workspace | Recheck for text shimmer and interrupted toggles |
| First completion uses a longer local sequence | It is once-only and non-blocking | Must never cover the workspace or replay after undo loops |
| Native drag remains the transport layer in this local wave | It preserves the existing cross-view data-transfer contract | Real touch testing remains required before release |

## Forbidden patterns

- `transition: all`
- animated keyboard commands
- card hover lift, tilt, or parallax
- page-load card staggers
- full-view slides between Board, List, Schedule, and Calendar
- pulsing today markers or urgency states
- bounce or inertial overshoot on work placement
- full-screen completion celebrations
- animation that owns durable task state
- animation-only status or error meaning

## Verification

Implementation is not release approval. Verify the four production Tasks routes
at desktop and compact widths, keyboard, fine pointer, reduced motion, rapid
repeat, reversal, optimistic failure, focus return, and unmount. Direct
manipulation requires a real touch-device pass before deployment.
