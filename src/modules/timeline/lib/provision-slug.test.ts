import assert from "node:assert/strict";
import test from "node:test";
import { deriveTimelineWorkspaceSlug } from "./provision-slug";
import { isValidSlug } from "./reserved-slugs";

const never = () => false;

test("the Tasks workspace slug is used unchanged when it is free", () => {
  assert.equal(
    deriveTimelineWorkspaceSlug({
      preferred: "mara-and-finn",
      fallbackSeed: "ws_abc123",
      isTaken: never,
    }),
    "mara-and-finn",
  );
});

test("a taken slug falls through to a readable suffix, not a random one", () => {
  assert.equal(
    deriveTimelineWorkspaceSlug({
      preferred: "mara-and-finn",
      fallbackSeed: "ws_abc123",
      isTaken: (s) => s === "mara-and-finn",
    }),
    "mara-and-finn-plan",
  );
});

test("a reserved word is never returned", () => {
  // "tasks", "studio", "settings" and friends collide with real routes.
  const slug = deriveTimelineWorkspaceSlug({
    preferred: "tasks",
    fallbackSeed: "ws_abc123",
    isTaken: never,
  });
  assert.notEqual(slug, "tasks");
  assert.ok(isValidSlug(slug));
});

test("a name too short to be a slug still yields a valid one", () => {
  // "Al" slugifies to "al", which is two characters and fails the 3-32 rule.
  const slug = deriveTimelineWorkspaceSlug({
    preferred: "Al",
    fallbackSeed: "ws_abc123",
    isTaken: never,
  });
  assert.ok(isValidSlug(slug), `${slug} is not a valid slug`);
});

test("an unusable name falls back to the workspace id, which always exists", () => {
  const slug = deriveTimelineWorkspaceSlug({
    preferred: "!!!",
    fallbackSeed: "ws_abc123",
    isTaken: never,
  });
  assert.ok(isValidSlug(slug), `${slug} is not a valid slug`);
  assert.ok(slug.includes("wsabc123"));
});

test("a very long name is clamped without leaving a trailing hyphen", () => {
  const slug = deriveTimelineWorkspaceSlug({
    preferred: "the wedding of somebody with an extremely long workspace name",
    fallbackSeed: "ws_abc123",
    isTaken: never,
  });
  assert.ok(slug.length <= 32, `${slug} is ${slug.length} characters`);
  assert.ok(isValidSlug(slug), `${slug} is not a valid slug`);
});

test("a long name whose suffixed form would overflow still stays valid", () => {
  const long = "abcdefghij-abcdefghij-abcdefghij";
  assert.equal(long.length, 32);
  const slug = deriveTimelineWorkspaceSlug({
    preferred: long,
    fallbackSeed: "ws_abc123",
    isTaken: (s) => s === long,
  });
  assert.ok(slug.length <= 32, `${slug} is ${slug.length} characters`);
  assert.ok(isValidSlug(slug), `${slug} is not a valid slug`);
  assert.notEqual(slug, long);
});

test("it throws rather than returning nothing when every candidate is taken", () => {
  assert.throws(
    () =>
      deriveTimelineWorkspaceSlug({
        preferred: "mara-and-finn",
        fallbackSeed: "ws_abc123",
        isTaken: () => true,
      }),
    /Could not derive a Timeline workspace slug/,
  );
});

test("every candidate it can return passes isValidSlug", () => {
  const names = [
    "Mara and Finn",
    "the-wedding",
    "app",
    "a",
    "ÁINE & SEÁN",
    "2027",
    "-leading-hyphen-",
  ];
  for (const name of names) {
    const slug = deriveTimelineWorkspaceSlug({
      preferred: name,
      fallbackSeed: "ws_9f3c21aa",
      isTaken: never,
    });
    assert.ok(isValidSlug(slug), `${name} produced invalid slug ${slug}`);
  }
});
