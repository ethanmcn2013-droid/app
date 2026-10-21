# Handoff to the Ping work in Codex

Paste the prompt below into the Codex session working on Ping. It is also kept here so any later session can find it.

---

You are continuing the Ping work in the Signal Studio app (github.com/ethanmcn2013-droid/app). Before your next change, read this and the design contract it points to. The chat panel and Ping have been redesigned with Claude Code and released, and from now on all chat and Ping work follows that design.

## What changed (release 1, merged to main)

Read `docs/projects/chat-ping-redesign/README.md` first. It is the design contract, approved by Ethan on 21 October 2026. The reference design is `docs/projects/chat-ping-redesign/prototype/signal-chat.html` (open it in a browser). Its Ping is a keyword stand-in: copy the design, not that logic.

- The floating Chat panel opens on one list: Ping and Saved notes first, then each Project's conversation. One view at a time, each with a back button and the shared `ChatHeader` (`src/components/app/messages/chat-home.tsx`, `chat-marks.tsx`, `floating-chat-root.tsx`).
- Ping uses the ink tile with the indigo ring and dot (`PingTile`). Requests read as a conversation, newest at the bottom. **Every request is a plan first**: the UI submits in draft mode and shows Cancel and Apply plan, and nothing changes until it is applied. Keep it that way; it is a settled founder decision.
- New explicit switches: `SIGNAL_CONVERSATION_OPEN_TO_ALL=true` opens team chat to every signed-in member (set in production on 21 Oct 2026). `PING_ASSISTANT_OPEN_TO_ALL=1` opens Ping to every member (built and tested, **not** switched on: Ethan chose chat only for now). A `*` in `PING_ASSISTANT_ACTOR_IDS` is still refused.
- Production Ping spend is capped at **$100 a calendar month (UTC)** (`planner-budget.ts`, `store.ts`); other environments keep the $5 development cap.
- Guest (couple) chat is not in this release.

## Rules going forward (do not regress)

1. Ping always shows a plan before anything changes. Sending, nudging, commenting and inviting are plan steps. Delete means archive.
2. Ping's replies in shared chats are private to the asker; guests never see Ping.
3. Indigo is for the Signal mark, Ping's reading edge and dot, selection, primary actions, unread and focus. People are never indigo. Circles are people, rounded squares are things.
4. Do not change message loading, sending, receipts, drafts or audience checks in `conversation-workspace.tsx` as part of Ping work.
5. Keep green: `pnpm test:ping-assistant`, `pnpm test:conversations`, `pnpm experience:fixtures`, `pnpm experience:validate`, `pnpm test:personal-chat-files:browser`. Ping's recovery copy ("Check status", "Re-enter original request", no automatic replay) stays.
6. Judge Ping work against `docs/projects/chat-ping-redesign/ping-requests.md` (90% pass, and nothing that changes data wrongly) and the Ping section of `scorecards.md`. Report scores only from an independent reviewer.

## Your next work: release 2 (server side, your area)

Production Ping still plans from names only. To deliver the design, in this order:

1. **Chat context.** Give the planner the messages of the conversation it is asked in (and, from Ping's own chat, the messages it searches), so answers quote and link their sources.
2. **Conversation memory.** Earlier turns, the waiting plan, and who "her", "it" or "that" refers to.
3. **@Ping inside conversations**, replying privately to the asker.
4. **Plan editing by follow-up.** Change one step's owner, date or time (a new time keeps the day), drop a step, and answer questions about the waiting plan from the plan.
5. **Per-step Undo** after apply, including taking back a sent message, nudge or comment.
6. **Checklist items as items.** "Tick off kitchen service times" ticks that item only.
7. **Catch up and "what should I do first"**, built on the same "needs you" model as the chat list.

The UI for these lives in `src/components/app/messages/`. If a step needs UI, follow the prototype and the contract, and say which file you will touch before you start, so two writers never edit the same file.

## Where things are

- PR: https://github.com/ethanmcn2013-droid/app/pull/302 (branch `feat/chat-ping-redesign`).
- Design record: `docs/projects/chat-ping-redesign/` (README, prototype, scorecards, ping-requests, ping-eval, HANDOFF, PLAN-TO-9, review-history).
- Ping operator guide: `docs/PING_TEXT_ASSISTANT.md` (updated with the new switch and monthly cap).
