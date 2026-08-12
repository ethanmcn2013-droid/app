# Contract · InboxEvent

**Status:** Sealed (Wave 1). Binding on Wave 6, on the badge wherever it renders, and on
every lab direction that draws an Inbox.
**Base:** `origin/main` @ `78021c5` · branch `feat/home-operating-layer` · worktree `_wt-home-layer`
**Consistent with:** `contracts/PROJECT_SCOPE.md` (sealed) — this contract does **not**
redefine Project identity, membership, Read Scope or mutation destination. It consumes them.
**Adopts:** `docs/adr/0001-canonical-project-identity.md` via `DECISIONS.md` D-H01.
**Decisions taken here:** `D-INBOX-01 … D-INBOX-16` (§16). The lead may renumber these into
`DECISIONS.md`; they are namespaced so they cannot collide with `D-Hxx`, `D-0xx` or the
in-source `D-0xx` series while they wait.

Changing anything sealed here requires a new founder-approved ADR or a lead-owned amendment.
An implementation agent may not reopen it.

---

## 0. What this contract is, and what it is not

It is the definition of **one event that asks a specific person for a response**, the state
that person holds over it, and the exact number that may appear on a badge.

It is **not** a migration. Audits A and B establish that there is no event store to migrate:

| Fact | Evidence at `78021c5` |
|---|---|
| Inbox read state is client-only `localStorage` under `tasks_dismissed_nudges` | `src/components/app/inbox/inbox-app.tsx:207`, `:209-217`, `:229-240` |
| `notify()` returns early when the payload has no `taskId`, so nothing that is not a task can ever be stored | `src/server/db/notifications.ts:40-42` ("bail rather than write a tenant-less row") |
| `notifications.read_at` exists and is mapped on read, and **nothing writes it** | column `src/server/db/schema.ts:585-586`; mapped `src/server/db/queries.ts:574`; `audit/B-domain-permissions.md:333-337` |
| Reads are workspace-scoped and capped at 50 rows | `src/server/db/queries.ts:579-598` (`byWorkspace(…)` at `:588`, `.limit(50)` at `:595`) |
| No approval primitive exists anywhere in `src/` — no table, no column, no action | `audit/B-domain-permissions.md:322-330` |

So this is **new schema under expand → migrate → contract** (`R-H12`), specified as such in
§13 and §14.

---

## 1. Why five of six V1 kinds cannot be emitted today

This is the most important finding in this contract, and it changes what Wave 6 costs.

Every event in this store is keyed on a **durable source event record** — a row in a source
product that exists once, has its own primary key, and is never rewritten in place (§4). Of
the six V1 kinds, exactly one has such a record today.

| V1 kind | Durable source record it must key on | Exists at `78021c5`? |
|---|---|---|
| **mention** | `comments.id` — a comment whose body carries a mention token | **Yes.** `src/server/db/schema.ts:479-496`; written at `src/server/actions/comments.ts:113-120`; mentions extracted at `:133` and notified at `:142-149` |
| **reply** | a comment that answers a specific earlier comment | **No.** `comments` has no parent, thread or `in_reply_to` column — the whole table is `id, workspace_id, task_id, user_id, body, created_at` (`src/server/db/schema.ts:479-491`) |
| **review-requested** | a review-request record | **No.** No such table, column or action. "Review" exists only as a board lane (`src/lib/data.ts:205`) — a position, not an ask, with no requester, no requestee and no request instant |
| **approval-requested** | an approval record | **No.** `audit/B-domain-permissions.md:322-330`: no approvals table, column or action anywhere in `src/server` or `src/modules`. The word survives only in Notes' *extract approval* sense |
| **handoff** | a reassignment record | **No.** `assignees` is a JSON array column patched in place (`src/server/db/schema.ts:53-56`; patched at `src/server/actions/tasks.ts:370`, `:419-424`, `:445-448`), with no event row, no history and no index |
| **explicit-block** | a block record | **No.** `blockedBy` is a JSON array (`src/server/db/schema.ts:67`) patched in place. The `notifications` kind `"blocked"` is declared at `src/lib/data.ts:696` and has **zero writers** — verified: the only `notify()` call sites in `src/server` are `actions/comments.ts:142` (mention), `milestones.ts:77` (milestone) and `actions/nudge.ts:190-192` (nudge) |

**Consequence, and it is not an Inbox consequence.** Wave 6 is not "build an Inbox". It is
"build five source event emitters, then build an Inbox". The five emitters are source-product
work in `src/server/actions/**` and `src/server/db/**` — paths the Project Truth lanes are
actively migrating (`COLLISION_REGISTER.md`; `docs/wave/MUTATION_INVENTORY.md`). Sequencing,
not concurrent authorship, is the only safe resolution.

**D-INBOX-01. A kind ships only when its durable source record exists.** No kind is
approximated from a mutable column, a lane position, a JSON array diff, or a timestamp
comparison. A V1 kind with no source record is **not shipped and not silently omitted**: the
Inbox names it as a capability it does not yet have, in the same vocabulary Analytics already
uses for a missing provider (`ProviderCoverageStatus` includes `"unsupported"` —
`src/modules/signal/lib/analytics/contracts.ts:227-233`).

---

## 2. The object model — two records, not one

```
InboxEvent            one row per source event.        Shared across recipients.
InboxEventState       one row per (event, recipient).  Personal. Never shared.
InboxSourceAttempt    one row per source-action try.   The receipt log (§9).
```

**D-INBOX-02. The event and the person's state over it are separate rows.** Rationale:
deduplication, revocation and source revision are properties of the *event*; visibility,
disposition, snooze and clearing are properties of the *person*. A single denormalised row
makes "clearing is personal" (§8.4) an accident of careful writing rather than a structural
guarantee, and makes revocation an N-row update that can partially fail.

### 2.1 InboxEvent — the fields, and what each one is for

| Field | Type | Rule |
|---|---|---|
| `id` | internal opaque id | Home's own key. **Never** derived from, nor equal to, any source id. Never rendered. |
| `sourceProduct` | `"tasks" \| "notes" \| "timeline"` | Three products (Charter rule 1). `"signal"` is not a value; Home is not a product. |
| `sourceEventId` | durable string, supplied by the source | The dedup key (§4). Opaque to Home. |
| `kind` | one of the six (§3) | Closed union. An unknown kind is **rejected at write**, never coerced (contrast `src/modules/signal/lib/data/source.ts:121-136`, which logs an unknown lane once and coerces it to `"next"`). |
| `workspaceId` | branded `ProjectId` | The canonical Project — Tasks `workspaces.id` (`PROJECT_SCOPE.md` §1). Not nullable. An event with no Project is not writable (§6). |
| `actorUserId` | user id or `null` | The person who caused it. `null` = system-originated, and a system-originated event is never rendered as if a person asked. |
| `sourceObjectType` / `sourceObjectId` | strings | What to open. Resolved live (§11); never used for authorization. |
| `sourceRevisionAtEmit` | opaque revision token | The source's own version at the moment of emission. Kept to detect that the source has moved on (§12), **never** to claim the event is resolved. |
| `threadKey` | durable string | Grouping (§5). |
| `episodeKey` | durable string | Which ask this belongs to (§4.3). |
| `occurredAt` | UTC instant | The **source** event time, not the insert time (§7). |
| `recordedAt` | UTC instant | When Home wrote the row. Differs from `occurredAt` on a retried delivery. |

### 2.2 InboxEventState — the fields

| Field | Rule |
|---|---|
| `recipientUserId` | The person this asks. One row per person. Never an email address (§3.3). |
| `visibility` | `"new" \| "read"` — axis 1 (§8). |
| `disposition` | `"open" \| "snoozed" \| "acknowledged" \| "cleared"` — axis 2 (§8). |
| `readAt`, `readReason` | `readReason` is a member of the **allowlist** at §8.3. Written together or not at all. |
| `dispositionAt`, `dispositionReason` | `"arrival" \| "user" \| "source-receipt" \| "reconciliation"`. Every disposition change records who moved it. |
| `snoozedUntil`, `snoozeZone` | The resolved UTC instant **and** the IANA zone used to resolve it (§10). Storing the instant without the zone makes the decision unauditable. |
| `resolvingAttemptId` | Set only when `disposition = "acknowledged"` and the cause was a source receipt. |

---

## 3. V1 kinds — and what is deliberately not one

### 3.1 The six

| Kind | The ask | Not this |
|---|---|---|
| `mention` | Someone named you in a comment and expects you to see it | A comment on a task you happen to watch |
| `reply` | Someone answered something you wrote | Any subsequent comment in the same thread |
| `review-requested` | Someone asked you to review a specific thing | A task sitting in a lane called Review |
| `approval-requested` | Someone asked you to approve or decline a specific thing | A task assigned to you |
| `handoff` | Work moved to you and now needs your action | A bulk reassignment sweep, or being added as a second assignee |
| `explicit-block` | Something is blocked and you are the person who can unblock it | Any task with a non-empty `blockedBy` array |

Every one of the six shares a property: **a named person made a request of a named person.**
That is the admission test. If no person asked, it is not an Inbox event.

### 3.2 Excluded, permanently, unless a new founder decision reopens it

| Excluded | Why | Where it belongs |
|---|---|---|
| **Due work** | A date is not a request. The `dueToday` notification kind exists in the type union (`src/lib/data.ts:703-706`) and has **zero writers** — the estate already declined to build it | My work · Today |
| **Digests** | A digest is a summary of a period, not an ask. `compileDailyDigest` is a period rollup (`src/server/db/daily-digest.ts:38-47`) | Full briefing |
| **Routine edits** | `ActivityKind` carries sixteen values (`src/lib/data.ts:613-629`); fourteen of them are edits. The existing policy already says so in source: "Lane moves, status changes, simple field edits never insert" (`src/server/db/notifications.ts:15-18`) | Nowhere |
| **Status churn** | Same. A lane move is not a request | Nowhere |
| **Completion celebration** | The `milestone` kind fires at 100/250/500/1000 completed tasks (`src/server/milestones.ts:74-83`). It is a reward, not a request. Putting it in a badge that means "someone needs you" makes the badge dishonest | Founder decision (§15 item 3) |
| **Broad activity** | An activity feed answers "what happened"; the Inbox answers "what needs me" (Charter rule 10 — mutually exclusive primary jobs) | Nowhere |
| **Automatic AI priority** | Charter rule 12: AI may not invent priority, ownership, risk or next actions. The Inbox has **no ranking engine** (§7) | Nowhere |

### 3.3 Invitation is excluded, pending a separate `InviteEventContract`

**D-INBOX-03. Invitation is not a V1 kind.** Five independent reasons, each a structural
mismatch with this contract rather than a scheduling preference:

1. **Its recipient is an email address, not a user.** `pending_invites.email` is the target
   and `accepted_by_user_id` is null until redemption
   (`src/server/db/schema.ts:951-976`, email at `:958-959`, `:974-975`). Every state row in
   this contract is keyed on `recipientUserId`. An invite has no user to key on — the person
   may not have an account yet.
2. **Its authorization model is a token, not membership.** An invite is precisely the thing
   you may act on *without* being a member. §6 requires live membership of the event's Project
   through seam 1 (`PROJECT_SCOPE.md` §3). An invite inverts that predicate.
3. **Its Project is one you are not in.** So it is never in the actor's membership set, and
   `all-projects` (`PROJECT_SCOPE.md` §5 rule 3) cannot contain it by construction.
4. **It already has a durable event record and its own lifecycle.** `workspace_events` carries
   `inviteSent` / `inviteAccepted` (`src/server/db/schema.ts:978-1006`) and there is a
   dedicated `src/server/invite-lifecycle-contract.test.ts` in the executed suite
   (`package.json:46`). Folding invitation in would fork a model that already works.
5. **It carries an existence-leak boundary this contract does not solve.** `workspace_events`
   deliberately excludes PII: "No PII in the payload (email addresses excluded)"
   (`src/server/db/schema.ts:996-998`). An invite row must render *who invited you to what* —
   naming a Project you are not a member of. `PROJECT_SCOPE.md` §8.1 collapses missing and
   forbidden precisely to avoid that.

**What `InviteEventContract` must settle before invitation can ship anywhere:** recipient
identity before provisioning (email vs pending user vs redeemed user, and what happens to the
row across all three); pre-membership authorization; whether a non-member's pending invite may
contribute to a badge at all; invite expiry (`expires_at`, 7 days — `schema.ts:967-968`) and
resend cooldown (`last_sent_at`, `:969-971`) as distinct from event revocation; the
existence-leak boundary; whether a declined invite is a personal `cleared` or a source-terminal
state; and where an invite renders for a person whose route state is `empty`
(`PROJECT_SCOPE.md` §8.2) because they have no Projects at all.

### 3.4 Nudge has no V1 home, and that is a recorded loss

`nudge` is a live notification kind with a real writer (`src/server/actions/nudge.ts:190-192`)
and a real preference toggle (`notification_prefs.nudges`, `src/server/db/schema.ts:686-691`).
A nudge *is* a named person asking a named person — so it passes the §3.1 admission test — but
it is not one of the six kinds this contract was scoped to.

**D-INBOX-04. `nudge` is not silently mapped onto `mention`.** Mapping it would make the
`mention` count a lie, and the estate's recurring failure mode is exactly this: making a
number tidy by folding an unlike thing into it (`PROJECT_SCOPE.md` §6). It is recorded as an
open founder decision (§15 item 3), and until it is taken the migration parity statement in
§14 names it as content the V1 Inbox does not carry.

---

## 4. Identity, deduplication and grouping

### 4.1 Deduplication is a database constraint, not application logic

**D-INBOX-05. Exact deduplication is enforced by `UNIQUE (source_product, source_event_id)`,
and the write is `INSERT … ON CONFLICT DO NOTHING`.** There is no dedup query, no comparison
of timestamps, and no similarity test anywhere in the write path.

**Fuzzy time-window deduplication is forbidden.** No code path may collapse two events because
they arrived close together, because they share a task, because they share an actor, or
because a configurable window elapsed. Rationale: a time window is a guess that silently
destroys a real second ask, and it fails in exactly the case that matters — a fast-moving
thread where two different people ask two different things a minute apart. A structural
constraint cannot be tuned into wrongness later.

The estate already has the correct precedent and the incorrect one side by side. Correct:
milestone awarding uses `ON CONFLICT(key) DO NOTHING` on a durable key, and records the award
even when the notification is suppressed, so idempotency and delivery are separate concerns
(`src/server/milestones.ts:62-83`). Incorrect: `notifications` has no uniqueness constraint at
all (`src/server/db/schema.ts:569-592`) — the same mention delivered twice writes two rows.

### 4.2 `sourceEventId` is supplied, not derived

The source emitter supplies it. Home treats it as opaque. It must satisfy three properties,
and each is checkable at the emitter:

1. **Durable.** It survives edit, rename, reassignment, archive and restore of the source
   object. It is a pure function of source primary keys that already exist.
2. **Exact.** Two different asks never produce the same value; one ask never produces two.
3. **Free of content.** It is never derived from body text, a title, a snippet or an email
   address, because the id is stored, logged and indexed (§11).

The mention derivation, the only one available today: `comments.id` — one comment, one ask,
never rewritten (`comments` has no `updated_at` and no update path; the only mutation is
delete, `src/server/actions/comments.ts:160+`).

A comment that mentions two people is **one event with two recipients**, not two events.

### 4.3 `episodeKey` — what makes a new ask new

`episodeKey` names the ask. `sourceEventId` names the emission. They differ only where a
source can re-emit within one ask.

**D-INBOX-06. Re-notification within one episode is the source's problem, not Home's.** A
source emits **one event per episode**. If it wants to ask again it must open a new episode,
which produces a new `sourceEventId` and therefore a new event. There is no reminder path, no
escalation counter and no re-surfacing of an existing event by the source. This kills
notification storms structurally instead of damping them with a window.

Consequences that fall out, and each is required behaviour:

- **A new episode creates a NEW event; it never resurrects a cleared one.** The cleared event
  keeps its state. The new event arrives `new` / `open` with its own row. Nothing is mutated
  in place, so nothing can reappear.
- **An edit is not a new episode.** Editing a comment to re-mention someone who cleared it
  produces the same `sourceEventId`, the insert conflicts, and nothing reappears.
- **A new recipient on an existing event is a new state row, not a new event.** Editing a
  comment to mention a third person adds `(event, person C)` at `new` / `open`. Persons A and
  B are untouched.

### 4.4 Grouping never merges state

Grouping is a **read-time** presentation over `threadKey`. It is never stored, never a row,
and never a merge.

- Two events in one group hold **independent** visibility and disposition. Reading one does
  not read the others; clearing one does not clear the others; there is no "mark group read"
  that writes a state the person did not choose per item.
- A group's badge contribution is **the count of its qualifying members**, not 1 (§9.2).
- A group takes the list position of its newest qualifying member (§7). Grouping reorders
  nothing else.

---

## 5. Thread key

`threadKey` is the durable identity of the conversation or object the event belongs to. It is
supplied by the source alongside `sourceEventId`, and it is **not** a computed grouping of
titles, actors or times.

| Kind | `threadKey` |
|---|---|
| `mention` | the task the comment is on — `comments.task_id` (`src/server/db/schema.ts:482-484`) |
| `reply` | the root comment of the reply chain — **requires the thread column that does not exist** (§1) |
| `review-requested` · `approval-requested` | the object under review or approval |
| `handoff` | the object handed over |
| `explicit-block` | the blocked object |

Two events with the same `threadKey` and different `workspaceId` cannot exist: `threadKey` is
scoped inside a Project by construction, because every source object is.

---

## 6. Project, recipient and authorization

**Every event carries exactly one `workspaceId`, and it is the canonical Project** — Tasks
`workspaces.id` (`PROJECT_SCOPE.md` §1). Not a Timeline slug, not a slug pair, not an `ms-…`
node id, not a slugified tag Label (`PROJECT_SCOPE.md` §2.2, §2.3).

**Rules.**

1. **An event with no Project is not writable.** `tasks.workspace_id` is still nullable during
   the cutover (`src/server/db/schema.ts:38-41`), so an Unprojectable source row exists in
   principle. It produces **no** Inbox event, and the omission is disclosed at the source
   emitter, never silently. Contrast today's `notify()`, which bails on a missing `taskId`
   with no record that it did (`src/server/db/notifications.ts:40-42`).
2. **Every read re-authorizes.** Membership is resolved live through seam 1 for every request,
   via the `src/lib/projects/**` facade (`PROJECT_SCOPE.md` §3 rules 1 and 4). The Inbox adds
   no sixth membership seam and no membership cache. Revocation takes effect on the next
   request.
3. **No Inbox read or write ever calls `getActiveWorkspace()`.** The recipient is the
   authenticated actor; the Project comes from the event row. The cookie is not an input. This
   is the single rule that prevents the Inbox inheriting the silent-no-op failure documented at
   `PROJECT_SCOPE.md` §9 and `R-H11`.
4. **The recipient is an internal user id.** Never a Clerk id in the state row, never an email
   address. Note the live hazard: `getCurrentUser()` returns the raw Clerk id when the
   provisioning webhook has not landed (`src/server/auth.ts:111-120`), which addresses one
   person as two ids. The state table is keyed on the provisioned `users.id`; an unprovisioned
   actor gets **no** state rows written and the surface says the account is still being set up.
   It never silently writes a second identity's state.
5. **A recipient who was never a member gets no event.** Assignee values are not validated
   against membership today (`PROJECT_SCOPE.md` §3.1 consequence 3) — so the emitter validates
   membership at emit, and the reader re-validates at read. Two checks, because either alone
   is wrong at a different moment.

---

## 7. Ordering

**D-INBOX-07. One order, deterministic, total, and not rankable.**

```
ORDER BY occurred_at DESC, source_event_id ASC
```

- **`occurred_at` is the source event time, never the insert time.** A late delivery appears
  in its true position. `suite_outbox` already models retried delivery with `attempts` and
  `last_error` (`src/server/db/schema.ts:193-210`), so lateness is a real case, not a
  hypothetical. An item delivered more than a stated threshold after it occurred is **labelled
  late**; it is never re-stamped to now.
- **`source_event_id ASC` is a total-order tiebreak, not decoration.** Without it, pagination
  can drop or duplicate a row at a page boundary, and Wave 2's deterministic fixture universe
  cannot produce a stable snapshot. The estate has a live example of the cost: the analytics
  Tasks provider reads 2,000 rows with no `ORDER BY` at all
  (`src/modules/signal/server/analytics/providers/tasks.ts:58-62`, recorded as R10 in
  `docs/wave/ANALYTICS_TRUTH.md`).
- **The Inbox has no ranking engine.** It does not consume the Today / Full-briefing ranking
  engine (Charter rule 9 binds *those two* to one engine; it does not enrol the Inbox), it
  does not sort by kind, and it does not sort by any inferred importance. Charter rule 12
  forbids AI-invented priority; this rule forbids deterministic invented priority too, because
  a hand-tuned weight is no more evidenced than a model's.
- **Grouping does not reorder.** A group sits at its newest qualifying member's position.

---

## 8. The two independent axes

**D-INBOX-08. Visibility and disposition are orthogonal. All eight combinations are legal.**

```
visibility   := "new" | "read"                                    // did I look at it
disposition  := "open" | "snoozed" | "acknowledged" | "cleared"    // is it resolved for me
```

|  | open | snoozed | acknowledged | cleared |
|---|---|---|---|---|
| **new** | arrival state | snoozed from the list without opening | resolved without opening (bulk acknowledge, or a source action taken elsewhere) | dismissed without opening |
| **read** | **looked at, still needs me** | looked at, deferred | looked at, resolved | looked at, dismissed |

The cell that matters is `read` / `open`. It is the whole reason there are two axes.

### 8.1 Reading never resolves

Marking read writes `visibility` and nothing else. It never writes `disposition`, never
removes an item from the badge (§9), never advances a snooze, and never emits a source action.

The inverse also holds and is weaker on purpose: **resolving does not mark read.** Acknowledging
without opening leaves `new` / `acknowledged`, because visibility is a factual record of
exposure and the person genuinely did not look. This produces no visual contradiction, because
the unread affordance is only ever rendered inside the badge-eligible set (§9.1), which
acknowledged items are not in.

### 8.2 Visibility is monotonic

**`new → read` only. There is no "mark as unread".**

Rationale: "mark unread" is a way of using the exposure record as a to-do flag, which is
exactly the conflation two axes exist to prevent. It also falsifies a fact — you did look.
The truthful control for the same intent already exists on the other axis: **reopen**
(§8.5). Consequence, and it is binding: the surface must offer an explicit reopen from
`snoozed`, `acknowledged` and `cleared`, or the monotonic rule costs the user something.

### 8.3 What may mark read — an allowlist, never a denylist

**D-INBOX-09. Only a reason on this allowlist may set `visibility = "read"`. Every other
exposure is refused with a typed refusal, not silently ignored.**

| Allowed | |
|---|---|
| `detail-open` | The person explicitly opened the item's detail view |
| `explicit-mark-read` | The person used the mark-read control |

Refused, and each is refused by name so a caller cannot claim it did not know:
`hover`, `prefetch`, `viewport`, `list-render`, `auto-select`, `keyboard-roving-focus`,
`bulk-select`, `group-expand`, `badge-open`, `route-visit`.

An allowlist is the only version that stays correct when the next interaction is invented. A
denylist would silently admit it.

Note the live pressure this rule resists: the current Inbox mounts inside `TasksRuntimeShell`
and its rows call `useTaskPanel()` (`audit/C-design-interaction.md:522-523`) — a panel that
opens on selection. Auto-selection marking read is precisely the accident this rule forbids.

### 8.4 Clearing is personal and never touches source work

`cleared` writes one row: `(event, this recipient)`. It does not write the source. It does not
write another recipient's row. It does not complete a task, resolve a comment, decline an
approval, or unblock anything.

The user-facing word is **Clear**, never "Done", "Resolve", "Archive" or "Dismiss and
complete", because three of those name source-work outcomes this action does not produce.

### 8.5 Disposition transitions

| From | To | Cause |
|---|---|---|
| `open` | `snoozed` | user, with a resolved resurface instant (§10) |
| `open` | `acknowledged` | a durable source receipt (§9), **or** an explicit acknowledge by the person |
| `open` | `cleared` | user |
| `snoozed` | `open` | resurface (derived, §10.5) or explicit reopen |
| `snoozed` | `acknowledged` / `cleared` | as above |
| `acknowledged` | `open` | **explicit reopen by the person only** |
| `cleared` | `open` | **explicit reopen by the person only** |

**D-INBOX-10. The person may reopen; the system may not.** A person undoing their own clear is
their state, their choice, and it mutates nothing outside their row. A *source signal* that
reopens a cleared event is the resurrection this contract forbids (§4.3) — the source's remedy
is a new episode. Reconciliation (§9.4) is bound by the same rule: it may move a state toward
the source's answer, never away from a resolution the person chose.

Every transition writes `dispositionAt` and `dispositionReason`
(`arrival` | `user` | `source-receipt` | `reconciliation`). A disposition with no reason is
not writable.

---

## 9. Source actions, receipts, rollback and reconciliation

A **source action** is an Inbox affordance that changes source work — approve, unblock,
complete, accept a handoff. It is the highest-risk thing on this surface, because the estate's
current failure mode is a mutation that returns success having done nothing.

### 9.1 Nothing is optimistic in the store

**D-INBOX-11. Disposition changes only after a durable source success. A boolean or void
return is not a durable success.**

`moveTaskAction` pre-reads with `eq(tasks.workspaceId, ws)` and returns without erroring when
the row is not in the cookie's workspace (`src/server/actions/tasks.ts:114`, `:118-122`);
`selectWorkspaceAction` returns `{ ok: true }` on a membership refusal
(`src/server/actions/cross-workspace.ts:191`). Both are byte-identical to success.
`docs/wave/MUTATION_INVENTORY.md` classifies 36 call sites where the cookie *is* the write
destination and 40 more where a wrong Project produces a silent refusal that returns success
(`RECONCILIATION.md` §3 row 3).

A **receipt** is therefore required to carry, at minimum:

```
{ attemptId, sourceEventId, recipientUserId, action,
  idempotencyKey, sourceProduct, sourceObjectRef,
  sourceRevisionAfter,      // present iff outcome = "committed"
  outcome, refusalCode?, settledAt }
```

`sourceRevisionAfter` is the load-bearing field. Without a post-commit revision the state row
records that *something* succeeded but not *which version of the source* resolved it, and
reconciliation later has nothing to compare against.

### 9.2 Three outcomes, and the third is not a failure

| Outcome | Meaning | Effect on disposition |
|---|---|---|
| `committed` | The source durably applied it and returned a revision | → `acknowledged`, reason `source-receipt`, `resolvingAttemptId` set |
| `refused` | The source declined, with a typed code | **unchanged.** The refusal is rendered, named, and not retried automatically |
| `undetermined` | The call did not return a durable answer — timeout, transport error, ambiguous response | **unchanged.** The item is marked as awaiting reconciliation and says so |

`undetermined` is neither success nor failure and is never collapsed into either. Rendering it
as success is the exact defect Charter rule 11 exists to prevent; rendering it as failure
invites a duplicate action. Every source action therefore carries an `idempotencyKey`, unique
in the attempts table, so a retry after `undetermined` cannot double-apply.

### 9.3 Optimistic UI rolls back visibly

The client may render a pending affordance. It must not render the resolved state.

- On `refused` or `undetermined`, the pending affordance **reverts visibly** — a state change
  the user can see, not a silent snap-back — and the reason is stated in place.
- Reduced-motion users get the same visible reversion without animation; the change is carried
  by content and by an assertive live-region announcement, not by movement alone.
- A pending affordance never contributes to, or removes from, the badge. The badge reads
  persisted state only (§9.5 below is not a badge input).

### 9.4 Reconciliation

For every attempt left `undetermined`, reconciliation asks the **source** whether the thing is
resolved, using a per-kind capability the source adapter must provide:

```
isResolvedInSource(sourceObjectRef, sourceRevisionAtEmit) ->
  "resolved" | "unresolved" | "unavailable" | "undetermined"
```

Rules:

1. **Reconciliation moves state only toward the source's answer.** `resolved` → the state may
   move `open`/`snoozed` → `acknowledged` with reason `reconciliation`. `unresolved` → the
   state stays as it is; it is never moved back out of a disposition the person chose.
2. **Reconciliation never marks read.** Visibility is a record of human exposure (§8.2).
3. **Reconciliation never clears.** Clearing is personal (§8.4); a machine cannot decide a
   person is no longer interested.
4. **`undetermined` after reconciliation stays undetermined and is disclosed.** It is not
   retried forever silently; after a bounded number of attempts the item is surfaced as
   "could not be confirmed", which is a state a person can act on.
5. Reconciliation is idempotent and bounded, and it is not a cron today: the repository
   declares exactly one cron, `/api/cron/digest?send=1` at `0 9 * * *`
   (`vercel.json:3-8`). Adding a second scheduled job is a lead-owned change with its own gate.

### 9.5 Source actions are gated

Every source action is a Home mutation and is therefore behind `HOME_MUTATIONS_ENABLED`,
which stays default-off until Home's write path takes an explicit `ProjectId`
(`PROJECT_SCOPE.md` §9, `R-H11`). **V1 Inbox therefore ships with personal state actions only**
— read, snooze, acknowledge, clear, reopen — all of which write Home's own tables and none of
which touches source work. That is not a compromise; it is the only shippable shape while
every source mutation is cookie-bound.

Writing personal state is *not* covered by the per-write cookie prohibition, because it takes
an event id and the authenticated actor and resolves nothing ambiently (§6 rule 3).

---

## 10. Snooze and resurface

### 10.1 Snooze targets are wall-clock intentions, not durations

"Tomorrow morning" means 09:00 local tomorrow. It does not mean +24 h. The distinction only
shows itself twice a year, and both times it shows itself as an item arriving an hour wrong.

### 10.2 The zone is an explicit argument; there is no ambient default

The resolver takes an IANA zone as a parameter. It reads no environment, no deployment region
and no request header.

The caller resolves it from `user_preferences.time_zone`, which is **nullable and documented to
fall back to UTC** (`src/server/db/schema.ts:716-718`). A null zone resolves to `UTC` and the
snooze control **discloses the zone it used**. It is never silently assumed to be
`Europe/London` because the settings page happens to default its display formatter to that
zone (`src/app/settings/notifications/page.tsx:20`) or because the analytics fixtures pin it
(`src/modules/signal/lib/analytics/fixtures.ts:20`).

The resolved instant is stored **with** the zone that produced it (`snoozeZone`), so the
decision stays auditable after the person changes their timezone.

### 10.3 Europe/London DST — the three rules

Britain and Ireland move on the last Sunday of March (01:00 GMT → 02:00 BST) and the last
Sunday of October (02:00 BST → 01:00 GMT).

1. **Non-existent local time resolves forward.** On a spring-forward date, 01:00–01:59 does not
   exist. A target that lands there resolves to the **first instant that does exist** (02:00
   BST). Never backwards, never skipped, never dropped.
2. **Ambiguous local time resolves to the first (earlier) occurrence.** On a fall-back date,
   01:00–01:59 happens twice. The target takes the **earlier, BST** occurrence. Resurfacing an
   hour early is a smaller harm than an hour late, and picking a rule at all is what makes it
   deterministic and testable.
3. **"Tomorrow" is a calendar-day operation in the zone, never `+86 400 000 ms`.** A 23-hour or
   25-hour day must not move "tomorrow at 09:00". The estate already owns a DST-immune calendar
   helper for exactly this — `calendarDayDifference`, "immune to 23/25h DST days"
   (`src/modules/signal/lib/briefing/calendar-time.ts:24-30`), with `partsAt` doing the
   `Intl.DateTimeFormat` conversion at `:5-18`.

**D-INBOX-12. The calendar helper is moved to a shared location, not copied.** It sits inside
`src/modules/signal/lib/briefing/` and is not exported through `@/modules/signal/home`
(`src/modules/signal/home.ts:22-36`), so Home cannot reach it today. Copying it is how this
estate acquired four disagreeing definitions of "done"
(`audit/B-domain-permissions.md:452-478`). One implementation, one home, two importers.

### 10.4 Snooze targets, and what each resolves to

| Target | Resolves to |
|---|---|
| Later today | the next whole hour + 3 h, local, clamped to before the local end of day; if the clamp would move it into tomorrow, the control offers "tomorrow morning" instead rather than silently rewriting the choice |
| Tomorrow morning | 09:00 local on the next calendar day in the zone |
| Next week | 09:00 local on the next Monday in the zone |
| A chosen date and time | exactly that local wall-clock time in the zone, subject to §10.3 rules 1 and 2 |

`resurfaceAt` is stored as a UTC instant. The local intention is recoverable from
`(resurfaceAt, snoozeZone)`.

### 10.5 Resurface is a read-time predicate, not a job

**D-INBOX-13. An item is *effectively* open when `disposition = "snoozed" AND resurface_at <=
now`. The stored disposition stays `snoozed` until the person acts.**

Rationale: a job that flips rows creates a second authority on when something is due back, and
it can miss, double-fire, or drift from the read path. A read-time predicate cannot. There is
also exactly one cron in this repository today (`vercel.json:3-8`), and this contract does not
spend the second one on something derivable.

The badge and the list both use the **effective** disposition. A materialising job may be added
later as a cache only, never as the authority, and only if it is proved to agree with the
predicate.

An event whose source has become unavailable still resurfaces — it is not silently dropped —
but it resurfaces into the unavailable rendering and out of the badge (§11.4, §9.2 of the
badge rules).

---

## 11. Storage privacy, and what a row is allowed to contain

### 11.1 The rule

**D-INBOX-14. Store identifiers and state. Never store copied source content.**

| Stored | Never stored |
|---|---|
| ids, kinds, Project id, actor id, recipient id | comment bodies, snippets, task titles |
| timestamps, revisions, thread and episode keys | note bodies, extract bodies |
| visibility, disposition, reasons, receipts | display names, email addresses, avatar URLs |

### 11.2 What today's store does, and why this rule is a change

`notifications.payload` stores content. The `mention` payload carries `snippet` **and**
`taskTitle` (`src/lib/data.ts:686-695`), written from the comment body and the task row at
`src/server/actions/comments.ts:142-149`. That copy is never re-authorized, never invalidated
when the comment is edited or the task renamed, and never removed when the reader loses access
to the Project.

The correct precedent is already in the same file, one kind down: the `nudge` payload is
"deliberately id-only — no names or email addresses are stored in the notification row (D-008
privacy rule)" (`src/lib/data.ts:706-711`). **This contract generalises D-008 to every kind.**

### 11.3 Display is hydrated live, after authorization

1. Resolve the recipient's live membership of the event's Project (seam 1, per request, §6).
2. Ask the source for the minimum display projection for that object, as that actor, now.
3. Render only what the source returned on this request.

Display is never cached across requests and never across actors. Every `/app` route is
`force-dynamic` and no caching primitive exists anywhere in the repository
(`audit/B-domain-permissions.md:576-580`); the Inbox does not start.

Two recipients of the same event may legitimately get different display availability. That is
correct, and neither one's result may be used to render the other's row.

**Notes.** The only Note-derived text that may ever reach the Inbox is the creator-authored
approved extract, labelled as such (`PROJECT_SCOPE.md` §2.4;
`audit/B-domain-permissions.md:482-525`). Raw note bodies never reach Home.

### 11.4 Source visibility — three states, and they are not interchangeable

```
InboxSourceVisibility := "available" | "unavailable" | "undetermined"
```

| State | Meaning | Rendering | In the badge? |
|---|---|---|---|
| `available` | The source resolved and the actor is authorized right now | Normal | **yes** |
| `unavailable` | The source returned a definitive negative — **missing or forbidden, collapsed** per `PROJECT_SCOPE.md` §8.1 | A neutral "no longer available", **with no stale content**, no reason, and a route onward | **no** |
| `undetermined` | The source could not be reached — timeout, transport error, provider down | Named as undetermined, not as gone and not as empty | **yes**, and the count discloses it (§9.2 of the badge rules) |

This extends the existing coverage vocabulary rather than inventing a second one
(`PROJECT_SCOPE.md` §5 rule 7). Aggregated over a read:
`available` → `ready`, `unavailable` → contributes to `partial`, `undetermined` → `partial`
with an issue code, all sources unreachable → `unavailable`
(`ProviderCoverageStatus`, `src/modules/signal/lib/analytics/contracts.ts:227-233`;
constructor `src/modules/signal/server/analytics/providers/coverage.ts:9-30`).

**Never** render `unavailable` as zero, empty, healthy, complete, resolved or all clear. An
unavailable source is not a resolved ask.

### 11.5 Revocation, deletion, and rows that must not vanish

| Event | What happens |
|---|---|
| The recipient's membership of the Project is revoked | The next request resolves `unavailable`. The row survives; the badge drops it; no content is rendered. Nothing is deleted, because deletion on revocation would destroy the audit of what was asked. |
| The Project is archived | `PROJECT_SCOPE.md` §8.3: archived Projects are excluded from `all-projects` by default. Their events leave the badge by the same rule, and appear only under the explicit, labelled archived toggle. |
| The source object is deleted | `unavailable`. **The row does not silently disappear from a list the person is looking at.** It renders as unavailable until the person clears it or retention closes it. A list that shrinks on its own teaches the reader that the count was never real. |
| The event's source ask is withdrawn (a review request cancelled) | The source emits a **withdrawal** against the same `sourceEventId`; the event is marked withdrawn; the badge drops it; the row remains and reads as withdrawn. Withdrawal is not deletion and is not `cleared` — `cleared` is the recipient's word. |

---

## 12. Source revision and "this has changed"

`sourceRevisionAtEmit` is compared against the live revision at hydration.

- If the live revision has advanced, the surface **may** disclose that the source has changed
  since the ask.
- It **may not** infer from a revision change that the ask is resolved, stale, obsolete or
  answered. Only a receipt (§9) or a source resolution probe (§9.4) may move disposition.

---

## 13. Retention

**D-INBOX-15. Retention closes rows on age. It never closes an open ask.**

| Rule | |
|---|---|
| Base horizon | `inbox_events` are retained **180 days** after `occurred_at`. |
| The exception that governs | An event with **any** recipient at effective disposition `open` or `snoozed` is **not** deleted at the horizon. It is retained and the surface labels it as old. Deleting something a person still has open is data loss wearing hygiene's clothes. |
| Cascade | `inbox_event_states` and `inbox_source_action_attempts` delete with their event (`ON DELETE CASCADE`). |
| Blast radius | Retention deletes Inbox rows only. It never touches source work, never a comment, never a task. |
| Disclosure | Any count or list trimmed by retention states the horizon. Because open items are never trimmed, "0 open" after a retention pass remains true — the rules compose. |
| Operation | Idempotent, bounded per pass, logged, and reversible only from backup. It does not exist yet, and it is a second scheduled job (see §9.4 rule 5) — lead-owned. |

---

## 14. Schema sketch

Target database: the **Tasks** database. Rationale: the canonical Project id lives there
(`workspaces.id`, `src/server/db/schema.ts:272-273`), the recipient's membership lives there
(`workspace_members`, `:458-477`), and it is the only database under the receipt-backed
migration runner with a drift alarm — the legacy-named `SIGNAL_*` database has neither
(`R-H14`; `DEPLOY.md` §4; `drizzle/MIGRATIONS.md`).

The next free migration number at this base is `0028` (`drizzle/` ends at
`0027_share_link_token_hash.sql`). Everything below is **additive**: no existing table, column
or index is altered.

```sql
-- drizzle/0028_inbox_events.sql   (expand phase, additive only)

CREATE TABLE inbox_events (
  id                     TEXT PRIMARY KEY,
  source_product         TEXT    NOT NULL,
  source_event_id        TEXT    NOT NULL,
  kind                   TEXT    NOT NULL,
  workspace_id           TEXT    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id          TEXT,
  source_object_type     TEXT    NOT NULL,
  source_object_id       TEXT    NOT NULL,
  source_revision_at_emit TEXT   NOT NULL,
  thread_key             TEXT    NOT NULL,
  episode_key            TEXT    NOT NULL,
  occurred_at            INTEGER NOT NULL,
  recorded_at            INTEGER NOT NULL,
  withdrawn_at           INTEGER,
  emitter_version        INTEGER NOT NULL DEFAULT 1,
  CHECK (source_product IN ('tasks','notes','timeline')),
  CHECK (kind IN ('mention','reply','review-requested',
                  'approval-requested','handoff','explicit-block'))
);

-- Exact deduplication. This index IS the dedup rule (§4.1).
CREATE UNIQUE INDEX uq_inbox_events_source
  ON inbox_events (source_product, source_event_id);

CREATE INDEX idx_inbox_events_thread     ON inbox_events (thread_key, occurred_at);
CREATE INDEX idx_inbox_events_workspace  ON inbox_events (workspace_id, occurred_at);
CREATE INDEX idx_inbox_events_episode    ON inbox_events (episode_key);
CREATE INDEX idx_inbox_events_retention  ON inbox_events (occurred_at);

CREATE TABLE inbox_event_states (
  event_id             TEXT    NOT NULL REFERENCES inbox_events(id) ON DELETE CASCADE,
  recipient_user_id    TEXT    NOT NULL,
  visibility           TEXT    NOT NULL DEFAULT 'new',
  disposition          TEXT    NOT NULL DEFAULT 'open',
  read_at              INTEGER,
  read_reason          TEXT,
  disposition_at       INTEGER NOT NULL,
  disposition_reason   TEXT    NOT NULL,
  snoozed_until        INTEGER,
  snooze_zone          TEXT,
  resolving_attempt_id TEXT,
  PRIMARY KEY (event_id, recipient_user_id),
  CHECK (visibility  IN ('new','read')),
  CHECK (disposition IN ('open','snoozed','acknowledged','cleared')),
  CHECK (disposition_reason IN ('arrival','user','source-receipt','reconciliation')),
  -- read_at and read_reason are written together or not at all (§2.2)
  CHECK ((read_at IS NULL) = (read_reason IS NULL)),
  CHECK (read_reason IS NULL OR read_reason IN ('detail-open','explicit-mark-read')),
  -- a snooze without its zone is unauditable (§10.2)
  CHECK ((snoozed_until IS NULL) = (snooze_zone IS NULL)),
  CHECK (disposition <> 'snoozed' OR snoozed_until IS NOT NULL)
);

-- The badge query, exactly (§9). Covering, and ordered by the retention key.
CREATE INDEX idx_inbox_states_badge
  ON inbox_event_states (recipient_user_id, disposition, snoozed_until);
CREATE INDEX idx_inbox_states_event
  ON inbox_event_states (event_id);

CREATE TABLE inbox_source_action_attempts (
  id                    TEXT    PRIMARY KEY,
  event_id              TEXT    NOT NULL REFERENCES inbox_events(id) ON DELETE CASCADE,
  recipient_user_id     TEXT    NOT NULL,
  action                TEXT    NOT NULL,
  idempotency_key       TEXT    NOT NULL,
  outcome               TEXT    NOT NULL,
  refusal_code          TEXT,
  source_revision_after TEXT,
  attempted_at          INTEGER NOT NULL,
  settled_at            INTEGER,
  reconciled_at         INTEGER,
  reconcile_attempts    INTEGER NOT NULL DEFAULT 0,
  CHECK (outcome IN ('pending','committed','refused','undetermined')),
  -- a committed receipt without a post-commit revision is not a receipt (§9.1)
  CHECK (outcome <> 'committed' OR source_revision_after IS NOT NULL),
  CHECK (outcome <> 'refused'   OR refusal_code IS NOT NULL)
);

CREATE UNIQUE INDEX uq_inbox_attempts_idempotency
  ON inbox_source_action_attempts (idempotency_key);
CREATE INDEX idx_inbox_attempts_unsettled
  ON inbox_source_action_attempts (outcome, attempted_at);
```

**Notes on the sketch.**

- `workspace_id` is `NOT NULL` here even though `tasks.workspace_id` is still nullable during
  the cutover (`src/server/db/schema.ts:38-41`). That is deliberate (§6 rule 1): the Inbox does
  not inherit the nullable-tenant cutover state.
- The `CHECK` idiom follows the existing `resources_kind_check`
  (`src/server/db/schema.ts:945-948`), so this is repository convention, not novelty.
- Migration `0028` must be registered in `drizzle/migration-ledger.json` with a canonical LF
  SHA-256, an execution policy, a review receipt, a rollback plan and machine-verifiable
  postconditions (`drizzle/MIGRATIONS.md`). It reaches production only through `pnpm db:migrate`
  or the `db-migrate` workflow with `command=execute`, gated by `pnpm db:contract`. Never
  `drizzle-kit push`, never `drizzle-kit migrate` (`AGENTS.md` "Database release gate").

---

## 15. Expand → migrate → contract

Nothing in this plan may run in this wave. Wave 1 writes documents and failing tests only.

### Expand — additive, dual-write, readers unchanged

| # | Step | Gate |
|---|---|---|
| E1 | Land `0028_inbox_events.sql` with its ledger entry and receipt. No existing table touched. | `pnpm db:contract` green; receipt covers the exact ledger hash |
| E2 | The **mention** emitter writes an `inbox_events` row alongside the existing `notify()` call. `notifications` remains the source of truth. Failures to write the new row are logged and do not fail the comment. | Dual-write proven on preview |
| E3 | The five missing source event records land — reply thread identity, review request, approval, handoff, block — **each as its own additive migration and its own emitter, in source-product code**. This is the bulk of the work and it is not Inbox work (§1). | Per-kind; each may ship independently |
| E4 | The Inbox read path lands behind `HOME_INBOX_V2_ENABLED`, server-side, default-off, fail-closed, in the flag family at `RECONCILIATION.md` row 9. It does **not** reuse `SIGNAL_ANALYTICS_V1_ENABLED`, which is a briefing-engine switch (`RECONCILIATION.md` §2). | Flag off in every environment by default |

### Migrate — backfill, parity, cutover

| # | Step | The honest part |
|---|---|---|
| M1 | Backfill historical `notifications` rows of kind `mention` into `inbox_events`, deriving `source_event_id` from `payload.commentId` (`src/lib/data.ts:688-694`). Rows with no resolvable comment id are **not** backfilled and the skipped count is recorded. | **Read state cannot be backfilled: there is none.** `read_at` has no writer (`audit/B:333-337`). Every backfilled row arrives `new` / `open`, and the surface discloses that history carries no read state rather than presenting it as unread. |
| M2 | Parity proof: run both readers over the same population and publish the diff. | Parity is provable for the **mention** class only. The other five have no legacy to compare against — parity for them is vacuous and must not be claimed. |
| M3 | Cutover behind the flag. `/app/inbox` keeps rendering the legacy surface until parity is published **and** the founder decision on nudges and milestones is taken (§16 item 3). | `/app/inbox` and `/app/my-tasks` redirect only after semantic and state parity is proven (`RECONCILIATION.md` row 10). `scripts/check-route-manifest.mjs:44-45` pins both directories, so they survive as redirect stubs or the manifest changes with cited authority. |

**Migration parity, stated plainly.** Today's `/app/inbox` stacks six content classes
(`audit/A-repo-product-truth.md:235-258`). A V1 Home Inbox as specified here carries
**mentions**. Greeting, tips, nudges, weekly recap, daily digest and direct alerts either move
to another Home mode, leave, or await a decision. Nothing here should be read as "the Inbox
moved".

### Contract — remove the old path, last, and slowly

| # | Step | Constraint |
|---|---|---|
| C1 | Stop dual-writing. The mention emitter writes the new store only. | Separate release from M3 |
| C2 | Retire the `notifications` kinds with zero writers — `blocked` and `dueToday` (`src/lib/data.ts:696-706`). Type-level removal, no data change. | Verify zero writers again at that base, not from this document |
| C3 | Drop the legacy read path, and the `notifications` table, only after a full retention window (180 days) has elapsed since C1, and only with a receipt and a rollback plan. | Never in the same release as C1 |

---

## 16. Decisions taken by this contract

| Id | Decision | Consequence |
|---|---|---|
| D-INBOX-01 | A kind ships only when its durable source record exists; nothing is approximated from a mutable column | Five of six V1 kinds are blocked on source-product work (§1) |
| D-INBOX-02 | Event and per-recipient state are separate rows | Clearing-is-personal and revocation are structural, not conventions (§2) |
| D-INBOX-03 | Invitation is excluded pending `InviteEventContract` | Five structural mismatches recorded; the new contract's required scope is named (§3.3) |
| D-INBOX-04 | `nudge` is not mapped onto `mention` | Recorded as user-visible content loss at migration; founder decision required (§3.4) |
| D-INBOX-05 | Dedup is a `UNIQUE` constraint; fuzzy time-window dedup is forbidden | No dedup query exists to tune wrong later (§4.1) |
| D-INBOX-06 | One event per episode; re-notification is the source's problem | A new episode creates a new event; nothing is resurrected (§4.3) |
| D-INBOX-07 | One deterministic total order; the Inbox has no ranking engine | `occurred_at DESC, source_event_id ASC`; no invented priority (§7) |
| D-INBOX-08 | Visibility and disposition are orthogonal; all eight cells legal | `read` + `open` is a first-class state (§8) |
| D-INBOX-09 | Marking read is an allowlist of two reasons | Hover, prefetch, viewport and auto-selection are refused by name (§8.3) |
| D-INBOX-10 | The person may reopen; the system may not | Reconciliation moves state only toward the source's answer (§8.5, §9.4) |
| D-INBOX-11 | Disposition changes only on a durable receipt carrying a post-commit revision | A boolean return is not a receipt; `undetermined` is a third outcome (§9) |
| D-INBOX-12 | The DST calendar helper is moved to a shared home, not copied | One implementation, two importers (§10.3) |
| D-INBOX-13 | Resurface is a read-time predicate, not a job | No second cron; no second authority on when work returns (§10.5) |
| D-INBOX-14 | Store identifiers and state, never copied source content | Generalises the in-source D-008 id-only rule to every kind (§11.1) |
| D-INBOX-15 | Retention never closes an open ask | 180 days, with the open/snoozed exception (§13) |
| D-INBOX-16 | The badge counts open items, not unread items | Follows directly from "reading never resolves" (§17) |

---

## 17. The badge — exact membership

**D-INBOX-16. The badge counts `open`, not `new`.** If the badge counted unread items, reading
would empty it — which is precisely "reading resolves", the thing §8.1 forbids. Visibility is
**not** an input to the badge.

An event contributes **1** to the badge for recipient *R* if and only if **all** of the
following hold at read time:

1. an `inbox_event_states` row exists for `(event, R)`;
2. the **effective** disposition is `open` — that is, `disposition = 'open'`, **or**
   `disposition = 'snoozed' AND resurface_at <= now` (§10.5);
3. the event is not withdrawn (`withdrawn_at IS NULL`);
4. the event's `kind` is one of the six (§3.1);
5. the recipient holds **live** membership of the event's `workspaceId` through seam 1, and
   that Project is **not archived** (`PROJECT_SCOPE.md` §8.3);
6. the source visibility is `available` **or** `undetermined` — never `unavailable` (§11.4).

Nothing else. Not visibility. Not kind weighting. Not recency. Not an AI score.

### 17.1 Scope

**The badge is global across the actor's authorized Projects.** It is not scoped by Active
Project and not scoped by Home Read Scope. A badge that changed when you switched Projects
would hide work and would answer a different question every time it was read.

Consequence, and it is binding on Wave 6's route: **the Inbox route defaults to Read Scope
`{ kind: "all-projects" }`**, so the badge and the list agree on arrival. Narrowing the Read
Scope narrows the **list** and the list then discloses "showing N of M"
(`PROJECT_SCOPE.md` §5 rule 4). The badge does not change. That is the only combination in
which neither number lies.

### 17.2 The count is never a bare integer

```
BadgeCount = {
  count: number;
  coverage: "complete" | "partial" | "unavailable";
  undeterminedCount: number;   // sources that could not be verified this request
  unreadableProjectCount: number; // Projects in the membership set that did not resolve
}
```

- `partial` renders as a count **with** a disclosure, never as a clean number.
- `unavailable` renders as **no count at all** — not `0`. Zero is a claim.
- Above 99 the visible glyph may read `99+`, and the accessible name carries the exact
  integer. Truncation is a display convention; it is never applied to the accessible value.
- One unresolvable Project makes the badge `partial`; it never makes it `0` and never makes it
  disappear (`PROJECT_SCOPE.md` §5 rules 4 and 7).

### 17.3 One badge, one definition, everywhere

Charter rule 6 and `RECONCILIATION.md` row 5: the global Inbox affordance and the Home-local
link resolve to the same route and the same count. There is exactly one function that produces
`BadgeCount`; every surface calls it.

**What ships today does none of this.** The Tasks views-menu Inbox row renders `inboxCount`
with the accessible name `` `${inboxCount} open tasks` `` (`src/components/app/sidebar.tsx:308-314`),
and `inboxCount = openTaskCount(tasks)` (`:169`) counts tasks in the client `TasksState` that
are not `lane === "done"` (`src/lib/tasks/selectors.ts:61-71`). So the current Inbox badge
counts **tasks, in one cookie-selected Project, using the `lane === "done"` literal instead of
`isTaskDone`** (`PROJECT_SCOPE.md` §5 rule 5) — three separate ways of not being an inbox count.
It is replaced, not adapted.

---

## 18. Executable assertions

Written as failing contract tests in `src/lib/home-layer/inbox/` (§19). Each fails today
because the thing it specifies does not exist.

| # | Assertion | Must fail today because |
|---|---|---|
| I1 | The kinds union is exactly the six of §3.1 | no module exports it |
| I2 | `invitation` is not assignable to an Inbox kind | no union exists |
| I3 | Two emissions with the same `sourceEventId` produce one event | no store, no constraint |
| I4 | Two emissions close in time with different `sourceEventId`s produce **two** events | no dedup rule exists to forbid the fuzzy one |
| I5 | A new `episodeKey` after a `cleared` event produces a new event, and the cleared row is untouched | no state machine |
| I6 | `markRead` refuses `hover`, `prefetch`, `viewport`, `auto-select` with a typed refusal | no exposure allowlist |
| I7 | `markRead` never changes `disposition` | no state machine |
| I8 | `visibility` has no `read → new` transition | no state machine |
| I9 | Badge membership ignores `visibility` entirely | no badge function |
| I10 | Badge membership excludes `unavailable` sources and includes `undetermined` ones | no source-visibility model |
| I11 | A snoozed item whose `resurfaceAt` has passed is badge-eligible without any job having run | no resurface predicate |
| I12 | "Tomorrow 09:00" across the Europe/London spring-forward boundary is 24 h − 1 h apart in UTC, and still 09:00 local | no resolver |
| I13 | A non-existent local time resolves **forward**; an ambiguous one resolves to the **earlier** occurrence | no resolver |
| I14 | A source action with a `refused` or `undetermined` outcome leaves `disposition` unchanged | no receipt model |
| I15 | A `committed` receipt without `sourceRevisionAfter` is rejected | no receipt model |
| I16 | Reconciliation may move `open → acknowledged` but never `acknowledged → open`, and never writes `visibility` | no reconciler |
| I17 | The stored event record has no field capable of holding source content | no record type |
| I18 | An `unavailable` source renders the neutral state and carries no previously hydrated content | no display model |
| I19 | No Inbox read or write path calls `getActiveWorkspace()` | no Inbox path exists at all |
| I20 | `BadgeCount` cannot be constructed as a bare number, and `unavailable` coverage yields no count | no type exists |

---

## 19. Test files, and the one thing they cannot prove

Written this wave, under `src/lib/home-layer/inbox/`:

| File | Assertions |
|---|---|
| `identity.test.ts` | I1–I5 |
| `state.test.ts` | I6–I8, I14–I16 |
| `badge.test.ts` | I9–I11, I20 |
| `snooze.test.ts` | I11–I13 |
| `privacy.test.ts` | I17–I19 |

They run with the repository's TypeScript test convention,
`node --import tsx --test <file>` (`package.json:46`).

**Verified failure at this base.** All five files were executed at `78021c5`:

```
node --import tsx --test src/lib/home-layer/inbox/*.test.ts
→ tests 5 · pass 0 · fail 5
  Error: Cannot find module './snooze'   (and './identity', './state', './badge', './privacy')
  code: 'MODULE_NOT_FOUND'
```

Each file fails on its import, because the module it specifies does not exist. That is the
right reason: there is no event store, no state machine, no badge function, no resurface
resolver and no display model anywhere in this repository. `privacy.test.ts` additionally
carries the tenancy scan (I19) — it asserts that Inbox source modules exist **and** that none
of them reaches for `getActiveWorkspace`, the `tasks_active_ws` cookie, a membership table or
a raw `@libsql/client`. It fails today on the first half of that conjunction.

**They are not wired into CI, and this is deliberate.** `package.json` is foreign-owned for
this programme (the collision list in the lane brief), so the `test` script cannot be edited
here. `scripts/check-journey-coverage.mjs` expands `pretest` + `test` into the set of files CI
actually executes and exists precisely because "on 2026-08-03 seven well-written test files
were executed by nothing" (`audit/D-baseline-release.md:380`). These five files are currently
in that condition. **Wiring them is a lead-owned edit on a merged base, and it is a release
gate for Wave 6, not a chore.** Recorded in §20.

---

## 20. Open, and owned elsewhere

1. **The five missing source event records** (§1) are source-product work in
   `src/server/actions/**` and `src/server/db/**`, colliding with the Project Truth lanes'
   mutation migration. Sequencing is lead-owned. Nothing in Wave 6 can start before it.
2. **`HOME_MUTATIONS_ENABLED` stays default-off** until Home's write path takes an explicit
   `ProjectId` (`PROJECT_SCOPE.md` §9, `R-H11`). So V1 Inbox has no source actions. §9 is
   specified in full anyway, because the affordance must be designed before it is enabled, not
   after.
3. **Founder decisions required before `/app/inbox` may redirect:** is a `nudge` a first-class
   Inbox ask (§3.4)? Does a completion `milestone` belong anywhere in Home (§3.2)? Both have
   live writers and both disappear from the user's Inbox at V1 without an answer.
4. **`InviteEventContract` is unwritten and unowned** (§3.3).
5. **Retention and reconciliation are a second and third scheduled job.** The repository has
   one cron (`vercel.json:3-8`). Adding scheduled work is lead-owned and gated.
6. **The DST calendar helper's new home** (§10.3, D-INBOX-12) crosses a module boundary
   policed by `scripts/check-module-boundaries.mjs`. Lead-owned.
7. **The five test files are not executed by CI** (§19). Lead-owned edit to `package.json` on a
   merged base.
8. **Nothing here is runtime-verified.** Every claim is a static read at `78021c5`, consistent
   with the audits it builds on. No build was run, no database was queried, no request was
   issued.
