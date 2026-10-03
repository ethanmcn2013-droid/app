import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuickDate } from "./quick-date";

// Review's pinned clock: Thursday 16 July 2026.
const TODAY = "2026-07-16";

test("a trailing day and month becomes the date, and leaves the title", () => {
  assert.deepEqual(parseQuickDate("Florist 12 Nov", TODAY), { title: "Florist", date: "2026-11-12" });
  assert.deepEqual(parseQuickDate("Florist 12 November", TODAY), { title: "Florist", date: "2026-11-12" });
  assert.deepEqual(parseQuickDate("Florist 12th nov", TODAY), { title: "Florist", date: "2026-11-12" });
  assert.deepEqual(parseQuickDate("Final fitting on 4 Sept", TODAY), { title: "Final fitting", date: "2026-09-04" });
  assert.deepEqual(parseQuickDate("Deposit, 3 Mar 2027", TODAY), { title: "Deposit", date: "2027-03-03" });
});

test("a day that has passed this year means next year's", () => {
  assert.deepEqual(parseQuickDate("Save the dates 20 May", TODAY), { title: "Save the dates", date: "2027-05-20" });
  // Today itself is still this year's.
  assert.deepEqual(parseQuickDate("Tasting 16 Jul", TODAY), { title: "Tasting", date: "2026-07-16" });
});

test("today, tomorrow and weekdays count from the given day", () => {
  assert.deepEqual(parseQuickDate("Call the venue today", TODAY), { title: "Call the venue", date: "2026-07-16" });
  assert.deepEqual(parseQuickDate("Call the venue tomorrow", TODAY), { title: "Call the venue", date: "2026-07-17" });
  assert.deepEqual(parseQuickDate("Menu tasting Friday", TODAY), { title: "Menu tasting", date: "2026-07-17" });
  assert.deepEqual(parseQuickDate("Menu tasting next fri", TODAY), { title: "Menu tasting", date: "2026-07-17" });
  // The same weekday as today means a week away, never today.
  assert.deepEqual(parseQuickDate("Stand-up thursday", TODAY), { title: "Stand-up", date: "2026-07-23" });
  assert.deepEqual(parseQuickDate("Rehearsal on Mon", TODAY), { title: "Rehearsal", date: "2026-07-20" });
});

test("nothing is guessed: no phrase, an impossible day or an empty title keep the text", () => {
  assert.deepEqual(parseQuickDate("Book the band", TODAY), { title: "Book the band", date: null });
  assert.deepEqual(parseQuickDate("Year 9 trip 2", TODAY), { title: "Year 9 trip 2", date: null });
  assert.deepEqual(parseQuickDate("Deadline 31 Feb", TODAY), { title: "Deadline 31 Feb", date: null });
  assert.deepEqual(parseQuickDate("12 Nov", TODAY), { title: "12 Nov", date: null });
  assert.deepEqual(parseQuickDate("Friday", TODAY), { title: "Friday", date: null });
  // A month word inside the title is not a date phrase.
  assert.deepEqual(parseQuickDate("May ball tickets", TODAY), { title: "May ball tickets", date: null });
  assert.deepEqual(parseQuickDate("   ", TODAY), { title: "", date: null });
});

test("29 February waits for a year that has one", () => {
  assert.deepEqual(parseQuickDate("Leap party 29 Feb", TODAY), { title: "Leap party", date: "2028-02-29" });
});

test("it is deterministic: the same text and day always give the same answer", () => {
  const a = parseQuickDate("Florist  12 Nov ", TODAY);
  const b = parseQuickDate("Florist 12 Nov", TODAY);
  assert.deepEqual(a, b);
});
