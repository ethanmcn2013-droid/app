import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationResult } from "./contracts";
import type { TaskCommentPage, TaskCommentRecord } from "./task-discussion-contracts";
import { loadDeepLinkedComment } from "./deep-link-comment";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const comment: TaskCommentRecord = {
  id: "old-comment", taskId: "task-a", authorId: "actor-a", authorName: "Person",
  rootCommentId: null, createSeq: 4, revision: 1, body: "old private body",
  createdAt: 1, editedAt: null, deletedAt: null, mentionUserIds: [],
};
const page: TaskCommentPage = {
  audienceEpoch: 1, throughChangeSeq: 4, comments: [comment],
  hasOlder: false, beforeCreateSeq: null,
};
const position = { ok: true as const, value: { positions: [{ itemId: comment.id, createSeq: 4 }] } };

test("an older exact comment loads from its indexed page while access is current", async () => {
  const loaded: TaskCommentRecord[][] = [];
  const pages: number[] = [];
  await loadDeepLinkedComment({
    commentId: comment.id, isCurrent: () => true,
    position: async () => position,
    page: async before => { pages.push(before); return { ok: true, value: page }; },
    onLoaded: comments => loaded.push([...comments]),
  });
  assert.deepEqual(pages, [5]);
  assert.deepEqual(loaded, [[comment]]);
});

test("revocation before a late position or page response cannot restore private content", async () => {
  const status = deferred<ConversationResult<typeof position.value>>();
  const pageResult = deferred<ConversationResult<TaskCommentPage>>();
  const loaded: TaskCommentRecord[][] = [];
  let generation = 1;
  let pageRequested = false;
  const first = loadDeepLinkedComment({
    commentId: comment.id, isCurrent: () => generation === 1,
    position: () => status.promise,
    page: async () => { pageRequested = true; return { ok: true, value: page }; },
    onLoaded: comments => loaded.push([...comments]),
  });
  generation = 2;
  status.resolve(position);
  await first;
  assert.equal(pageRequested, false);

  generation = 1;
  const second = loadDeepLinkedComment({
    commentId: comment.id, isCurrent: () => generation === 1,
    position: async () => position,
    page: () => pageResult.promise,
    onLoaded: comments => loaded.push([...comments]),
  });
  await Promise.resolve();
  generation = 2;
  pageResult.resolve({ ok: true, value: page });
  await second;
  assert.deepEqual(loaded, []);
});
