# Project conversation prototype review

12 September 2026 · PC-02 synthetic frontend prototype

## Review surface

Open `/lab/project-conversation`. The page is an isolated client-side lab route. It imports no authentication, database, server action, environment or delivery module. All people, projects, messages and receipts are synthetic and reset on refresh.

The dark lab frame identifies the prototype and contains the scenario selector. The white workspace follows the incumbent Signal Studio operating surface: compact charcoal rail, white working canvas, ink type, indigo active state and Geist typography. The route makes no claim that messaging, delivery, task creation or Notes persistence exists.

## Functional review path

1. Choose **Project conversation**, type a draft, switch to **Autumn exhibition**, type a different draft, then return. Project and conversation drafts and histories remain separately scoped in memory. Switch between **Context panel** and **Full view** in the lab bar; the same draft and selected conversation remain.
2. Choose **Pending send**, **Failed send recovery** or **Uncertain send recovery**, send a message, and inspect the receipt beneath that one row. Failed and uncertain rows offer **Retry same request**; retry changes that existing row to recovered instead of inserting another.
3. Choose **Audience changed**. Existing history remains visible while the composer blocks the draft and tells the reviewer to inspect the current audience.
4. Choose each DM scenario. Consent pending prevents body delivery; active permits sending; blocked preserves retained history while disabling sending and alerts. The header always names both the Project scope and who can read. Choose **Future guest preview** to inspect the proposed disclosure while keeping access and sending explicitly disabled.
5. Choose **Project archived** and **Conversation unavailable** to review read-only and neutral-denial recovery. The unavailable state never substitutes a different Project.
6. Use **Reply** on a message. A dedicated one-level thread opens with its root and replies; sending there does not add a duplicate top-level row. Escape in its composer closes the thread.
7. Open **Turn into work**. Arrow keys and Escape work within its menu. **Create dated task** previews an explicit Tasks · Schedule handoff and states that it does not publish to Timeline. **Save to my Notes** states that the result is private to the current user. Confirming either closes a preview and writes nothing.
8. Review at 1440px and 390px. The compact rail becomes a bottom navigation bar, the conversation list becomes an avatar switcher, the audience header remains visible, and composer controls retain touch-sized targets.

## Attention and accessibility

The project and DM list shows directed unread counts. The project feed marks a directed message without exposing per-person read receipts. The quiet-hours notice says that directed items remain in Inbox. Opening a conversation does not clear hidden or unloaded attention in the synthetic state.

All actions use native buttons, inputs or selects. The composer sends with Control/Command + Enter, ignores that shortcut during IME composition, and the work menu supports Tab, Up, Down and Escape. Focus indicators, selection colour, caret, disabled controls, reduced motion, responsive layout and overflow handling use the scoped prototype stylesheet.

## Evidence and limits

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed.
- Targeted ESLint: route plus both prototype TSX files — passed.
- Impeccable detector: route, TSX and CSS module — no findings.
- Browser rendering and interaction capture are intentionally left to the coordinated root verification pass; this task did not start a server or claim visual approval.
- `pnpm exec` attempted to reconcile the pre-created `node_modules` junction and stopped at its noninteractive purge guard. Direct linked binaries ran successfully without changing dependencies.
- This is in-memory UI evidence only. It does not prove authorization, atomic writes, synchronization, external delivery, canonical task creation, Notes reconciliation, persistence or lifecycle policy.
