import assert from "node:assert/strict";
import { test } from "node:test";
import { editAfterSave, notebookRecoveryKey, recoveredEditForNote } from "./notes-recovery";
import { notesRecoveryActorScope, assertNotesRecoveryActor } from "../server/notes-recovery-actor";
import { notesHref } from "./notes-view-model";
import { assertProjectId } from "@/lib/projects/project-ref";
import { canonicaliseProjectUrl, withActiveProject } from "@/lib/projects/project-url";
import { withSuiteContext } from "@/lib/suite-context";
import { YOUR_WORK_APP_PATH } from "@/lib/product-urls";

test("recovery frames cannot alias another actor or project", () => {
  const keys = [notebookRecoveryKey("a", "b"), notebookRecoveryKey("a:b", null), notebookRecoveryKey("a", "c"), notebookRecoveryKey("c", "b")];
  assert.equal(new Set(keys).size, keys.length);
});
test("recovering an edit requires its exact filing binding and a finite version", () => {
  const edit = { body: "  Exact café\n", workspaceId: "b", expectedUpdatedAt: 4, queued: false };
  assert.deepEqual(recoveredEditForNote(edit, { workspaceId: "b" }), edit);
  assert.equal(recoveredEditForNote(edit, { workspaceId: "a" }), null);
  assert.equal(recoveredEditForNote({ ...edit, expectedUpdatedAt: NaN }, { workspaceId: "b" }), null);
  assert.equal(recoveredEditForNote({ ...edit, queued: undefined }, { workspaceId: "b" }), null);
});
test("an earlier success rebases newer writing instead of clearing it", () => {
  const current = { body: "newer", workspaceId: "b", expectedUpdatedAt: 4, queued: false };
  assert.deepEqual(editAfterSave(current, { body: "old", expectedUpdatedAt: 4 }, { body: "old", updatedAt: 5 }), { ...current, expectedUpdatedAt: 5 });
  assert.deepEqual(editAfterSave({ ...current, expectedUpdatedAt: 9 }, { body: "old", expectedUpdatedAt: 4 }, { body: "old", updatedAt: 5 }), { ...current, expectedUpdatedAt: 9 });
  assert.equal(editAfterSave(current, { body: "newer", expectedUpdatedAt: 4 }, { body: "newer", updatedAt: 5 }), null);
});
test("the server replay fence refuses a changed account before a write", () => {
  assertNotesRecoveryActor("a", notesRecoveryActorScope("a"));
  assert.throws(() => assertNotesRecoveryActor("b", notesRecoveryActorScope("a")), /account changed/);
  assert.throws(() => assertNotesRecoveryActor("a", ""), /account changed/);
});
test("Notes local views preserve canonical project identity", () => {
  for (const view of ["notebook", "review", "sent"] as const) {
    const url = new URL(notesHref(view, "note/one", assertProjectId("project-b")), "https://app.example.test");
    assert.equal(url.searchParams.get("workspaceId"), "project-b");
    assert.equal(url.searchParams.get("note"), "note/one");
    assert.equal(url.searchParams.has("contextVersion"), false);
  }
});
test("V3 product links agree with the canonical helper, including query and fragment", () => {
  for (const href of ["/app/tasks", "/app/tasks?task=t#detail", `${YOUR_WORK_APP_PATH}?projectId=local-label`, "/app/notes?view=sent&sourceProduct=tasks&contextVersion=2&projectId=label&planningPeriodId=period#note"]) {
    assert.equal(withSuiteContext(href, { version: 3, workspaceId: "project-b" }), canonicaliseProjectUrl(withActiveProject(href, assertProjectId("project-b"))).url);
  }
  assert.match(withSuiteContext("/app/tasks", { version: 2, workspaceId: "project-a" }), /contextVersion=2/);
});
