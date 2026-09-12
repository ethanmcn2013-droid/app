# Project conversation prototype review

12 September 2026 · PC-02 synthetic frontend prototype

## Revised founder direction

The founder supplied ClickUp layout references and explicitly chose white, stone black and indigo. Final revised source is prototype `9713dcdc`, equivalent to integration `263963ce`. The white conversation index, broad author rows, framed composer and optional related-work panel follow that direction. Related work starts closed. Mobile uses a reserved bottom navigation row, with the feed scrolling above the visible composer. Root's final 1440×1000 and 390×844 browser checks passed; related work opens/closes and the Send control remains reachable. Console errors/warnings: none. Fresh independent Sol finish review: ship at synthetic prototype scope. Evidence: `evidence/white-desktop.png` and `evidence/white-mobile.png`. Earlier screenshots below are historical.

PC-03 now permits local backend continuation after this founder instruction; participant comprehension remains an unpassed release gate. See decisions.md. The durable visual record is `design/white-stone-indigo.md`, with the scoped design palette updated alongside it.

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
8. Review at 1440px and 390px. The phone view keeps a compact 66px rail beside the 324px working surface. The conversation list becomes an avatar switcher, the audience header remains visible, and composer controls retain touch-sized targets. The selected mobile conversation has a complete ink outline and exposes `aria-current` with its conversation name.

## Attention and accessibility

The project and DM list shows directed unread counts. The project feed marks a directed message without exposing per-person read receipts. The quiet-hours notice says that directed items remain in Inbox. Opening a conversation does not clear hidden or unloaded attention in the synthetic state.

All actions use native buttons, inputs or selects. The composer sends with Control/Command + Enter, ignores that shortcut during IME composition, and the work menu supports Tab, Up, Down and Escape. Focus indicators, selection colour, caret, disabled controls, reduced motion, responsive layout and overflow handling use the scoped prototype stylesheet.

## Evidence and limits

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed.
- Targeted ESLint: route plus both prototype TSX files — passed.
- Impeccable detector: route, TSX and CSS module — no findings.
- Root browser verification completed against the final prototype at `e7eed757` (equivalent UI in integration `a8207004`): desktop and mobile rendering, scoped draft retention, Project/DM/Discussion selection, pending consent, one-row uncertain retry, separate thread replies, archive refusal, explicit task/private Notes previews, Control+Enter, and reduced motion. Browser console errors/warnings: none. Final screenshots are in `evidence/`. A fresh finish reviewer accepted the prototype after the mobile selection correction.
- Physical IME input was unavailable in this browser interface; the composition guard was inspected in both composers. Real phone hardware and human comprehension remain unverified. Agent review is not founder or participant acceptance.
- `pnpm exec` attempted to reconcile the pre-created `node_modules` junction and stopped at its noninteractive purge guard. Direct linked binaries ran successfully without changing dependencies.
- This is in-memory UI evidence only. It does not prove authorization, atomic writes, synchronization, external delivery, canonical task creation, Notes reconciliation, persistence or lifecycle policy.
