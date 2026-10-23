# Chat and Ping redesign

The design contract for the floating Chat panel and Ping inside it. Founder-approved on 21 October 2026. Work on chat or Ping keeps to this; a change to it needs Ethan's agreement.

## What is here

- `prototype/signal-chat.html`: the reference design, one self-contained page (open it in a browser). It is a design prototype: its Ping is a keyword stand-in, not the product's model. Production Ping runs on Claude Sonnet 5.5.
- `scorecards.md`: the fixed measure of quality, five lenses (Identity, Space, Motion, Ping, Experience), about 20 checks each. A 9 needs 90% of the points; a failing blocker caps a lens at 7.
- `ping-requests.md` and `ping-eval.md`: the fixed request set and script Ping is judged on. They also serve as eval cases for the production model.
- `HANDOFF.md`, `PLAN-TO-9.md`, `review-history.txt`: the decisions, the method and every independent review so far.

## Settled product decisions (do not reopen)

- Chat belongs to the person's account. It lives only in the floating panel; the panel can also open full view.
- Ping is a helper inside chat. It always shows a plan you approve before anything changes. Sending a message, nudging, commenting and inviting are plan steps too. Delete means archive.
- Ping's replies in shared chats are private to the person who asked. Guests never see Ping.
- The signature moment "Ping reads, then acts" stays: steps, then the answer, citing its sources.
- The private space is called "Saved notes".
- Indigo (#6860ff ring and dot for the mark) is for the Signal mark, Ping's reading edge and dot, selection, primary actions, unread and focus. People are never indigo.
- Circles are people, rounded squares are things, the ring and dot is Signal.

## Release 1 (this change)

- The panel opens on one list: Ping and Saved notes first, then available Project conversations. A person can use Hide for me (also through the conversation row's right-click menu) and restore from Hidden conversations. This preference is private to the person in this browser; it changes neither history, membership nor Project lifecycle. This amends the original always-visible Project list for product note G7. Each view has a back button, the same header, Full view and Close.
- Project conversations: the header shows the Project tile and who can see it; direct messages and task threads are one tap away. People's avatars use their tone. Message actions are quiet until reached for (always shown on touch). The composer keeps its tools on one line.
- Ping: the ink tile with the indigo ring and dot. Requests read as a conversation, newest at the bottom. Every request is a plan first (production draft mode), with Cancel and Apply plan; nothing changes until Apply.
- Opening to everyone is two explicit server switches, never the actor lists:
  - `SIGNAL_CONVERSATION_OPEN_TO_ALL=true` (with `SIGNAL_CONVERSATION_INTERNAL_ENABLED=true`) opens chat to every signed-in member.
  - `PING_ASSISTANT_OPEN_TO_ALL=1` opens Ping to every persisted member. A `*` in `PING_ASSISTANT_ACTOR_IDS` is still refused.
- Ping spending in production is capped at $100 a calendar month (UTC). Unused reservations are released once real usage is recorded. Other environments keep the $5 development cap.
- Guest (couple) chat is not in this release. It is a separately gated expansion.

## Release 2 (next): what production Ping needs to match the design

Production Ping today plans from names only. To deliver the design it needs, in this order:

1. Chat context: the messages of the conversation it was asked in (and, from Ping's own chat, the ones it searches), so answers can quote and link their sources.
2. Conversation memory: earlier turns, the waiting plan, and who "her", "it" or "that" refers to.
3. @Ping inside conversations, replying privately to the person who asked.
4. Plan editing by follow-up: change one step's owner, date or time (a new time keeps the day), drop a step, and questions about the waiting plan answered from the plan.
5. Per-step Undo after apply, including taking back a sent message, nudge or comment.
6. Checklist items as items: "tick off kitchen service times" ticks that item only.
7. Catch up and "what should I do first", built on the same "needs you" model as the chat list.

Judge each against `ping-requests.md` (90% pass, nothing that changes data wrongly) and the Ping section of `scorecards.md`.

## Not to regress

- Message loading, sending, receipts, drafts and audience checks in `conversation-workspace.tsx` remain protected. Product note G5 authorizes a bounded extension: upload or paste up to three checked files, bind their ordered IDs to the exact pending message, and reconcile through the existing receipt-first recovery. Scope, root and audience remain pinned; a changed audience requires review and an explicit new upload. Files never send or re-upload automatically. This exception does not authorize broader transport or audience changes.
- `pnpm test:conversations`, `pnpm test:ping-assistant`, `pnpm experience:fixtures` and `pnpm test:personal-chat-files:browser` stay green.
- Ping's recovery copy and behaviour ("Check status", "Re-enter original request", no automatic replay) stay as they are.
