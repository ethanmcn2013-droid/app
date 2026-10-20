import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudienceTimelineDto } from "./audience-timeline";
import { master3SocialDetails } from "./master3-social";

const timeline: AudienceTimelineDto = {
  version: 1, audienceKind: "couple", publicationId: "public-example",
  label: "Our wedding", ownerDisplayLabel: "Mara & Finn",
  primaryDate: { label: "Wedding day", date: "2026-10-03" },
  today: "2026-07-16", lastUpdatedAt: "2026-07-15T12:00:00Z", sections: [],
};

test("social details are absent without the owner's explicit consent", () => {
  assert.equal(master3SocialDetails(timeline), null);
  assert.equal(master3SocialDetails({ ...timeline, presentation: { socialDetails: false } }), null);
});

test("the approved card contains a stable calendar date and consented venue only", () => {
  const actual = master3SocialDetails({
    ...timeline,
    presentation: {
      socialDetails: true, locationConsent: true, place: "The Orchard",
      address: "Private directions", onDayNote: "Private note", photosUrl: "https://example.org/photos",
    },
  });
  assert.deepEqual(actual, {
    title: "Mara & Finn", date: "Saturday 3 October 2026", place: "The Orchard",
    description: "Saturday 3 October 2026 · The Orchard",
  });
  assert.doesNotMatch(JSON.stringify(actual), /Private|photos|public-example|2026-07/);
});

test("location still requires its own consent; generic projects keep their actual title", () => {
  const actual = master3SocialDetails({ ...timeline, audienceKind: "module", presentation: {
    socialDetails: true, place: "Do not disclose",
  } });
  assert.equal(actual?.title, "Our wedding");
  assert.equal(actual?.place, null);
  assert.equal(master3SocialDetails({ ...timeline, primaryDate: undefined, presentation: { socialDetails: true } })?.description, "A shared timeline.");
});
