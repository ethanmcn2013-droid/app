# Tasks four-view redesign — design principles

These principles govern all three Phase 1 options. An option may interpret them differently, but it may not waive them.

## 1. One task, one truth

Status, order, assignees, schedule, completion, relationships, and content come from one canonical task store. A view is a projection of that truth, never an alternative data model.

## 2. Unscheduled is a first-class state

Missing dates are not an invitation to infer. Unscheduled work appears in an explicit tray in Timeline and Calendar and nowhere on their date surfaces. Scheduling and unscheduling are deliberate, reversible actions.

## 3. Orient before operating

The user should understand Planning Period, Workspace, purpose, owner, target, progress, and current view before reading individual tasks. Context is compact but not absent.

## 4. One view bar, one place for view decisions

Board, List, Timeline, Calendar, search, filter, group, sort, fields, density, and local saved-view controls live in one contextual command layer. The left navigation does not duplicate the four views.

## 5. Density without compression theatre

The default should support serious daily work at 1280px and above. Density comes from alignment, hierarchy, and progressive disclosure—not tiny hit targets, clipped labels, or hidden capability.

## 6. Direct manipulation with complete parity

Drag, resize, and reorder should feel immediate and precise. Every essential direct-manipulation action must also be available through a visible command, inspector field, or keyboard operation with the same outcome.

## 7. Focus is real; selection is explicit

DOM focus, active task, selected tasks, inspected task, editing field, preview task, and drag operation are separate states. Shortcuts act only in the relevant focused scope. Focus is visible, deterministic, and restored after overlays.

## 8. The inspector is the continuity anchor

All views open the same inspector for the same task ID and fields. The docked desktop inspector is a complementary panel. Full-screen task mode is a true dialog with focus containment and restoration.

## 9. Neutral surfaces, semantic signal

Hierarchy is carried by typography, spacing, surface contrast, and subtle borders. Indigo is a restrained accent. Status, priority, warning, danger, and focus colors appear only where they add information. No gradients, glow, glass, decorative blur, or indiscriminate shadow.

## 10. General-user language, expert-grade control

Use human labels such as “In progress,” “Due 22 Jul,” and “Waiting on Finance.” Avoid internal codes and project-management jargon where plain language works. Power features remain discoverable and keyboard-operable.

## 11. Honest prototypes

The design lab visibly identifies itself and its session-only persistence. It does not imply saved account settings, durable edits, integrations, or production availability. Unsupported controls are either functional within the lab or clearly presented as design specimens—not fake actions.

## 12. Fair comparison

A/B/C use the same fixture hash, task store, query schema, inspector capabilities, state modes, and acceptance tests. Differences are structural and behavioral compositions, not privileged data or missing capability.

## 13. Restraint is a feature

Progressive disclosure wins over showing every field. Cards, rows, bars, and calendar items expose what helps the current decision. Relationship depth belongs in the inspector unless a view specifically needs it.

## 14. Responsive desktop means reachable work

At the smallest supported desktop and all evidence widths, users can reach every lane, column, date, tray, command, and inspector field. Intentional surface scrolling is allowed; document-level clipping and inaccessible controls are not.

## 15. Motion explains change

Motion is fast and functional: drag lift, insertion position, panel transition, and state continuity. Reduced-motion mode removes non-essential movement while preserving all spatial and drop feedback.

## 16. Evidence outranks scores

Scores must cite screenshots, tests, source, browser inspection, accessibility output, or performance observations. The 9.9 target is aspirational; unsupported score inflation is a defect, not success.

## Option-specific expression

### A — Quiet Command

The calmest and most operational system. Highest comfortable density, precise alignment, minimal accent, concise Board, flagship List, fast peek behavior, and excellent keyboard flow.

### B — Editorial Project Room

The most human and purpose-led system. Strong brief and milestone context, generous but productive rhythm, readable labels, edited card composition, and a first-class selected-day agenda.

### C — Signal Spatial

The most distinctive spatial system. Clear canvas zones, a planning rail, prominent unscheduled work, stronger Timeline/Calendar composition, functional position signals, and coordinated drag feedback without decorative effects.
