import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ExistingTaskHistory, existingTaskHistoryItems } from "./existing-task-history";

const history = {
  taskId: "task_a",
  projectId: "project_a",
  comments: [{ id: "comment_a", authorId: "alice", authorName: "Alice", body: "Existing note", createdAt: 2_000 }],
  activities: [{ id: "activity_a", authorId: "bob", authorName: "Bob", kind: "move", createdAt: 1_000 }],
} as const;

test("read-only history orders rows and renders no mutation controls", () => {
  assert.deepEqual(existingTaskHistoryItems(history).map((item) => item.kind), ["activity", "comment"]);
  const html = renderToStaticMarkup(<ExistingTaskHistory history={history} />);
  assert.match(html, /data-existing-task-history/);
  assert.match(html, /data-read-only/);
  assert.match(html, /Existing note/);
  assert.match(html, /Bob/);
  assert.doesNotMatch(html, /<form|<textarea|<button/);
});
