import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIENCE_TIMELINE_DTO_VERSION,
  assertSourceProvenance,
  calendarDateInTimeZone,
  digestSourceFields,
  freezeAudienceItem,
  generateAudienceToken,
  hashAudienceToken,
  hasSourceDiverged,
  resolveShareAccessState,
  validateAudienceTimelineDto,
  validateIanaTimezone,
} from "./audience-timeline";

function validDto() {
  return {
    version: AUDIENCE_TIMELINE_DTO_VERSION,
    audienceKind: "class",
    publicationId: "pub-public-surrogate",
    label: "History, autumn term",
    ownerDisplayLabel: "Shared by Ms Byrne",
    primaryDate: { label: "Assessment", date: "2026-12-10" },
    lastUpdatedAt: "2026-09-01T10:00:00.000Z",
    today: "2026-09-01",
    sections: [
      {
        state: "covered",
        label: "Covered",
        items: [
          {
            publicId: "item-public-surrogate",
            title: "Industrial Ireland",
            date: "2026-08-30",
            state: "covered",
          },
        ],
      },
      {
        state: "next",
        label: "Next",
        items: [
          {
            publicId: "item-two",
            title: "Primary sources",
            date: "2026-09-08",
            state: "next",
          },
        ],
      },
    ],
  } as const;
}

test("Audience share tokens carry 256 bits and only their SHA-256 digest is stable", () => {
  const raw = generateAudienceToken();
  assert.equal(Buffer.from(raw, "base64url").length, 32);
  assert.match(raw, /^[A-Za-z0-9_-]{43}$/);
  const digest = hashAudienceToken(raw);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.ok(!digest.includes(raw));
  assert.notEqual(generateAudienceToken(), raw);
});

test("strict public DTO accepts only the documented frozen projection", () => {
  assert.deepEqual(validateAudienceTimelineDto(validDto()), validDto());
});

for (const forbidden of [
  "workspaceId",
  "userId",
  "ownerEmail",
  "membership",
  "description",
  "notes",
  "comments",
  "attachments",
  "sourceRelation",
]) {
  test(`public DTO rejects private field ${forbidden}`, () => {
    assert.throws(
      () => validateAudienceTimelineDto({ ...validDto(), [forbidden]: "private" }),
      /forbidden|allowlisted/,
    );
  });
}

test("public DTO rejects pupil data and unknown nested keys", () => {
  const dto = validDto();
  const withPupils = {
    ...dto,
    sections: [
      {
        ...dto.sections[0],
        items: [{ ...dto.sections[0].items[0], pupilNames: ["A pupil"] }],
      },
    ],
  };
  assert.throws(() => validateAudienceTimelineDto(withPupils), /allowlisted/);
});

test("revocation, rotation, and expiry are immediate access decisions", () => {
  const future = new Date("2026-09-02T00:00:00Z");
  const now = new Date("2026-09-01T00:00:00Z");
  assert.equal(resolveShareAccessState(null, now), "invalid");
  assert.equal(resolveShareAccessState({ state: "revoked", expiresAt: null }, now), "revoked");
  assert.equal(resolveShareAccessState({ state: "rotated", expiresAt: null }, now), "rotated");
  assert.equal(resolveShareAccessState({ state: "expired", expiresAt: null }, now), "expired");
  assert.equal(resolveShareAccessState({ state: "active", expiresAt: now }, now), "expired");
  assert.equal(resolveShareAccessState({ state: "active", expiresAt: future }, now), "valid");
});

test("promotion refuses a source object from another canonical workspace", () => {
  assert.throws(
    () =>
      freezeAudienceItem(
        {
          id: "task-1",
          workspaceId: "workspace-b",
          title: "Private title",
          date: null,
          completionState: "next",
        },
        "workspace-a",
      ),
    /outside the selected workspace/,
  );
});

test("synced promotion requires project-level canonical provenance; manual nodes remain local", () => {
  assert.doesNotThrow(() =>
    assertSourceProvenance(
      { kind: "synced", sourceTasksWorkspaceId: "workspace-a" },
      "workspace-a",
    ),
  );
  assert.throws(
    () =>
      assertSourceProvenance(
        { kind: "synced", sourceTasksWorkspaceId: "workspace-b" },
        "workspace-a",
      ),
    /not proven/,
  );
  assert.throws(
    () =>
      assertSourceProvenance(
        { kind: "synced", sourceTasksWorkspaceId: null },
        "workspace-a",
      ),
    /not proven/,
  );
  assert.doesNotThrow(() =>
    assertSourceProvenance(
      { kind: "manual", sourceTasksWorkspaceId: null },
      "workspace-a",
    ),
  );
});

test("Today uses the publication IANA timezone across Dublin summer rollover", () => {
  const instant = new Date("2026-07-12T23:30:00.000Z");
  assert.equal(calendarDateInTimeZone(instant, "UTC"), "2026-07-12");
  assert.equal(
    calendarDateInTimeZone(instant, "Europe/Dublin"),
    "2026-07-13",
  );
});

test("Dublin winter and Tokyo rollover remain calendar-date correct", () => {
  const instant = new Date("2026-12-31T23:30:00.000Z");
  assert.equal(
    calendarDateInTimeZone(instant, "Europe/Dublin"),
    "2026-12-31",
  );
  assert.equal(calendarDateInTimeZone(instant, "Asia/Tokyo"), "2027-01-01");
  assert.equal(validateIanaTimezone("Europe/Dublin"), "Europe/Dublin");
  assert.throws(() => validateIanaTimezone("Mars/Olympus"), /valid IANA/);
});

test("source divergence never mutates the frozen public copy", () => {
  const source = {
    id: "task-1",
    workspaceId: "workspace-a",
    title: "Submit essay",
    date: "2026-10-01",
    completionState: "next",
  } as const;
  const frozen = freezeAudienceItem(source, "workspace-a");
  const changedSource = {
    title: "Submit revised essay with private instructions",
    date: "2026-10-08",
    completionState: "in-flight",
  };
  assert.equal(hasSourceDiverged(frozen.sourceDigest, changedSource), true);
  assert.deepEqual(
    {
      title: frozen.title,
      date: frozen.calendarDate,
      state: frozen.state,
    },
    { title: "Submit essay", date: "2026-10-01", state: "next" },
  );
  assert.notEqual(
    frozen.sourceDigest,
    digestSourceFields(changedSource),
  );
});
