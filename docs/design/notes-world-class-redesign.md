# Notes — world-class redesign

Branch `notes/world-class` · worktree `_wt-notes/` · base `origin/main` @ `dbf3b8e`
(T·132 pass 5, the approved Tasks board redesign and the shared black shell).

Baseline screenshots: `docs/design/shots/before/`.
Final screenshots: `docs/design/shots/after/`.
Harness: `node scripts/design/notes-shots.mjs --out=<dir> --base=http://localhost:3510`.

---

## 1. What the audit found

### 1.1 The screen

One route, `/app/notes`, renders a single client component
(`HybridNotebook`, 2,531 lines) inside a grey canvas with a large floating
white card. Four unrelated jobs share that card permanently: capture, a
search band, the note stream, and Sent-to-Tasks history. Sent history holds
the entire right half of the workspace at every width, including when it is
empty, where "Sent to Tasks" is the largest type on the screen.

Copy carries the mechanism rather than the meaning: `PRIVATE NOTEBOOK`,
`CAPTURE`, `FIND IN NOTES`, `HISTORY`, `0 / 10,000`, `Press / to find`,
`Ctrl + Enter saves · Escape asks before discarding`, `7 active`, `3d ago`,
and a permanent `Capture by email / Available on the Workspace plan` upsell
sitting inside the capture instrument. The privacy promise is stated twice,
vaguely, in two different wordings.

At 1024px and below the split collapses and the capture chrome consumes the
whole first screen; the notebook itself starts below the fold.

### 1.2 The data model (`drizzle-notes`, table `notes`)

| Column | Type | Meaning |
|---|---|---|
| `id` | text pk | `n_` + 32 hex, client-minted, idempotency key |
| `user_id` | text | **owner scope — a note belongs to a person, not a workspace** |
| `body` | text | the whole note. No title column |
| `created_at` / `updated_at` | int ms | `updated_at` doubles as the optimistic-concurrency version |
| `extract_body` | text? | the creator-approved wording that became a task |
| `promoted_task_id` | text? | the linked task |
| `archived_at` | int? | legacy promote path only; the modern send never sets it |
| `workspace_id` | text? | projection of the Tasks workspace a send was authorised against |
| `source` | text? | provenance. Was `NULL` or `"calendar"` |

Plus `note_task_send_outbox`, a durable one-row-per-(user, note) reservation
that makes the Notes → Tasks edge exactly-once, and `user_preferences`,
`calendar_connections`, `spawned_calendar_events`.

**Truthful lifecycle.** A note is created active. Editing is a
compare-and-swap on `updated_at`; a mismatch returns both versions rather
than overwriting. Turning it into a task reserves an outbox row, calls
Tasks, then writes `extract_body` + `promoted_task_id` + `workspace_id`
**and explicitly leaves `archived_at` null** — the note stays in the
notebook. Deleting is a hard delete of the row plus its outbox rows.
`archived_at` is only ever set by the legacy `promoteNoteToTasks` path,
which refuses to run while the hybrid notebook is enabled.

**Restore semantics, verified.** `restoreArchivedNoteForHybrid` clears
`archived_at` on the original row and touches nothing else: the linked task,
the approved wording and the workspace projection all stay attached. It
reactivates the original note; it does not make a copy, and it does not undo
the task. The honest label is therefore **"Restore to Notebook"**, with the
task explicitly said to stay.

**Consequence for the IA.** The old right-hand pane was fed by
`listArchivedNotes()`, so it was an *archive* view labelled "Sent to Tasks".
Under the modern flow almost nothing lands there. Sent is redefined as what
it always should have been: **notes that have a linked task**, whether or not
they were also archived. A sent note therefore appears in both Notebook and
Sent, which is exactly what the product already promises in copy — "your note
is still here, still private, still yours to edit."

### 1.3 Privacy, as actually enforced

Every read and write goes through `requireUser()` and is scoped
`WHERE user_id = ?`. There is no sharing path, no workspace read, no
collaborator join on the notes table. The only text that ever leaves is the
wording the owner approves for a task, carried by a single-purpose payload
constructor with a SHA-256 binding. So the one true sentence is:

> **Private to you until you turn a note into a task.**

Everything else moves into an information popover.

### 1.4 Voice, photo, AI — what exists

- Voice today is `window.SpeechRecognition`, text only. No audio touches
  Signal's servers, and Signal cannot retain it. The browser vendor's own
  speech service does receive the audio, which the product already discloses.
- **No** server transcription, **no** OCR, **no** image pipeline for Notes.
- `src/server/ai.ts` exists: Anthropic through the Vercel AI SDK,
  `claude-haiku-4-5-20251001`, keyed on `ANTHROPIC_API_KEY`, with
  `aiConfigured()` returning false and callers degrading rather than
  crashing when the key is absent. `ai@6` exports `jsonSchema()`, so
  structured output needs no new dependency. `@ai-sdk/anthropic@3` already
  encodes image content parts.
- Rate limiting exists (`src/lib/ratelimit.ts`) and fails open until Upstash
  is provisioned.

So voice and photo extraction can be built for real, against infrastructure
that already exists, with one honest gate: when `ANTHROPIC_API_KEY` is not
configured the UI says so and falls back to keeping the words rather than
inventing notes.

### 1.5 Gates a change here must pass

`pnpm typecheck` · `pnpm lint` · `pnpm ds:check` (banned hex, token
redefinition, rogue easing, non-Geist stacks, per-file raw-hex ratchet) ·
`pnpm first-contact:language` (jargon ledger, shrink-only) · `pnpm test`
(includes the chrome, switcher, tap-target, loading and module-boundary
contracts) · `pnpm perf:budgets` (**ceiling is the measured baseline, so net
client JS must not grow**) · `pnpm build`.

Binding details: the loading contract requires `/app/notes` to spell its own
wordmark and carry "Opening the notebook". The tap-target contract bans
`h-11`-style utilities because `--space-11` is 80px here. The motion contract
forbids hover lift, staggers, bounce, full-view slides and looping ambient
motion. `src/ds/tokens.css` is vendored and must not be edited.

---

## 2. The redesign

### 2.1 Information architecture

```
/app/notes                     Notebook   (default)
/app/notes?view=review         Review
/app/notes?view=sent           Sent
/app/notes?note=<id>           selected note, on every view
```

View and selection are held in the URL through the native History API, so
Back works and a note is linkable, without a server round trip per click.

- **Notebook** — capture, toolbar, list, selected note. The working surface.
- **Review** — one note at a time. Keep in Notes · Turn into task · Delete.
- **Sent** — the notes that became tasks, with the task and the date.

Counts are shown only when they are non-zero and true: `Notebook 10`,
`Review 4`, `Sent 3`.

### 2.2 Surface

The grey canvas, the outer rounded card and its shadow are deleted. Notes
renders full-bleed white into the module `<main>` the shell already provides.
Structure comes from hairlines and space. One compact local header carries
the three views on the left, and the privacy indicator plus an overflow menu
on the right. The duplicate `Notes.` title goes; the black shell's wordmark
already names the product.

### 2.3 Capture

One composer with three modes — **Type**, **Voice**, **Photo** — sharing a
single footer: mode controls and the privacy indicator on the left, `Save
note` with its shortcut keycap on the right. Compact when empty, growing with
content. The character count appears only past 80% of the limit. Email
capture moves to the overflow menu. The keyboard instruction sentence becomes
a keycap and a tooltip.

Voice records, then processes, then presents **editable extracted notes** —
never a raw transcript as the result. Photo does the same from an image.
Both keep the source until the notes are saved, and both survive a failure
with the source intact.

### 2.4 Review needs one new column

Keeping a note in Notes is a decision that has to persist, and nothing in the
model could record it. `notes.reviewed_at` (integer, nullable) is added, with
`notes_user_reviewed_idx`. Every existing row reads as "not yet reviewed",
which is true. Migration: `drizzle-notes/0001_notes_reviewed_at.sql`.

### 2.5 Source becomes real

`notes.source` gains `"typed" | "voice" | "photo" | "email"` beside the
existing `"calendar"`. `NULL` keeps meaning typed, so no backfill is needed.

---

## 3. Acceptance checklist

Product
- [ ] No grey canvas, no outer rounded container, no page shadow
- [ ] Notebook / Review / Sent are distinct and route-backed
- [ ] Sent never occupies half of the Notebook workspace
- [ ] Capture is one instrument; Type, Voice and Photo are peers
- [ ] Voice and photo produce editable notes, not transcripts or raw OCR
- [ ] Privacy stated once, truthfully, with detail in a popover
- [ ] Email capture and the character count leave the resting composer
- [ ] `Turn into task` is the primary promotion action, duplicate-safe
- [ ] Restore wording matches what the code does
- [ ] Friendly dates, real previews, source icons in the list

Engineering
- [ ] No content lost on save, processing or conversion failure
- [ ] Desktop selects sensibly; mobile never auto-opens a note
- [ ] WCAG AA contrast, semantic tabs, live regions, reduced motion
- [ ] 1920 / 1600 / 1440 / 1280 / 1024 / 768 / 390 all correct
- [ ] typecheck, lint, ds:check, first-contact, test, perf:budgets, build
- [ ] Console clean in the browser

---

## 4. Decisions taken

1. **One design system.** Notes uses the vendored DS semantic tokens
   directly and the shared `--x-lead-*` leading scale, not a parallel
   `--x-notes-*` palette. New values only where none exists.
2. **Open task links to `/app/task/[id]`**, the approved Tasks focus
   experience, rather than a Notes-local rendering of a task.
3. **Sent is defined by the linked task, not by the archive flag**, because
   that is what the modern send actually writes.
4. **Review state is persisted**, not derived, because a derived queue would
   either never empty or lie about what has been decided.
5. **AI extraction degrades honestly.** Without a key, voice keeps the words
   as one note and says so; photo is gated and says so. Nothing is fabricated.
