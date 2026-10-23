import assert from "node:assert/strict";
import { test } from "node:test";
import { justCompletedProject, type CompletionSnapshot } from "./project-completion-model";

const open: CompletionSnapshot = { projectId: "a", tasks: [{ id: "1", done: true }, { id: "2", done: false }] };
const done: CompletionSnapshot = { projectId: "a", tasks: [{ id: "1", done: true }, { id: "2", done: true }] };
test("celebration requires the same project's tasks becoming complete", () => {
  assert.equal(justCompletedProject(open, done), true);
  assert.equal(justCompletedProject(null, done), false);
  assert.equal(justCompletedProject(done, done), false);
  assert.equal(justCompletedProject(open, { ...done, projectId: "b" }), false);
  assert.equal(justCompletedProject(open, { projectId: "a", tasks: [done.tasks[0]] }), false);
  assert.equal(justCompletedProject(open, { projectId: "a", tasks: [] }), false);
  assert.equal(justCompletedProject(open, { projectId: "a", tasks: [{ id: "3", done: true }, done.tasks[0]] }), false);
});
