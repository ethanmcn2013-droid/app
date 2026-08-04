import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The people a task can be assigned to, and the people who can be mentioned in
 * its conversation, must come from the workspace's real membership.
 *
 * This is a source scan rather than a render test because the failure it
 * guards against is a constant, not a behaviour: the assign menu shipped for
 * months with a five-name array of seed personas, so a couple opening a task
 * in their own wedding workspace was offered Chloe, David, Alex, Ada and
 * Marcus. `src/lib/members.ts` and `src/server/db/members.ts` both state the
 * rule in prose; nothing enforced it.
 *
 * The rule: these files read the roster from DomainProvider
 * (`useWorkspaceMembers`) and never name a seed persona or a design-lab
 * fixture export.
 */

const FILES = [
  "src/components/app/detail-panel/field-rows.tsx",
  "src/components/app/detail-panel/conversation-feed.tsx",
];

/** Seed personas from src/lib/data.ts, quoted as assignable ids. */
const SEED_PERSONA_IDS = [
  "chloe",
  "david",
  "alex",
  "ada",
  "marcus",
  "maya",
  "ethan",
];

function read(file) {
  return readFileSync(new URL(`../../../../${file}`, import.meta.url), "utf8");
}

test("the assign menu and the mention pool read the live workspace roster", () => {
  for (const file of FILES) {
    const source = read(file);
    assert.match(
      source,
      /useWorkspaceMembers\(\)/,
      `${file} must resolve people from the workspace roster`,
    );
  }
});

test("no seed persona id is hard-coded as an assignable person", () => {
  for (const file of FILES) {
    const source = read(file);
    for (const id of SEED_PERSONA_IDS) {
      for (const quoted of [`"${id}"`, `'${id}'`]) {
        assert.ok(
          !source.includes(quoted),
          `${file} names the seed persona ${quoted}; the roster must come from workspace_members`,
        );
      }
    }
  }
});

test("no design-lab fixture roster is imported into the task detail", () => {
  for (const file of FILES) {
    const source = read(file);
    assert.ok(
      !/\bLAB_PEOPLE\b/.test(source),
      `${file} imports the design-lab fixture roster`,
    );
    assert.ok(
      !/from\s+["'][^"']*hybrid\/fixtures["']/.test(source),
      `${file} imports from the hybrid fixture module`,
    );
  }
});

test("an empty roster is handled explicitly, never silently replaced", () => {
  const source = read("src/components/app/detail-panel/field-rows.tsx");
  assert.match(
    source,
    /members\.length === 0/,
    "field-rows must branch on an empty roster rather than fall through to a fixture",
  );
});
