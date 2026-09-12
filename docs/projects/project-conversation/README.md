# Project Conversation

**Execution underway · 12 September 2026.** The founder approved continuous local execution after reviewing this package. Current accepted milestones and evidence are in [STATE](STATE.md). The prototype and isolated experiments are implemented; this is not a deployed product.

Recommend a conversation module inside the existing Signal Studio app, using Clerk identity and the Tasks libSQL/Drizzle store. Preserve canonical Project membership, Tasks and task Discussion. Add dependable sending, fresh authorization on retrieval and one shared in-app attention state; external delivery uses a durable outbox. Prove synchronization and revocation in isolated experiments before committing to a realtime vendor.

The repository changes several starting assumptions. A Project is currently the database workspace, Notes are private to their author, and the published Timeline imports designated milestones. The approved local execution envelope starts with Project conversation, later adds **Project-scoped DMs**, labels the note action **Save to my Notes**, and keeps ordinary deadlines in Tasks Schedule/Calendar. Human testing, provider verification and release retain their separate gates.

## Reading order

1. [Decisions](decisions.md) — departures, evidence, residual risks and founder choices.
2. [Technical plan](technical-plan.md) — repository audit, schemas/API/permission/recovery contracts, UX and operations.
3. [Delivery backlog](delivery-backlog.md) — first two vertical slices, PC-00–20 dependencies and dispatch-ready packets.
4. [Verification and release](verification-release.md) — all original T01–24, R01–14, WP01–12 and D01–12 mappings, experiments and release controls.
5. [Agent orchestration](agent-orchestration.md) — actual tool/configuration/billing evidence, model routing and exact Sol handoff.
6. [STATE](STATE.md) — baseline, source provenance, completed work, remaining gates and resume steps.

## First useful delivery

VS1 takes a project question through a durable message and response into **one canonical dated task with a safe source link**, including offline/uncertain-send recovery and revocation. VS2 adds consenting pair DMs, one-level replies, canonical task Discussion integration, one attention state, private Notes outcomes and permission-aware search. Guest participation, files if needed, and optional AI are separately gated expansion; no AI service is required for messaging.

Use **Sol for routine execution, Astra for architecture and high-risk acceptance, Luna for bounded inventory/fixtures**. Native worker requests and useful delegation worked here; effective per-worker model/effort metadata was not returned. The plan reports that limit. If effective mixed-model settings cannot be verified, use one known selected agent sequentially. No new orchestration infrastructure is proposed.

## Decisions to approve

| Choice | Recommendation |
|---|---|
| Local scope | Authorize PC-00 through PC-14 and stage-appropriate PC-20 in dependency order, using synthetic data. Begin with prototype and feasibility; stop at human/environment/high-risk gates. Real pilots and later phases remain held. |
| Scope corrections | Accept D-PC01 Project-scoped pair DMs, D-PC02 private Notes, D-PC03 existing task-date/milestone behavior. If broader DMs/shared Notes are required now, amend scope before implementation. |
| Interaction/consent | Retain shell; test Messages pin/panel behavior. Require explicit pair acceptance and deliberate DM reopening, current Project history policy and reader-private attention state; see technical foundational clarifications. |
| Architecture experiment | Approve current-store durable messaging and authorized polling experiment, not a vendor purchase. Stop at a provider/cost decision if measured targets fail. |
| Compute/capacity | One slice, one coordinator, normally one worker, at most two useful workers; one correction then diagnosis. Existing Codex account allowance only, no extra spending. These are advisory process controls, not a dollar/token hard cap. |
| Later required decisions | Before real data: retention/admin/export/support and a cash/support ceiling. Before any real pilot: explicit environment, deployment and participant communication approval. |

The fresh review identified gaps in epochs, attention atomicity, task-comment receipts, DM re-entry, private read-state ownership and cross-store Notes recovery. The plan now defines those boundaries explicitly. In particular, a missing original Notes draft can require review; it is never reconstructed or silently resent with different text.

**EXECUTE means:** start the approved local plan, create isolated task worktrees/local branches as needed, implement and test ready tasks, make local task commits where useful, continue routine fixes within scope, and maintain evidence/STATE. It stops at founder prototype/comprehension review, unavailable designated test environment, material privacy/scope/cost decision and the listed acceptance gates. It does **not** authorize production deployment/migration, destructive data operations, external invitations/messages, purchases/API billing changes, push/PR publication, real participant research outreach, or unapproved guest/AI implementation/release. Local synthetic feasibility may proceed while the prototype awaits review, but backend integration waits for G1.

No release date, passed feasibility result, customer validation, precise cost saving or production readiness is claimed. The supplied PDF variants were unavailable; the two Markdown reports and operative prompt were reviewed. All seven artifacts are saved locally in the existing `docs/projects/` convention, with a review snapshot in this task's outputs folder. Canonical continuation is the repository directory; snapshots are not a second project authority.
