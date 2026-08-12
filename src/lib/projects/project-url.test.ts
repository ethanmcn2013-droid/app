import { test } from "node:test";
import assert from "node:assert/strict";
import { withSuiteContext } from "@/lib/suite-context";
import { assertProjectId, parseProjectId } from "@/lib/projects/project-ref";
import {
  PROJECT_DESTINATION_SURFACES,
  buildProjectUrl,
  canonicaliseProjectUrl,
  parseProjectDestination,
  urlEmitsV2Vocabulary,
  withActiveProject,
  type ProjectDestination,
} from "@/lib/projects/project-url";

const A = assertProjectId("ws-a");

test("every V3 destination carries workspaceId and no V2 vocabulary", () => {
  const destinations: ProjectDestination[] = [
    { surface: "tasks" },
    { surface: "tasks", view: "list" },
    { surface: "tasks", view: "timeline" },
    { surface: "tasks", view: "calendar" },
    { surface: "timeline" },
    { surface: "timeline", timelineSlug: "our-day", mode: "edit" },
    { surface: "notes" },
    { surface: "notes", view: "review", noteId: "n-1" },
    { surface: "project" },
    { surface: "home" },
    { surface: "home", briefing: true },
    { surface: "your-work" },
  ];
  const covered = new Set(destinations.map((d) => d.surface));
  assert.deepEqual(
    [...covered].sort(),
    [...PROJECT_DESTINATION_SURFACES].sort(),
    "every allowlisted surface must be exercised here",
  );

  for (const destination of destinations) {
    const url = buildProjectUrl(destination, A);
    assert.equal(urlEmitsV2Vocabulary(url), false, url);
    assert.match(url, /(\?|&)workspaceId=ws-a(&|$)/, url);
    assert.match(url, /^\/app\//, url);
  }
});

test("the canonical routes match the locked URL contract", () => {
  assert.equal(buildProjectUrl({ surface: "tasks" }, A), "/app/tasks?workspaceId=ws-a");
  assert.equal(
    buildProjectUrl({ surface: "tasks", view: "list" }, A),
    "/app/tasks/list?workspaceId=ws-a",
  );
  // The Tasks time view lives under /app/tasks; /app/timeline is the product.
  assert.equal(
    buildProjectUrl({ surface: "tasks", view: "timeline" }, A),
    "/app/tasks/timeline?workspaceId=ws-a",
  );
  assert.equal(
    buildProjectUrl({ surface: "timeline", timelineSlug: "our-day", mode: "edit" }, A),
    "/app/timeline/our-day?workspaceId=ws-a&mode=edit",
  );
  // "view" is the default and stays out of the URL.
  assert.equal(
    buildProjectUrl({ surface: "timeline", mode: "view" }, A),
    "/app/timeline?workspaceId=ws-a",
  );
  assert.equal(
    buildProjectUrl({ surface: "notes", view: "review", noteId: "n-1" }, A),
    "/app/notes?workspaceId=ws-a&view=review&note=n-1",
  );
  assert.equal(buildProjectUrl({ surface: "project" }, A), "/app/project?workspaceId=ws-a");
  assert.equal(buildProjectUrl({ surface: "home" }, A), "/app/home?workspaceId=ws-a");
  assert.equal(
    buildProjectUrl({ surface: "home", briefing: true }, A),
    "/app/home/briefing?workspaceId=ws-a",
  );
  assert.equal(
    buildProjectUrl({ surface: "your-work" }, A),
    "/app/your-work?workspaceId=ws-a",
  );
});

test("the destination allowlist refuses anything it does not name", () => {
  assert.equal(parseProjectDestination(null), null);
  assert.equal(parseProjectDestination("/app/tasks"), null);
  assert.equal(parseProjectDestination({ surface: "admin" }), null);
  assert.equal(parseProjectDestination({ surface: "tasks", view: "gantt" }), null);
  assert.equal(parseProjectDestination({ surface: "notes", view: "inbox" }), null);
  assert.equal(parseProjectDestination({ surface: "timeline", mode: "delete" }), null);
  // An open-redirect attempt has no shape the allowlist accepts.
  assert.equal(
    parseProjectDestination({ surface: "timeline", timelineSlug: "../../evil" }),
    null,
  );
  assert.equal(parseProjectDestination({ returnTo: "https://evil.example" }), null);
  assert.deepEqual(parseProjectDestination({ surface: "tasks", view: "board" }), {
    surface: "tasks",
    view: "board",
  });
});

test("a V2 link from the shipped emitter canonicalises to a V3 URL", () => {
  const v2 = withSuiteContext("/app/tasks", {
    version: 2,
    workspaceId: "ws-a",
    planningPeriodId: "p-1",
    projectId: "proj-9",
  });
  // The emitter is retained during migration and still writes all four.
  assert.equal(urlEmitsV2Vocabulary(v2), true);

  const canonical = canonicaliseProjectUrl(v2);
  assert.equal(canonical.changed, true);
  assert.equal(canonical.url, "/app/tasks?workspaceId=ws-a");
  assert.equal(canonical.workspaceId, "ws-a");
  assert.deepEqual(
    [...canonical.droppedParams].sort(),
    ["contextVersion", "planningPeriodId", "projectId", "sourceProduct"],
  );
});

test("canonicalisation is idempotent and leaves a clean V3 URL alone", () => {
  const once = canonicaliseProjectUrl("/app/notes?workspaceId=ws-a&view=review&note=n-1");
  assert.equal(once.changed, false);
  assert.equal(once.url, "/app/notes?workspaceId=ws-a&view=review&note=n-1");
  const twice = canonicaliseProjectUrl(once.url);
  assert.equal(twice.url, once.url);
  assert.equal(twice.changed, false);
});

test("local view state survives canonicalisation untouched", () => {
  const result = canonicaliseProjectUrl(
    "/app/timeline/our-day?sourceProduct=tasks&contextVersion=2&workspaceId=ws-a&mode=edit#milestones",
  );
  assert.equal(result.url, "/app/timeline/our-day?workspaceId=ws-a&mode=edit#milestones");
  assert.equal(result.workspaceId, "ws-a");
});

test("Your Work keeps its local projectId; every other surface loses it", () => {
  // D-010: the tag-derived / local "project" concept becomes Label or
  // Workstream in WP9. Until then, silently dropping it here would change what
  // that page shows.
  const yourWork = canonicaliseProjectUrl("/app/your-work?workspaceId=ws-a&projectId=proj-9");
  assert.equal(yourWork.url, "/app/your-work?workspaceId=ws-a&projectId=proj-9");
  assert.equal(yourWork.droppedParams.includes("projectId"), false);

  const tasks = canonicaliseProjectUrl("/app/tasks?workspaceId=ws-a&projectId=proj-9");
  assert.equal(tasks.url, "/app/tasks?workspaceId=ws-a");
});

test("a malformed or repeated workspaceId is dropped, never passed through", () => {
  const malformed = canonicaliseProjectUrl("/app/tasks?workspaceId=../../etc");
  assert.equal(malformed.workspaceId, null);
  assert.equal(malformed.url, "/app/tasks");

  const repeated = canonicaliseProjectUrl("/app/tasks?workspaceId=ws-a&workspaceId=ws-b");
  assert.equal(repeated.workspaceId, null);
  assert.equal(repeated.url, "/app/tasks");
});

test("withActiveProject appends the one canonical parameter and replaces a stale one", () => {
  assert.equal(withActiveProject("/app/tasks", A), "/app/tasks?workspaceId=ws-a");
  assert.equal(
    withActiveProject("/app/notes?view=review", A),
    "/app/notes?view=review&workspaceId=ws-a",
  );
  assert.equal(
    withActiveProject("/app/tasks?workspaceId=ws-old", A),
    "/app/tasks?workspaceId=ws-a",
  );
  assert.throws(() => withActiveProject("https://app.signalstudio.ie/app/tasks", A));
});

test("parseProjectId refuses the shapes a Project id can never have", () => {
  assert.equal(parseProjectId(undefined), null);
  assert.equal(parseProjectId(null), null);
  assert.equal(parseProjectId(""), null);
  assert.equal(parseProjectId("-leading-hyphen"), null);
  assert.equal(parseProjectId("has space"), null);
  assert.equal(parseProjectId("a".repeat(129)), null);
  assert.equal(parseProjectId(["ws-a", "ws-b"]), null);
  assert.equal(parseProjectId("ws-a"), "ws-a");
});
