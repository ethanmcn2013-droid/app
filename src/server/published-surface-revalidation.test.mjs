import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * E06.12 · every action that changes whether `/p/{slug}` resolves must drop
 * the cached page.
 *
 * This asserts against SOURCE TEXT on purpose, and says so rather than
 * pretending otherwise. The defect it pins was never a logic bug: publish and
 * unpublish both called `revalidatePath('/p/{slug}')` and delete simply did
 * not, so a deleted published workspace kept serving its cached page — task
 * titles and the guests' and suppliers' names in them — for up to the ISR
 * window after the owner deleted it. Only the wiring can catch a missing call,
 * so only the wiring is asserted. This does not claim to prove cache
 * behaviour.
 */

const settings = readFileSync(
  new URL("./actions/settings.ts", import.meta.url),
  "utf8",
);
const publishedPage = readFileSync(
  new URL("../app/p/[slug]/page.tsx", import.meta.url),
  "utf8",
);

/** Body of a named exported async function, up to the next top-level export. */
function actionBody(source, name) {
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next > 0 ? next : source.length);
}

test("the published page is cached, which is what makes the revalidation load-bearing", () => {
  // If /p ever stops being ISR this test is measuring nothing, so it checks.
  assert.match(publishedPage, /export const revalidate = \d+/);
});

test("publish, unpublish and delete all drop the cached public page", () => {
  for (const name of [
    "publishWorkspaceAction",
    "unpublishWorkspaceAction",
    "deleteWorkspaceAction",
  ]) {
    assert.match(
      actionBody(settings, name),
      /revalidatePath\(`\/p\/\$\{[^}]+\}`\)/,
      `${name} must revalidate /p/{slug}`,
    );
  }
});

test("delete reads the slug before the row is deleted, not after", () => {
  const body = actionBody(settings, "deleteWorkspaceAction");
  const read = body.indexOf(".select({ slug: workspaces.slug");
  const drop = body.indexOf("delete(workspaces)");
  assert.ok(read >= 0, "delete must read the slug");
  assert.ok(drop >= 0, "delete must delete the workspace");
  assert.ok(read < drop, "the slug must be read before the workspace row is gone");
});
