# PC-08 task outcomes implementation report

Date: 2026-09-12  
Branch: `feat/project-conversation-task-outcomes`

## Result

Project Conversation messages can be promoted into canonical Tasks through `createConversationTaskOutcomeService(adapter)`. The operation accepts newly authored task text, an explicit destination Project, confirmed owner, exact calendar date, source revision, and reviewed audience epoch. It stores no source message body or excerpt.

The open write transaction rechecks the canonical actor, source membership and lifecycle, exact source message revision, current audience epoch, destination membership/archive state, and owner membership. It then creates the task, task activity, immutable work link, suite outbox event, and durable operation receipt atomically. Exact retry returns the same task and link; reuse with changed form or source identity returns `request_conflict`.

`addTaskAction` now uses the same executor-neutral task creation core. Its existing input and `Task[]` return contract remain, while its sequence allocation, position allocation, task insert, and activity insert occur in one Drizzle transaction after a fresh user and Project capability proof. Demo handling, sponsorship, invalidation, and realtime notification retain their prior ordering around the committed write.

## Service contract

`promoteMessageToTask({ actorId, input })` accepts `clientRequestId`, `sourceProjectId`, `conversationId`, `messageId`, `expectedRevision`, `expectedAudienceEpoch`, `destinationProjectId`, `title`, `ownerUserId`, and `dueDate`. It returns `ConversationResult<{ taskId; workLinkId; clientRequestId; committedAt }>`.

`getTaskOutcome({ actorId, taskId })` returns authorized body-free source and destination metadata, or `null` when the actor cannot currently open both Projects.

`getTaskDestination({ actorId, projectId })` returns an active authorized Project name and current member ID/name roster without creating a conversation.

## Database evidence

Migration `0029_conversation_task_outcomes` is additive. It creates `work_links` and `work_operation_receipts`, an exact source index, relationship guards, and immutable-row guards. Migration SHA-256: `5fdf246389988e2c7f4eef01a42ee0893f42af02302380165424a8e585919dc3`. Receipt SHA-256: `7c62696453273ca3d77259defda3bc556c06ee5e81d138bb207b1192997f8ce8`.

The receipt authorizes isolated local dry runs and CI application only. No remote or production migration was run.

## Verification

- PC08 file-database persistence tests: 3/3 passed. They cover 20-way exact-request convergence, changed-form conflict, stale audience and revision, foreign owner, revoked destination membership, archived destination, body-free provenance, exact date mapping, non-milestone default, authorized link read, and rollback after each of task, activity, link, outbox, and receipt.
- Shared task-core tests: 2/2 passed. They cover defaults, explicit completion/date values, sequence/position result propagation, activity ordering, and surfaced activity failure for transaction rollback.
- Existing Tasks security regression: 14/14 passed.
- Existing planning date, anchor due, and Timeline milestone-source set: 54/54 passed.
- Migration ledger tests: 20/20 passed, including fresh apply, no-op rerun, receipt hashes, schema drift, and semantic postconditions.
- Migration structure contract passed with 30 Tasks SQL files.
- TypeScript and focused ESLint passed.

## Limitations

No HTTP route or UI is included in PC-08. The suite outbox row is durable but delivery behavior for the new `task.created` event remains an integration concern for the receiving task. Runtime remote transaction verification remains governed by the existing Project Conversation adapter boundary.
