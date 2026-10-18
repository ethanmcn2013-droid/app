import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAudienceTimelineDto, type AudienceTimelineDto } from "../../lib/audience-timeline";
import { master3ConfirmationSubject } from "../../lib/master3-labels";
import { master3FollowCopy, master3FollowEmailError } from "./master3-follow-copy";

const item = (publicId: string, date: string, presentation = {}, state = "later") => ({ publicId, title: `Public ${publicId}`, date, state, presentation });
const dto = (changes: Record<string, unknown> = {}): AudienceTimelineDto => validateAudienceTimelineDto({
  version: 1, audienceKind: "couple", publicationId: "synthetic-follow-copy", label: "Private project label",
  ownerDisplayLabel: "Shared by Alex & Sam", today: "2026-10-12", lastUpdatedAt: "2026-10-10T12:00:00Z",
  sections: [{ state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true })] }], ...changes,
});

test("confirmation subject matches the actual sender helper, including explicit owner override", () => {
  for (const timeline of [dto(), dto({ presentation: { subject: "Confirm these public updates" } })]) {
    assert.equal(master3FollowCopy(timeline).confirmationSubject, master3ConfirmationSubject(timeline));
  }
  assert.equal(master3FollowCopy(dto()).confirmationSubject, "Confirm your updates from Alex & Sam");
});

test("no dates invites the first date announcement without inventing a reminder date", () => {
  const copy = master3FollowCopy(dto({ sections: [] }));
  assert.equal(copy.offer, "updates");
  assert.equal(copy.invitation, "Get an email when Alex & Sam add the dates.");
  assert.equal(copy.nextEmail, "Next email: when Alex & Sam add the dates.");
  assert.doesNotMatch(copy.nextEmail, /2026|month|week|day before/);
});

test("the next email uses chronological remaining reminders rather than an expired For you promise", () => {
  const copy = master3FollowCopy(dto({ sections: [{ state: "later", label: "Dates", items: [
    item("expired-reminder", "2026-10-18", { forYou: true }), item("final", "2026-11-20", { final: true }),
  ] }] }));
  assert.equal(copy.nextEmail, "Next email: One month to go, Wed 21 Oct.");
  assert.equal(copy.invitation, "Get an email when there’s news.");
  assert.doesNotMatch(copy.nextEmail, /expired-reminder/);
});

test("a remaining For you reminder is named and a covered one is not promised", () => {
  const pending = master3FollowCopy(dto({ sections: [{ state: "later", label: "Dates", items: [
    item("reply", "2026-10-22", { forYou: true }), item("final", "2026-11-20", { final: true }),
  ] }] }));
  assert.match(pending.invitation, /anything you need to do/);
  assert.equal(pending.nextEmail, "Next email: Public reply reminder, Thu 15 Oct.");
  const covered = master3FollowCopy(dto({ sections: [
    { state: "covered", label: "Done", items: [item("reply", "2026-10-22", { forYou: true }, "covered")] },
    { state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true })] },
  ] }));
  assert.doesNotMatch(covered.invitation, /anything you need to do/);
  assert.equal(covered.nextEmail, "Next email: One month to go, Wed 21 Oct.");
});

test("photo opt-in is specific and appears only after the actual wedding date", () => {
  const before = master3FollowCopy(dto({ presentation: { afterFollow: true } }));
  assert.equal(before.offer, "updates"); assert.equal(before.buttonLabel, "Follow");
  assert.doesNotMatch(before.invitation, /photos/);
  const onDay = master3FollowCopy(dto({ today: "2026-11-20", presentation: { afterFollow: true } }));
  assert.notEqual(onDay.offer, "photos");
  const after = master3FollowCopy(dto({ today: "2026-11-21", presentation: { afterFollow: true } }));
  assert.equal(after.offer, "photos"); assert.equal(after.buttonLabel, "Email me the photos");
  assert.equal(after.invitation, "Get one email when Alex & Sam add the photos. Nothing else after that.");
  assert.equal(after.nextEmail, "Next email: when the photos are up.");
});

test("an existing album closes the photo invitation without claiming a message was sent", () => {
  const copy = master3FollowCopy(dto({ today: "2026-11-21", presentation: { afterFollow: true, photosUrl: "https://example.invalid/album" } }));
  assert.equal(copy.offer, null); assert.equal(copy.nextEmail, "No more emails are scheduled.");
  assert.doesNotMatch(copy.closedText ?? "", /sent|delivered|gone out/);
});

test("post-wedding For you dates never reopen ordinary updates or invent a later scheduled email", () => {
  for (const afterFollow of [false, true]) {
    const copy = master3FollowCopy(dto({ today: "2026-11-21", presentation: { afterFollow }, sections: [
      { state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true }), item("later-reply", "2026-12-20", { forYou: true })] },
    ] }));
    assert.equal(copy.offer, afterFollow ? "photos" : null);
    assert.equal(copy.nextEmail, afterFollow ? "Next email: when the photos are up." : "No more emails are scheduled.");
  }
});

test("school post-final dates stay open but a passed seven-day reminder is not promised", () => {
  const timeline = dto({ audienceKind: "class", label: "Public school year", today: "2026-11-21", presentation: { market: "school" }, sections: [
    { state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true }), item("trip", "2026-11-25")] },
  ] });
  const copy = master3FollowCopy(timeline);
  assert.equal(copy.offer, "updates"); assert.equal(copy.invitation, "Get an email when the remaining dates change.");
  assert.equal(copy.nextEmail, "No more emails are scheduled.");
});

test("launch post-final reminders name only the actual public next event", () => {
  const copy = master3FollowCopy(dto({ audienceKind: "module", label: "Public opening", today: "2026-11-21", presentation: { market: "launch" }, sections: [
    { state: "later", label: "Dates", items: [item("final", "2026-11-20", { final: true }), item("visit", "2026-12-05")] },
  ] }));
  assert.equal(copy.offer, "updates"); assert.equal(copy.invitation, "Get a reminder before Public visit.");
  assert.equal(copy.nextEmail, "Next email: Public visit reminder, Sat 28 Nov.");
});

test("during-exam mode has no follow invitation, and explicit pitch is retained once for an open offer", () => {
  const during = master3FollowCopy(dto({ audienceKind: "class", today: "2026-11-21", presentation: { market: "school", during: { days: 21, word: "Now" } } }));
  assert.equal(during.offer, null); assert.equal(during.closedText, null);
  const copy = master3FollowCopy(dto({ presentation: { pitch: "Hear about this public event." } }));
  assert.equal(copy.invitation, "Hear about this public event.");
});

test("email validation gives a specific empty error and rejects server-invalid shapes", () => {
  assert.equal(master3FollowEmailError("  "), "Enter your email address.");
  for (const value of ["person", "person@example", "a@b@c.invalid", "a<@example.invalid", "a\n@example.invalid", "a".repeat(255) + "@example.invalid"]) {
    assert.equal(master3FollowEmailError(value), "Enter a valid email address.");
  }
  assert.equal(master3FollowEmailError(" Person+test@example.invalid "), null);
});
