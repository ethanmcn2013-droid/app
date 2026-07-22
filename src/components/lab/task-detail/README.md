# Phase 3 — Task detail lab

Review-only route at `/lab/task-detail`. No auth. No server actions. All mutations are local useState no-ops that animate correctly.

## What is built

### Route
`src/app/lab/task-detail/page.tsx` — metadata robots noindex; renders `LabPage` (client).

### Files
| File | Purpose |
|---|---|
| `lab-fixtures.ts` | In-memory demo data: 5 wedding-venue tasks with rich subtasks, briefs, resources, conversations |
| `task-detail.tsx` | The shared TaskDetail composition (all three shells render this one tree) |
| `lab-board.tsx` | Faithful static board replica using exact option-a.module.css classes |
| `resizable-panel.tsx` | Drag-resizable side panel shell (min 420px, max 720px, localStorage persisted) |
| `lab-page.tsx` | Client orchestrator: manages shell state, task selection, focus toggle |
| `page.tsx` | Next.js route entry with noindex metadata |

## Three shells

| Shell | Trigger | Layout |
|---|---|---|
| **Panel** (default) | Click any card on the board | Board visible; resizable side panel overlays right edge |
| **Focus** | Press `e` or click the expand icon in the panel header | Board hidden; content centred max-w 860px; metadata in a right rail at lg+ |
| **Mobile sim** | Click "Mobile" chip in lab chrome | Constrained to 390px; panel becomes a full-screen sheet |

The lab chrome has toggle chips to force each shell independently.

## Fixtures — wedding-venue persona

All five tasks are in the `LAB_TASKS` array:

| ID | Title | Key feature |
|---|---|---|
| `t-lab-01` | Venue layout and ceremony flow plan | 5-paragraph brief · 7 subtasks with mixed statuses · 4 resources (google_doc, figma, github, upload) · 11 conversation items (comments + activity) |
| `t-lab-02` | Final stem count to the florist | Blocked by `t-lab-03` · 3 subtasks · 1 resource |
| `t-lab-03` | Chase final 3 RSVPs | Active blocker · 2 subtasks |
| `t-lab-04` | Confirm marquee sides | Done status · simple brief |
| `t-lab-05` | Sound check and PA walk-through | Queued · 4 subtasks · no resources |

## Interactions implemented

- **Status pill** in header: click to toggle (optimistic, local no-op)
- **Primary action** button ("Mark done" / "Reopen"): same as status pill
- **Subtask checkboxes**: click to toggle done/undone with CSS transition and progress bar animation
- **Subtask roll-up**: `n/m · %` + animated progress bar
- **Activity filter**: "All" / "Comments" filter toggle on the feed
- **Comment composer**: real textarea, Enter to post (local-only, animates into feed)
- **j/k keyboard navigation**: adjacent task in the `LAB_TASKS` array
- **e keyboard shortcut**: toggle focus mode
- **Esc**: close panel (panel/mobile shells)
- **Drag handle**: resize panel left edge; width stored in `localStorage` key `lab.taskdetail.width`
- **Focus mode expand/collapse**: icon in panel header + `e` key; board scroll position preserved on return
- **Lab chrome shell chips**: force Panel / Focus / Mobile view
- **Board task click**: opens the panel for that task
- **Board ••• button**: present, non-functional (geometry test)

## Production components — reuse vs copy

### Reused (by value, read before writing)
| Production file | What was reused |
|---|---|
| `detail-panel/panel-shell.tsx` | Motion grammar: exact spring easing `[0.16, 1, 0.3, 1]`, x/opacity animation values, boxShadow values |
| `detail-panel/conversation-feed.tsx` | ConversationFeed visual grammar (avatar, name, relative time, layout animation), CommentRow/ActivityRow structure, Composer sticky pattern |
| `detail-panel/subtasks-section.tsx` | SubtaskRow checkbox style (15px, border, check glyph), roll-up header, SubtaskComposer ghost-row |
| `detail-panel/resources-section.tsx` | Provider label badge (`ring-1 ring-line` chip), resource tile 36px dimensions, `providerLabel()` function |
| `detail-panel/field-rows.tsx` | Label typography: `10.5px font-medium uppercase tracking-[0.14em] text-ink-quiet` |
| `hybrid/options/a/option-a.module.css` | All board CSS classes (`.boardCard`, `.boardLane`, `.laneHeader`, `.statusPip`, etc.) imported directly |
| `hybrid/types.ts` | `STATUS_LABELS` values |

### Copied (into this directory)
| What | Why copied, not imported |
|---|---|
| `InitialsAvatar` | Production uses `Avatar` from `showcase/avatar` which resolves users by `UserId` — incompatible with `LabDetailPerson`. Lab needs colour + initials from the fixture people. Production port: wire the real Avatar with an adapter. |
| `ConversationFeed` logic | Production feed calls `getTaskConversationAction` (server action) and `addCommentAction`. Lab must be zero-server-actions. The visual grammar is identical; only the data layer differs. |
| `ResourcesSection` render | Production calls `listTaskResourcesAction` and `addLinkResourceAction`. Lab renders from in-memory `LabDetailResource[]`. |
| `SubtasksSection` toggle | Production calls `updateTaskAction`. Lab uses local `useReducer`. |
| `PanelShell` | Extended with drag-resize handle and localStorage persistence (new capability not in production). |

## Open questions for founder review

1. **Expand affordance placement** — currently: expand icon is in the panel header between ••• and close. Alternative: promote it to the far left of the header (before the breadcrumb) so it reads as a "view mode control" rather than a "window control". Which reads better at a glance?

2. **Default panel width** — currently 520px (between the shipped 480px and the max 720px). Does 520px give enough breathing room for the brief section, or should it start narrower at the production 480px?

3. **Activity filter default** — currently "All" (comments + system events interleaved). Should the default be "Comments" only, hiding system events unless explicitly requested? Linear defaults to showing both; ClickUp defaults to the activity tab.

4. **Metadata rail position in focus mode** — currently: right rail at lg+, stacked above activity at smaller screens. Alternative: always stacked at top, properties more prominent than the brief. Which information hierarchy matches how the founder actually uses a task?

5. **Board scroll preservation** — the current implementation saves `scrollLeft` before panel open and restores it on close. At focus mode → return, this also works. Verified in code; needs visual QA to confirm no flash.

6. **Mobile sheet behaviour** — the mobile sim (390px) renders the TaskDetail in full-screen. The resizable panel does not apply. This is the correct behaviour per the brief but needs side-by-side with a real device or devtools to judge whether the metadata rail placement is right.

7. **Keyboard legend** — the board has a keyboard legend strip at the bottom (from the hybrid board). The lab panel has a hint line in the primary action row. Production: should the keyboard hints be consolidated into a single discoverable location?

## Known gaps

- The `t-lab-03` blocker reference in `t-lab-02` shows as "T-LAB-03" in the metadata rail. Production would cross-reference task titles. The port will add a fixture lookup.
- The LabBoard has no drag-and-drop (static). The real board drag targets are present but all no-op. This is intentional — the lab tests the panel, not the board.
- The `add subtask` affordance and the `paste a link` input in resources are present for geometry but both are no-ops in the lab. Interactions are marked with `aria-label` noting lab status.
- No skeleton loading states (unnecessary in a lab with in-memory data).
- No `?task=` URL param — the lab uses local state only. Production Hybrid C will use the existing `use-task-panel.ts` param system.
- The `thin-scroll` utility class is used from production globals.css; if it is not defined in the lab route's scope, scrollbars will render with browser defaults. Visually acceptable for a lab.
