import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countLabel,
  countViews,
  defaultSelection,
  derivePresentation,
  deriveTaskTitle,
  friendlyDate,
  inNotebook,
  isArchived,
  isSent,
  MAX_TASK_TITLE_CHARS,
  matchesFilter,
  matchesQuery,
  needsReview,
  noteSource,
  notesHref,
  searchSnippet,
  sortNotes,
  viewFromParam,
  type PresentableNote,
} from "./notes-view-model";

/**
 * Guards for the Notes view model: the rules that turn a stored row into
 * what a person reads — which view a note belongs to, what its row says,
 * how old it looks, and what the header counts mean. Every assertion here
 * is something a reviewer could point at on screen.
 */

function note(overrides: Partial<PresentableNote> = {}): PresentableNote {
  return {
    id: "n_1",
    body: "Body text",
    createdAt: 1,
    updatedAt: 1,
    extractBody: null,
    promotedTaskId: null,
    archivedAt: null,
    reviewedAt: null,
    source: null,
    workspaceId: null,
    ...overrides,
  };
}

test("noteSource reads a missing or blank source as typed", () => {
  assert.equal(noteSource(null), "typed");
  assert.equal(noteSource(undefined), "typed");
  assert.equal(noteSource(""), "typed");
});

test("noteSource passes the known capture routes through unchanged", () => {
  assert.equal(noteSource("voice"), "voice");
  assert.equal(noteSource("photo"), "photo");
  assert.equal(noteSource("email"), "email");
  assert.equal(noteSource("calendar"), "calendar");
});

test("noteSource treats anything it does not recognise as typed", () => {
  assert.equal(noteSource("fax"), "typed");
});

test("derivePresentation: a multi-line body takes the first line as the title and collapses the rest into the preview", () => {
  const body = "Meeting notes\nBring the cake   stand\n  Confirm florist time  ";
  assert.deepEqual(derivePresentation(body), {
    title: "Meeting notes",
    preview: "Bring the cake stand Confirm florist time",
  });
});

test("derivePresentation: a single long line with a sentence boundary splits at the first full stop", () => {
  const body =
    "Call the florist about the pink arrangement. Confirm the cake stand and choose the final menu before Friday.";
  assert.deepEqual(derivePresentation(body), {
    title: "Call the florist about the pink arrangement.",
    preview: "Confirm the cake stand and choose the final menu before Friday.",
  });
});

test("derivePresentation: a single short line stays whole with an empty preview", () => {
  assert.deepEqual(derivePresentation("Buy milk"), { title: "Buy milk", preview: "" });
});

test("derivePresentation: a body of only whitespace is Untitled note", () => {
  assert.deepEqual(derivePresentation("   \n\t \n  "), { title: "Untitled note", preview: "" });
});

test("derivePresentation: a title beyond 96 characters is truncated to a single ellipsis and never exceeds 96 characters", () => {
  const { title } = derivePresentation("x".repeat(150));
  assert.equal(title, `${"x".repeat(95)}…`);
  assert.equal(title.length, 96);
});

test("derivePresentation: leading blank lines are skipped", () => {
  assert.deepEqual(derivePresentation("\n\n  \nActual title\nSecond line"), {
    title: "Actual title",
    preview: "Second line",
  });
});

// Fixed reference instant: 2026-08-05T11:00:00Z is 12:00 in Dublin, which
// is on British Summer Time (UTC+1) in August.
const NOW = Date.parse("2026-08-05T11:00:00.000Z");

test("friendlyDate: under a minute, or a future timestamp, reads Just now", () => {
  assert.equal(friendlyDate(NOW - 30_000, NOW, "Europe/Dublin"), "Just now");
  assert.equal(friendlyDate(NOW + 1_000, NOW, "Europe/Dublin"), "Just now");
});

test("friendlyDate: minutes read as 1 minute ago / N minutes ago", () => {
  assert.equal(friendlyDate(NOW - 60_000, NOW, "Europe/Dublin"), "1 minute ago");
  assert.equal(friendlyDate(NOW - 12 * 60_000, NOW, "Europe/Dublin"), "12 minutes ago");
});

test("friendlyDate: the same calendar day reads in hours", () => {
  assert.equal(friendlyDate(NOW - 3 * 60 * 60_000, NOW, "Europe/Dublin"), "3 hours ago");
  assert.equal(friendlyDate(NOW - 1 * 60 * 60_000, NOW, "Europe/Dublin"), "1 hour ago");
});

test("friendlyDate: the previous calendar day reads Yesterday", () => {
  assert.equal(friendlyDate(NOW - 20 * 60 * 60_000, NOW, "Europe/Dublin"), "Yesterday");
});

test("friendlyDate: the calendar-day rule beats the elapsed-time rule across midnight", () => {
  // Dublin midnight opening 2026-08-05 (BST, UTC+1) is 2026-08-04T23:00:00Z.
  const dublinMidnight = Date.parse("2026-08-04T23:00:00.000Z");
  const justAfterMidnight = dublinMidnight + 10 * 60_000; // 00:10 local, today
  const justBeforeMidnight = dublinMidnight - 10 * 60_000; // 23:50 local, the day before
  // Only 20 minutes elapsed — well inside the window that would otherwise
  // read as "N minutes ago" — but the note was written on the previous
  // calendar day, so a person reads it as Yesterday, not "20 minutes ago".
  assert.equal(justAfterMidnight - justBeforeMidnight, 20 * 60_000);
  assert.equal(friendlyDate(justBeforeMidnight, justAfterMidnight, "Europe/Dublin"), "Yesterday");
});

test("friendlyDate: three calendar days back reads as days", () => {
  assert.equal(friendlyDate(NOW - 3 * 24 * 60 * 60_000, NOW, "Europe/Dublin"), "3 days ago");
});

test("friendlyDate: beyond a week in the same year reads as a day and short month, with no year", () => {
  assert.equal(friendlyDate(NOW - 10 * 24 * 60 * 60_000, NOW, "Europe/Dublin"), "26 Jul");
});

test("friendlyDate: a previous year carries the year", () => {
  assert.equal(
    friendlyDate(Date.parse("2025-01-15T11:00:00.000Z"), NOW, "Europe/Dublin"),
    "15 Jan 2025",
  );
});

test("isSent, needsReview, and inNotebook read a sent note correctly", () => {
  const sent = note({ id: "n_sent", promotedTaskId: "t_1", reviewedAt: null });
  assert.equal(isSent(sent), true);
  // Sent is a decision in itself, so it never queues for review, even
  // though reviewedAt was never set.
  assert.equal(needsReview(sent), false);
  assert.equal(inNotebook(sent), true);
});

test("an archived note never needs review and is not in the notebook", () => {
  const archived = note({ id: "n_arch", archivedAt: 5 });
  assert.equal(isArchived(archived), true);
  assert.equal(needsReview(archived), false);
  assert.equal(inNotebook(archived), false);
});

test("a plain note with reviewedAt null needs review", () => {
  assert.equal(needsReview(note({ id: "n_plain" })), true);
});

test("setting reviewedAt removes a note from review but keeps it in the notebook", () => {
  const reviewed = note({ id: "n_reviewed", reviewedAt: 10 });
  assert.equal(needsReview(reviewed), false);
  assert.equal(inNotebook(reviewed), true);
});

test("countViews counts a mixed array into notebook, review, and sent", () => {
  const notes = [
    note({ id: "n_sent", promotedTaskId: "t_1" }),
    note({ id: "n_arch", archivedAt: 5 }),
    note({ id: "n_plain" }),
    note({ id: "n_reviewed", reviewedAt: 10 }),
  ];
  assert.deepEqual(countViews(notes), { notebook: 3, review: 1, sent: 1 });
});

test("countLabel reads a count into the label for its view", () => {
  assert.equal(countLabel("notebook", 1), "1 note");
  assert.equal(countLabel("notebook", 10), "10 notes");
  assert.equal(countLabel("review", 4), "4 to review");
  assert.equal(countLabel("sent", 1), "1 sent");
  assert.equal(countLabel("sent", 3), "3 sent");
});

test("sortNotes orders newest-first and oldest-first", () => {
  const notes = [
    note({ id: "n_old", createdAt: 100 }),
    note({ id: "n_new", createdAt: 300 }),
    note({ id: "n_mid", createdAt: 200 }),
  ];
  assert.deepEqual(sortNotes(notes, "newest").map((n) => n.id), ["n_new", "n_mid", "n_old"]);
  assert.deepEqual(sortNotes(notes, "oldest").map((n) => n.id), ["n_old", "n_mid", "n_new"]);
});

test("sortNotes breaks a tied createdAt by id, stably across repeated calls", () => {
  const tied = [
    note({ id: "n_b", createdAt: 100 }),
    note({ id: "n_a", createdAt: 100 }),
    note({ id: "n_c", createdAt: 100 }),
  ];
  const first = sortNotes(tied, "newest");
  const second = sortNotes(tied, "newest");
  assert.deepEqual(
    first.map((n) => n.id),
    ["n_a", "n_b", "n_c"],
  );
  assert.deepEqual(
    second.map((n) => n.id),
    first.map((n) => n.id),
  );
});

test("matchesFilter narrows by capture source", () => {
  const voice = note({ id: "n_voice", source: "voice" });
  assert.equal(matchesFilter(voice, "typed"), false);
  assert.equal(matchesFilter(voice, "voice"), true);
  assert.equal(matchesFilter(voice, "photo"), false);
  assert.equal(matchesFilter(voice, "all"), true);
});

test("matchesFilter's review filter matches only notes that need review", () => {
  assert.equal(matchesFilter(note({ id: "n_plain" }), "review"), true);
  assert.equal(matchesFilter(note({ id: "n_reviewed", reviewedAt: 10 }), "review"), false);
});

test("matchesQuery matches the note body", () => {
  const withBody = note({ body: "Call the florist about lilies" });
  assert.equal(matchesQuery(withBody, "florist"), true);
  assert.equal(matchesQuery(withBody, "unrelated"), false);
});

test("matchesQuery also matches wording that survives only in extractBody", () => {
  const extracted = note({ body: "Nothing relevant here", extractBody: "Call the florist about lilies" });
  assert.equal(matchesQuery(extracted, "lilies"), true);
});

test("matchesQuery folds accents, so a query for cafe matches café", () => {
  assert.equal(matchesQuery(note({ body: "Meet at the café tomorrow" }), "cafe"), true);
});

test("matchesQuery with an empty query matches everything", () => {
  assert.equal(matchesQuery(note({ body: "anything at all" }), ""), true);
});

test("searchSnippet returns a snippet around a match deep inside a long body, with leading and trailing ellipses", () => {
  const body =
    "Intro filler words here to pad things out before the actual point. " +
    "The important detail about the florist is buried deep in this note. " +
    "More trailing text after the match to pad the rest of the body out further and further.";
  const snippet = searchSnippet(body, "florist");
  assert.ok(snippet.startsWith("…"), `expected a leading ellipsis, got: ${snippet}`);
  assert.ok(snippet.endsWith("…"), `expected a trailing ellipsis, got: ${snippet}`);
  assert.ok(snippet.toLowerCase().includes("florist"));
});

test("searchSnippet with no query returns the preview", () => {
  const body = "Intro filler words here to pad things out before the actual point.";
  assert.equal(searchSnippet(body, ""), derivePresentation(body).preview.slice(0, 200));
});

test("defaultSelection: a valid routeNoteId wins", () => {
  const notes = [note({ id: "n_1" }), note({ id: "n_2" }), note({ id: "n_3" })];
  assert.equal(defaultSelection(notes, "n_2", false), "n_2");
});

test("defaultSelection: an unknown routeNoteId falls through to the newest note", () => {
  const notes = [note({ id: "n_1" }), note({ id: "n_2" }), note({ id: "n_3" })];
  assert.equal(defaultSelection(notes, "n_missing", false), "n_1");
});

test("defaultSelection: narrow returns null when there is no route id", () => {
  const notes = [note({ id: "n_1" }), note({ id: "n_2" }), note({ id: "n_3" })];
  assert.equal(defaultSelection(notes, null, true), null);
});

test("defaultSelection: wide returns the first note when there is no route id", () => {
  const notes = [note({ id: "n_1" }), note({ id: "n_2" }), note({ id: "n_3" })];
  assert.equal(defaultSelection(notes, null, false), "n_1");
});

test("defaultSelection: an empty list returns null", () => {
  assert.equal(defaultSelection([], null, false), null);
});

test("viewFromParam reads notebook, review, and sent, and treats anything else as notebook", () => {
  assert.equal(viewFromParam("notebook"), "notebook");
  assert.equal(viewFromParam("review"), "review");
  assert.equal(viewFromParam("sent"), "sent");
  assert.equal(viewFromParam("bogus"), "notebook");
  assert.equal(viewFromParam(null), "notebook");
  assert.equal(viewFromParam(undefined), "notebook");
});

test("notesHref builds the notebook, review, and sent URLs", () => {
  assert.equal(notesHref("notebook", null), "/app/notes");
  assert.equal(notesHref("review", "n_x"), "/app/notes?view=review&note=n_x");
  assert.equal(notesHref("sent", null), "/app/notes?view=sent");
});

test("deriveTaskTitle strips a trailing full stop and takes only the first sentence", () => {
  assert.equal(deriveTaskTitle("Call the florist."), "Call the florist");
  assert.equal(deriveTaskTitle("Buy milk. Buy bread."), "Buy milk");
});

test("deriveTaskTitle returns an empty string for an untitled note", () => {
  assert.equal(deriveTaskTitle("   \n  "), "");
});

test("deriveTaskTitle never exceeds MAX_TASK_TITLE_CHARS", () => {
  const title = deriveTaskTitle("x".repeat(400));
  assert.ok(title.length <= MAX_TASK_TITLE_CHARS);
});
