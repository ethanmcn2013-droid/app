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
 *
 * WP6 update: there were TWO delete paths, and only Settings' had the fix —
 * the sidebar's `deleteProjectAction` cascaded without it (WP6_SURFACE_MAP.md
 * §7). Both now route through the consolidated service's `deleteProject`
 * (`src/server/projects/service.ts`), which owns the slug read and the
 * revalidation. So this file pins three things: the service carries the fix,
 * and EACH entry point delegates to the service rather than cascading on its
 * own. A second delete implementation appearing in either action file is the
 * regression this guard exists to catch.
 *
 * The runtime half lives in
 * `src/server/projects/service-lifecycle.test.ts`, which executes both entry
 * points against a real scratch database and asserts the recorded
 * `revalidatePath` calls.
 */

const settings = readFileSync(
  new URL("./actions/settings.ts", import.meta.url),
  "utf8",
);
const planning = readFileSync(
  new URL("./actions/planning.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./projects/service.ts", import.meta.url),
  "utf8",
);
const projectDeletion = readFileSync(
  new URL(
    "./connections/project-drive-project-deletion.ts",
    import.meta.url,
  ),
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

test("publish and unpublish drop the cached public page", () => {
  for (const name of ["publishWorkspaceAction", "unpublishWorkspaceAction"]) {
    assert.match(
      actionBody(settings, name),
      /revalidatePath\(`\/p\/\$\{[^}]+\}`\)/,
      `${name} must revalidate /p/{slug}`,
    );
  }
});

test("the one delete path drops the cached public page", () => {
  assert.match(
    actionBody(service, "deleteProject"),
    /revalidatePath\(`\/p\/\$\{[^}]+\}`\)/,
    "the service's deleteProject must revalidate /p/{slug}",
  );
});

test("delete reads the slug before the row is deleted, not after", () => {
  const body = actionBody(service, "deleteProject");
  assert.match(body, /createProjectDriveProjectDeletionService\(\{/);
  const read = projectDeletion.indexOf(".from(workspaces)");
  const drop = projectDeletion.indexOf(".delete(workspaces)");
  assert.ok(read >= 0, "delete must read the slug");
  assert.ok(drop >= 0, "delete must delete the workspace");
  assert.ok(read < drop, "the slug must be read before the workspace row is gone");
});

test("both entry points delegate to the service delete instead of cascading themselves", () => {
  for (const [source, name, file] of [
    [settings, "deleteWorkspaceAction", "settings.ts"],
    [planning, "deleteProjectAction", "planning.ts"],
  ]) {
    const body = actionBody(source, name);
    assert.match(
      body,
      /await deleteProject\(\{/,
      `${file}'s ${name} must call the consolidated service delete`,
    );
    assert.doesNotMatch(
      body,
      /delete\(workspaces\)|delete\(tasks\)|delete\(shareLinks\)/,
      `${file}'s ${name} must not carry its own cascade — a second delete ` +
        `implementation is how the E06.12 gap reopens`,
    );
  }
});
