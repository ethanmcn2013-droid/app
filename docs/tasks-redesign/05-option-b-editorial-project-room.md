# Option B — Editorial Project Room

## Intent

Editorial Project Room treats a workspace as a purposeful room rather than a neutral container. It keeps the planning-period narrative, progress, commitments, and upcoming milestones visible above the execution surface while preserving the same task capabilities as A and C.

## Structural composition

- Persistent Signal Studio account rail.
- A broad workspace brief containing purpose, date window, ownership, progress, overdue/undated receipts, and milestones.
- A calm horizontal view-and-control bar below the brief.
- Editorial work surfaces with more descriptive copy and breathing room than A.
- One shared docked inspector and one full-screen task dialog across every view.

The option uses a dedicated header, tools, cards, tables, timeline, and calendar under `src/components/design-lab/tasks/options/b/`; its hierarchy and DOM are independent of A and C.

## View behavior

### Board

Room-like lanes use larger cards, purpose descriptions, check progress, assignees, labels, schedule, and dependency signals. The composition makes task intent more visible at a glance, with lower raw card density than A.

### List

An editorial table preserves task title and purpose as the frozen anchor while fields scroll. Status groups include explanatory notes and progress receipts. Fields can be shown, hidden, reordered, and resized; task status and priority remain directly editable.

### Timeline

Upcoming commitments and milestones are summarized above a detailed planning grid. Task purpose remains visible in the task pane. Ranges, due dates, milestones, unscheduled tasks, drag operations, and keyboard alternatives all use the canonical schedule model.

### Calendar

The month grid pairs with a selected-day editorial agenda. Dense-day overflow is explicit, and unscheduled work remains separate. Purpose copy helps users understand why an item matters without opening the inspector.

## Interaction model

- Shared task palette, inspector, selection, bulk toolbar, and context menu.
- Cross-view search, priority/ownership filters, and schedule/title sorting.
- Board drag and keyboard moves; Timeline and Calendar drag plus explicit date controls.
- Configurable List fields and density.
- All edits stay session-only and update every option through the shared store.

## Trade-offs

- Strongest option for orientation, task purpose, and stakeholder-readable context.
- Lower Board density and a taller workspace brief reduce the amount of work visible above the fold.
- Repeated purpose copy can become visually noisy in dense data even with realistic, unique descriptions.
- The richer hierarchy requires disciplined responsive reduction so the brief does not crowd the work surface.

## Evidence

- Live URL: `/__design-lab/tasks?option=b&view=board&dataset=normal&density=compact&mode=default`
- Contact sheets: `artifacts/tasks-redesign/comparison-normal-1440.png`, `comparison-dense-1024.png`, and `comparison-normal-1920.png`.
- Individual captures: `artifacts/tasks-redesign/screenshots/b-*.png`.
- Browser and accessibility proof: `e2e/design-lab/tasks-design-lab.spec.ts` and `artifacts/tasks-redesign/axe/b-*.json`.
- Representative interaction recording: `artifacts/tasks-redesign/video/phase1-interaction.webm`.
