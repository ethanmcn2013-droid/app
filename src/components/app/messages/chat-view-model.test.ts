import assert from "node:assert/strict";
import test from "node:test";
import { activeMentionQuery, dayLabel, groupMessages, initialsOf, listTimeLabel, mentionCandidates, mentionsPerson, previewText, timeLabel, tokenizeBody, type ChatMessage, type ChatPerson } from "./chat-view-model";

const clock = { nowMs: Date.parse("2026-07-16T08:00:00Z"), timeZone: "Europe/Dublin", locale: "en-GB" };
const people: ChatPerson[] = [
  { id: "orla", name: "Orla" },
  { id: "niamh", name: "Niamh Kelly" },
  { id: "dara", name: "Dara Quinn" },
  { id: "dara-2", name: "Dara Byrne" },
];
const at = (iso: string) => Date.parse(iso);
const message = (id: string, authorId: string | null, iso: string, extra: Partial<ChatMessage> = {}): ChatMessage =>
  ({ id, authorId, body: `Message ${id}`, createdAt: at(iso), ...extra });

test("days are labelled in the clock's zone, not the server's", () => {
  // 23:30 UTC on the 15th is 00:30 on the 16th in Dublin summer time.
  assert.equal(dayLabel(at("2026-07-15T23:30:00Z"), clock), "Today");
  assert.equal(dayLabel(at("2026-07-15T12:00:00Z"), clock), "Yesterday");
  assert.equal(dayLabel(at("2026-07-13T12:00:00Z"), clock), "Monday 13 July");
  assert.equal(dayLabel(at("2025-12-24T12:00:00Z"), clock), "Wednesday 24 December 2025");
  assert.equal(timeLabel(at("2026-07-16T07:52:00Z"), clock), "08:52");
});

test("list recency is compact", () => {
  assert.equal(listTimeLabel(at("2026-07-16T07:47:00Z"), clock), "08:47");
  assert.equal(listTimeLabel(at("2026-07-15T16:00:00Z"), clock), "Yesterday");
  assert.equal(listTimeLabel(at("2026-07-13T12:00:00Z"), clock), "Mon");
  assert.equal(listTimeLabel(at("2026-07-01T12:00:00Z"), clock), "1 Jul");
});

test("messages group by day, then by author within five minutes", () => {
  const sections = groupMessages([
    message("a", "niamh", "2026-07-15T15:02:00Z"),
    message("b", "niamh", "2026-07-15T15:04:00Z"),
    message("c", "niamh", "2026-07-15T15:20:00Z"),
    message("d", "orla", "2026-07-15T15:21:00Z"),
    message("e", "orla", "2026-07-16T07:00:00Z"),
  ], clock);
  assert.deepEqual(sections.map((section) => section.label), ["Yesterday", "Today"]);
  assert.deepEqual(sections[0].runs.map((run) => run.messages.map((item) => item.id)), [["a", "b"], ["c"], ["d"]]);
  assert.deepEqual(sections[1].runs.map((run) => run.key), ["e"]);
});

test("a removed message, a thread root or a task link always ends a run", () => {
  const sections = groupMessages([
    message("a", "dara", "2026-07-16T06:00:00Z", { replyCount: 2 }),
    message("b", "dara", "2026-07-16T06:01:00Z"),
    message("c", "dara", "2026-07-16T06:02:00Z", { body: null }),
    message("d", "dara", "2026-07-16T06:03:00Z"),
    message("e", null, "2026-07-16T06:03:30Z"),
    message("f", null, "2026-07-16T06:03:40Z"),
  ], clock);
  assert.deepEqual(sections[0].runs.map((run) => run.messages.length), [1, 1, 1, 1, 1, 1]);
});

test("mentions resolve full names first and unique first names only", () => {
  const segments = tokenizeBody("@Orla and @Niamh, see @Niamh Kelly. @Dara is ambiguous. email@Orla stays text.", people, "orla");
  const mentions = segments.filter((segment) => segment.kind === "mention");
  assert.deepEqual(mentions.map((segment) => segment.text), ["@Orla", "@Niamh", "@Niamh Kelly"]);
  assert.equal(mentions[0].kind === "mention" && mentions[0].self, true);
  assert.equal(segments.map((segment) => segment.text).join(""), "@Orla and @Niamh, see @Niamh Kelly. @Dara is ambiguous. email@Orla stays text.");
  assert.equal(mentionsPerson("Morning @Orla", people, "orla"), true);
  assert.equal(mentionsPerson("Morning Orla", people, "orla"), false);
});

test("only http and https become links, without trailing punctuation", () => {
  const segments = tokenizeBody("Forecast: https://www.met.ie/forecasts. Not javascript:alert(1) or ftp://x.", people, null);
  const links = segments.filter((segment) => segment.kind === "link");
  assert.deepEqual(links.map((segment) => segment.kind === "link" && segment.href), ["https://www.met.ie/forecasts"]);
  assert.equal(segments.map((segment) => segment.text).join(""), "Forecast: https://www.met.ie/forecasts. Not javascript:alert(1) or ftp://x.");
});

test("the typeahead finds the @query before the caret", () => {
  assert.deepEqual(activeMentionQuery("Thanks @Nia", 11), { start: 7, query: "Nia" });
  assert.deepEqual(activeMentionQuery("@", 1), { start: 0, query: "" });
  assert.equal(activeMentionQuery("email@Nia", 9), null);
  assert.equal(activeMentionQuery("@Niamh Kelly done", 17), null);
  assert.deepEqual(mentionCandidates(people, "ke", "orla").map((person) => person.id), ["niamh"]);
  assert.deepEqual(mentionCandidates(people, "", "orla").map((person) => person.id), ["niamh", "dara", "dara-2"]);
});

test("previews name the author plainly", () => {
  assert.equal(previewText(message("a", "orla", "2026-07-16T06:00:00Z"), people, "orla"), "You: Message a");
  assert.equal(previewText(message("a", "niamh", "2026-07-16T06:00:00Z", { body: "Two\nlines" }), people, "orla"), "Niamh: Two lines");
  assert.equal(previewText(message("a", "niamh", "2026-07-16T06:00:00Z", { body: null }), people, "orla"), "Message removed");
  assert.equal(initialsOf("Niamh Kelly"), "NK");
  assert.equal(initialsOf("Orla"), "OR");
});
