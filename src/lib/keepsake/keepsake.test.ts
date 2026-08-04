import assert from "node:assert/strict";
import test from "node:test";

import {
  GRACE_DAYS_AFTER_WEDDING,
  PLANNING_DAYS_FROM_REDEMPTION,
  isPermittedInKeepsake,
  keepsakeCopy,
  resolveCoupleAccess,
} from "./lifecycle";
import { buildKeepsakeExport, findExternalReferences } from "./export";

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (value: string) => new Date(value);
const longDate = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(date);

// ── the access term (D-022) ───────────────────────────────────────────

test("the term is the ratified max(), not a flat eighteen months", () => {
  assert.equal(PLANNING_DAYS_FROM_REDEMPTION, 548);
  assert.equal(GRACE_DAYS_AFTER_WEDDING, 90);

  // Short lead: redemption + 548 wins, because the wedding is close.
  const near = resolveCoupleAccess({
    now: iso("2026-08-03T09:00:00Z"),
    redeemedAt: iso("2026-08-01T00:00:00Z"),
    weddingDate: "2027-05-15",
  });
  assert.equal(near.basis, "redemption");
  assert.equal(
    near.endsAt.toISOString(),
    new Date(iso("2026-08-01T00:00:00Z").getTime() + 548 * DAY_MS).toISOString(),
  );
});

test("the long-lead booking that D-022 exists to fix does not lose access before the wedding", () => {
  // R-015's exact case: books March 2027, marries September 2028, redeems on
  // the day they sign. A flat 548 days would end access in September 2028,
  // right on top of the wedding.
  const redeemedAt = iso("2027-03-10T00:00:00Z");
  const flat548 = new Date(redeemedAt.getTime() + 548 * DAY_MS);

  const access = resolveCoupleAccess({
    now: iso("2027-03-11T00:00:00Z"),
    redeemedAt,
    weddingDate: "2028-09-16",
  });

  assert.equal(access.basis, "wedding-date");
  assert.ok(access.endsAt.getTime() > flat548.getTime());
  // Three months past the day, to the end of the wedding day itself.
  assert.equal(access.endsAt.toISOString(), "2028-12-15T23:59:59.999Z");
  assert.equal(access.phase, "planning");
  assert.equal(access.editable, true);
});

test("a couple is not 'after the day' on the morning of their wedding", () => {
  const morning = resolveCoupleAccess({
    now: iso("2027-06-12T08:00:00Z"),
    redeemedAt: iso("2026-06-01T00:00:00Z"),
    weddingDate: "2027-06-12",
  });
  assert.equal(morning.phase, "planning");

  const nextMorning = resolveCoupleAccess({
    now: iso("2027-06-13T08:00:00Z"),
    redeemedAt: iso("2026-06-01T00:00:00Z"),
    weddingDate: "2027-06-12",
  });
  assert.equal(nextMorning.phase, "after-the-day");
  assert.equal(nextMorning.editable, true);
});

test("a postponement extends access and a correction never shortens it", () => {
  const redeemedAt = iso("2026-01-05T00:00:00Z");
  const first = resolveCoupleAccess({
    now: iso("2026-02-01T00:00:00Z"),
    redeemedAt,
    weddingDate: "2027-08-20",
  });

  // Postponed by a year: access must move later automatically.
  const postponed = resolveCoupleAccess({
    now: iso("2026-02-01T00:00:00Z"),
    redeemedAt,
    weddingDate: "2028-08-20",
    previouslyEndsAt: first.endsAt,
  });
  assert.ok(postponed.endsAt.getTime() > first.endsAt.getTime());
  assert.equal(postponed.basis, "wedding-date");

  // Brought forward again: the term already granted is held open.
  const broughtForward = resolveCoupleAccess({
    now: iso("2026-02-01T00:00:00Z"),
    redeemedAt,
    weddingDate: "2027-08-20",
    previouslyEndsAt: postponed.endsAt,
  });
  assert.equal(broughtForward.endsAt.getTime(), postponed.endsAt.getTime());
  assert.equal(broughtForward.basis, "held-open");
});

test("an unknown wedding date falls back to 548 days and says so", () => {
  const access = resolveCoupleAccess({
    now: iso("2026-08-03T00:00:00Z"),
    redeemedAt: iso("2026-08-01T00:00:00Z"),
    weddingDate: null,
  });
  assert.equal(access.basis, "wedding-date-unknown");
  assert.equal(access.daysRemaining, 546);

  const copy = keepsakeCopy(access, longDate);
  assert.match(copy.body, /Tell us your wedding date/);
});

// ── Keepsake itself ───────────────────────────────────────────────────

test("the term ending produces Keepsake, not a lockout", () => {
  const access = resolveCoupleAccess({
    now: iso("2029-01-01T00:00:00Z"),
    redeemedAt: iso("2026-01-01T00:00:00Z"),
    weddingDate: "2027-06-12",
  });
  assert.equal(access.phase, "keepsake");
  assert.equal(access.editable, false);
  assert.equal(access.exportAvailable, true);
  assert.ok(access.daysRemaining < 0);
});

test("read-only means read-only, and the three exceptions are the couple's own rights", () => {
  assert.equal(isPermittedInKeepsake("export"), true);
  assert.equal(isPermittedInKeepsake("unpublish"), true);
  assert.equal(isPermittedInKeepsake("delete-workspace"), true);

  for (const blocked of [
    "create-task", "edit-task", "delete-task", "move-task", "comment",
    "upload-attachment", "publish", "edit-milestone", "invite-collaborator",
  ] as const) {
    assert.equal(isPermittedInKeepsake(blocked), false, `${blocked} must not be writable in Keepsake`);
  }
});

test("no phase of the couple-facing wording promises permanence or a flat term", () => {
  const phases = [
    resolveCoupleAccess({ now: iso("2026-08-03T00:00:00Z"), redeemedAt: iso("2026-08-01T00:00:00Z"), weddingDate: "2028-09-16" }),
    resolveCoupleAccess({ now: iso("2028-09-20T00:00:00Z"), redeemedAt: iso("2026-08-01T00:00:00Z"), weddingDate: "2028-09-16" }),
    resolveCoupleAccess({ now: iso("2030-01-01T00:00:00Z"), redeemedAt: iso("2026-08-01T00:00:00Z"), weddingDate: "2028-09-16" }),
    resolveCoupleAccess({ now: iso("2026-08-03T00:00:00Z"), redeemedAt: iso("2026-08-01T00:00:00Z"), weddingDate: null }),
  ];
  assert.deepEqual(phases.map((p) => p.phase), ["planning", "after-the-day", "keepsake", "planning"]);

  const banned = [
    /forever/i, /for life/i, /in perpetuity/i, /permanently/i,
    /18 months/i, /eighteen months/i, /guarantee/i, /GDPR/i,
    /compliant/i, /legally/i, /!/,
    / — /, / – /,
    /seamless/i, /leverage/i, /unlock/i, /empower/i, /delight/i,
  ];
  for (const access of phases) {
    const copy = keepsakeCopy(access, longDate);
    const all = `${copy.heading} ${copy.body} ${copy.action}`;
    for (const pattern of banned) {
      assert.equal(pattern.test(all), false, `"${all}" must not match ${pattern}`);
    }
  }
});

test("the wording only claims a wedding-derived date when the wedding half actually won", () => {
  const redemptionWins = resolveCoupleAccess({
    now: iso("2026-08-03T00:00:00Z"),
    redeemedAt: iso("2026-08-01T00:00:00Z"),
    weddingDate: "2027-05-15",
  });
  assert.equal(redemptionWins.basis, "redemption");
  assert.equal(/three months past your wedding day/.test(keepsakeCopy(redemptionWins, longDate).body), false);

  const weddingWins = resolveCoupleAccess({
    now: iso("2026-08-03T00:00:00Z"),
    redeemedAt: iso("2026-08-01T00:00:00Z"),
    weddingDate: "2028-09-16",
  });
  assert.equal(weddingWins.basis, "wedding-date");
  assert.match(keepsakeCopy(weddingWins, longDate).body, /three months past your wedding day/);
});

// ── the export ────────────────────────────────────────────────────────

const sampleInput = {
  label: "Mara and Finn",
  weddingDate: "2027-06-12",
  weddingDateLabel: "Our wedding",
  venueName: "Ballintubber House",
  generatedAt: iso("2029-02-11T10:00:00Z"),
  milestones: [
    { title: "Book the band", date: "2026-11-02", state: "complete", note: "Deposit paid" },
    { title: "Send invitations", date: null, state: "upcoming" },
  ],
  tasks: [
    { title: "Confirm the menu with Rónán & Co", lane: "Done", done: true, due: "2027-04-01" },
    { title: "Order the cake <topper>", lane: "To do", done: false, notes: "Ask about the \"gold\" one" },
  ],
};

test("the export opens with no network: nothing external is referenced", () => {
  const result = buildKeepsakeExport(sampleInput);
  const html = result.files.find((f) => f.name === "keepsake.html");
  assert.ok(html);

  // Asserted as a property of the document, not as a list of strings someone
  // has to remember to update.
  assert.deepEqual(findExternalReferences(html.body), []);
  assert.equal(html.body.startsWith("<!doctype html>"), true);
  assert.match(html.body, /<style>/);
});

test("names with apostrophes and angle brackets survive without breaking the document", () => {
  const html = buildKeepsakeExport(sampleInput).files[0].body;
  // Accented letters are not escaped, so the couple's suppliers keep their names.
  assert.match(html, /Rónán/);
  assert.equal(html.includes("<topper>"), false);
  assert.match(html, /&lt;topper&gt;/);
  assert.match(html, /&quot;gold&quot;/);
  assert.equal(html.includes('Ask about the "gold" one'), false);
});

test("the export carries the venue's name only, on one line in the footer", () => {
  const html = buildKeepsakeExport(sampleInput).files[0].body;
  const occurrences = html.split("Ballintubber House").length - 1;
  assert.equal(occurrences, 1);
  assert.match(html, /Compliments of Ballintubber House\./);
  // D-011 point 2 and D-027 point 3: name only, footer only.
  assert.equal(/logo|badge|powered by/i.test(html), false);
  const footerStart = html.indexOf("<footer>");
  assert.ok(footerStart > 0 && html.indexOf("Ballintubber House") > footerStart);
});

test("an export with no venue carries no attribution line at all", () => {
  const html = buildKeepsakeExport({ ...sampleInput, venueName: null }).files[0].body;
  assert.equal(/Compliments of/.test(html), false);
});

test("the export contains the plan, and the JSON sidecar matches it", () => {
  const result = buildKeepsakeExport(sampleInput);
  assert.deepEqual(result.files.map((f) => f.name), ["keepsake.html", "keepsake.json"]);
  assert.equal(result.archiveName, "mara-and-finn-keepsake");

  const html = result.files[0].body;
  assert.match(html, /Book the band/);
  assert.match(html, /2 November 2026/);
  assert.match(html, /No date set/);
  assert.match(html, /12 June 2027/);
  assert.match(html, /Saved 11 February 2029\./);

  const json = JSON.parse(result.files[1].body);
  assert.equal(json.format, "signal-studio-keepsake");
  assert.equal(json.milestones.length, 2);
  assert.equal(json.tasks.length, 2);
  assert.equal(json.weddingDate, "2027-06-12");
  assert.equal(json.venueName, "Ballintubber House");
});

test("an empty plan still produces a readable file rather than a broken one", () => {
  const result = buildKeepsakeExport({
    label: "Untitled",
    weddingDate: null,
    generatedAt: iso("2029-02-11T10:00:00Z"),
    milestones: [],
    tasks: [],
  });
  const html = result.files[0].body;
  assert.match(html, /No milestones were shared on this plan\./);
  assert.match(html, /No tasks were recorded on this plan\./);
  assert.deepEqual(findExternalReferences(html), []);
});

test("the export makes no promise about storage and no claim about the law", () => {
  const html = buildKeepsakeExport(sampleInput).files[0].body;
  // Assert on the words a person reads, not on the markup. `<!doctype>` and
  // CSS selectors are not copy.
  const visible = html
    .replace(/<style>[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

  for (const pattern of [
    /forever/i, /guarantee/i, /GDPR/i, /compliant/i, /legally/i,
    /always be/i, /!/, / — /, / – /,
    /seamless/i, /leverage/i, /unlock/i, /empower/i, /delight/i, /robust/i,
  ]) {
    assert.equal(pattern.test(visible), false, `export copy must not match ${pattern}`);
  }
});
