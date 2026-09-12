# Project Conversation — pause report

12 September 2026 · Local implementation checkpoint · User-requested pause

**11 of 16 approved local milestones are accepted: 68.75%, or about 69%.** The current stopping point is the completed PC-10 checkpoint, covering Project-scoped private conversations, replies and canonical Task Discussion. Work pauses before the shared attention and delivery stage.

This percentage counts milestones equally. It is not a measurement of engineering hours, remaining time, production readiness or pilot success. The five remaining milestones contain substantial integration and verification work. There is no evidence-based elapsed-effort percentage or reliable completion date yet.

## What is working

- **Project conversations:** durable messages, current Project membership checks, sending, editing, deletion, structured mentions, history loading and synchronization.
- **Recovery:** interrupted acknowledgments reuse the original operation; recovery avoids duplicate messages or tasks. Access changes are checked again before showing protected content or resolving an operation.
- **Tasks from messages:** explicitly authored, dated tasks with safe provenance, destination authorization and recovery after a lost response. Ordinary due dates remain ordinary Tasks, rather than becoming Timeline milestones.
- **Private conversations:** one consenting pair inside a named Project; acceptance, refusal, blocking, leaving and re-entry rules; restricted history and one-level replies.
- **Task Discussion:** canonical task comments, replies, edits and deletion; explicit review when the audience changes; exact pending send/edit/delete recovery across Messages navigation; current membership revocation clears content and drafts.
- **Existing task history:** when the new feature is deliberately switched off, strictly authenticated members can still read eligible existing comments and activity. A refusal in the new path never falls back to a weaker path.
- **Draft continuity:** Messages drafts and selected recipients survive navigation within the authenticated session. Capacity exposes saved work rather than silently evicting it; uncertain operations remain protected and saved reply scopes reopen correctly.
- **Design direction:** white surfaces, stone-black text and indigo accents are recorded as the accepted direction. The supplied ClickUp references inform navigation and conversation layout. Final polish across every remaining surface is still part of integrated readiness.

## Milestone ledger

| Milestone | Outcome | Current disposition |
|---|---|---|
| PC-00 | Repository baseline and ownership | Accepted locally |
| PC-01 | Permission, data and recovery contracts | Accepted locally |
| PC-02 | Interactive prototype and responsive design | Accepted at synthetic scope |
| PC-03 | Design / continuation gate | Amended local continuation accepted; participant research remains open |
| PC-04 | Transaction feasibility | Accepted locally |
| PC-05 | Synchronization feasibility | Accepted locally |
| PC-06 | Conversation backend | Accepted locally |
| PC-07 | Connected conversation client | Accepted locally |
| PC-08 | Create Tasks from conversation | Accepted locally |
| PC-09 | Independent first-slice verification | Accepted locally |
| PC-10 | Private conversations, replies and Task Discussion | Accepted locally at this checkpoint |
| PC-11 | Shared attention, preferences and delivery | Open; quiet-hours helper accepted as a subtask |
| PC-12 | Save to my Notes with recoverable provenance | Open; implementation packet prepared |
| PC-13 | Search, reactions, lifecycle and cleanup | Open; implementation packet prepared |
| PC-14 | Complete integrated readiness | Open; Messages draft-recovery subtask accepted |
| PC-20 | Operational controls and rollback rehearsal | Open; some per-slice controls already verified |

## What remains, in order

1. **One attention state and dependable delivery (PC-11).** Connect Messages and Inbox to the same directed-event state; implement observed ranges, unread counts, follow/mute preferences and delivery leases. Prove quiet hours, duplicate workers, revocation and retries against an isolated delivery sink. The timezone helper is implemented and its daylight-saving regression is fixed; the complete flow is not built.
2. **Save to my Notes (PC-12).** Build a private, authored note outcome across the separate Tasks and Notes databases. Handle a lost acknowledgment without duplicate notes, preserve exact draft custody, and keep source authorization separate from private-note ownership. The technical packet includes failure points and account-erasure fencing.
3. **Search and lifecycle (PC-13).** Add permission-aware search and reactions, complete archive/restore and source-to-related-work navigation, and cover export, deletion, indexing and account cleanup. Verify search against a named synthetic corpus and ensure restricted content cannot leak through snippets or counts.
4. **Full candidate verification (PC-14).** Verify all features together on a frozen revision: browser journeys, accessibility, responsive behavior, failures and authorization. Finish exact message/comment deep links and combine Task Discussion drafts with the Messages recovery inventory and capacity rules. Physical keyboard/IME behavior and actual identity-provider sessions need separate evidence.
5. **Operations and rollback (PC-20).** Finish supported migration, backup/restore, export/erasure replay, queue stop/restart and data-preserving rollback rehearsals. Confirm that configuration failures remain honest and logs contain no private message content.

PC-20 is maintained alongside the feature stages and closes against the final candidate; it is not merely a last documentation step.

## Verification at the stopping point

Reviewed application revision: `7669af5b73904ce0dcbd5256ce3f4bdf79bff3de`.

| Check | Result and scope |
|---|---|
| Integrated isolated conversation runner | 111/111 passed; exit 0; 28,517.6774 ms |
| Full TypeScript check | Passed; exit 0 |
| Scoped ESLint | Passed; zero warnings for changed compatibility/Discussion files and quiet-hours utility |
| Independent compatibility acceptance | 9/9 passed at this revision, including delayed-response revocation, task switching and unmounted retry cases |
| Independent Discussion acceptance | 13/13 passed at `5223840a`, including preserved counterexamples and the actual polling implementation; accepted correction retained at the checkpoint |
| Actual synthetic browser journeys | Send/edit/delete acknowledgment loss, route recovery, reply retention, explicit audience review, revocation clearing and empty draft after membership restoration passed |
| Final Discussion presentation | 1280×720 desktop and 390×844 phone frames saved; no horizontal overflow in measured layouts |

Review found and fixed concrete defects, including actor forgery, migration sequencing, resurrection of deleted comments, failed reply fanout after an author left, stale poll responses, uncertain-operation loss, silent audience acceptance and the final existing-history response race. The preserved failure evidence remains beside the passing receipts.

A temporary evidence-packaging mistake made the type checker include a copied review harness as application TypeScript. The copy was renamed to a text artifact, the failed log was retained, and the complete type check passed afterward. No production build, real Clerk browser session, remote database behavior, actual delivery provider or human study is claimed by these local checks.

## How the work is preserved

The integrated application lives on the local branch `feat/project-conversation-integration` in the dedicated worktree. Worker branches remain intact. Code is committed; source review receipts, browser frames, current state and the upcoming implementation packets are saved with the project documentation. The pause manifest records exact source/checkpoint revisions, backup location and process disposition.

Agent orchestration used separate worktrees for bounded implementation and an independent reviewer for the higher-risk contracts and corrections. Root integrated and exercised the receiving code. All feature workers are stopped at this boundary. The periodic progress automation is paused.

These are local commits and backups. No push, PR, deployment, customer-data operation or external notification has occurred under this execution. Private delivery issue #13 remains the coordination anchor; remote tracker pause/claim reconciliation is pending rather than being reported as completed.

## Release boundaries and next restart

Participant sessions remain **zero**. Real identity-provider behavior, remote database/provider operation, a live pilot, and retention/admin/support decisions remain separate release dependencies. The accepted PC-03 amendment allowed continued local development; it did not satisfy human research. Guest access, files and AI expansion remain outside this local scope.

No further feature work starts until you resume. The next operator should read [STATE](STATE.md), verify the saved revision and ownership, then begin the [PC-11 attention packet](resume-packets/pc11-attention-packet.md). Previously accepted work should only be rechecked where source or environment has changed.
