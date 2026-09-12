import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const requireFromRepo = createRequire(resolve("package.json"));

async function harness(outgoingCache?: Map<string, unknown>) {
  const ts = requireFromRepo("typescript") as typeof import("typescript");
  const source = await readFile(resolve("src/components/app/detail-panel/conversation-feed.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states: unknown[] = [];
  const effects: Array<() => void | (() => void)> = [];
  let slot = 0;
  let transport: (url: unknown, init?: RequestInit) => Promise<{ json(): Promise<unknown> }> = async () => {
    throw new Error("unexpected transport");
  };
  const element = (type: unknown, props: unknown) => ({ type, props });
  const react = {
    useState: (initial: unknown) => {
      const index = slot++;
      if (!(index in states)) states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [states[index], (value: unknown) => {
        states[index] = typeof value === "function" ? (value as (current: unknown) => unknown)(states[index]) : value;
      }];
    },
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useRef: (value: unknown) => ({ current: value }),
    useEffect: (fn: () => void | (() => void)) => { effects.push(fn); },
  };
  const exports: Record<string, (props: unknown) => { type: (props: unknown) => unknown }> = {};
  vm.runInNewContext(compiled, {
    exports,
    URLSearchParams,
    Headers,
    AbortController,
    crypto: requireFromRepo("node:crypto").webcrypto,
    fetch: (url: unknown, init?: RequestInit) => transport(url, init),
    window: { setInterval: () => 1, clearInterval: () => {}, matchMedia: () => ({ matches: false }) },
    requestAnimationFrame: (fn: () => void) => fn(),
    require: (id: string) => {
      if (id === "react") return react;
      if (id === "react/jsx-runtime") return { jsx: element, jsxs: element };
      if (id === "motion/react") return { motion: {}, AnimatePresence: () => null, useReducedMotion: () => false };
      if (id === "@/lib/auth-context") return { useCurrentUser: () => "alice" };
      if (id === "@/lib/tasks/delight-events") return { beginTaskSync: () => () => {} };
      if (id === "@/components/app/messages/conversation-client-model") {
        return { conversationHeaders: () => new Headers(), shouldSendComposerKey: () => false };
      }
      if (id === "@/components/app/messages/conversation-session-provider") {
        const taskDiscussions = new Map();
        return { useConversationCaches: () => ({ taskDiscussions }) };
      }
      return {};
    },
  });
  const snapshot = {
    taskId: "task", projectId: "project", projectName: "Project", lifecycle: "active",
    audienceEpoch: 1, throughChangeSeq: 1,
    members: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }],
    comments: [{ id: "comment", taskId: "task", authorId: "alice", authorName: "Alice",
      body: "Original", revision: 1, createSeq: 1, createdAt: 1, editedAt: null,
      deletedAt: null, rootCommentId: null, mentionUserIds: [] }],
    hasOlder: false, beforeCreateSeq: 1,
  };
  const props = { taskId: "task", initialDiscussion: snapshot, fixtureActor: "alice", outgoingCache };
  const outer = exports.ConversationFeed(props);
  const render = () => { slot = 0; return outer.type(props) as ElementNode; };
  const first = render();
  effects[0]?.();
  return { snapshot, first, render, setTransport: (next: typeof transport) => { transport = next; } };
}

type ElementNode = { type?: { name?: string }; props?: Record<string, unknown> } | null;
function find(node: unknown, name: string): ElementNode {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) { const found = find(child, name); if (found) return found; }
    return null;
  }
  const element = node as ElementNode;
  if (element?.type?.name === name) return element;
  return find(element?.props?.children, name);
}

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

test("task navigation restores cached in-flight work as uncertain without replay", async () => {
  const outgoingCache = new Map<string, unknown>();
  outgoingCache.set(JSON.stringify(["alice", "project", "task"]), {
    pending: [{ state: "pending", input: { action: "edit", taskId: "task", commentId: "comment",
      clientRequestId: "task_comment_edit_restored", expectedRevision: 1, expectedAudienceEpoch: 1,
      body: "Retained edit", mentionUserIds: ["bob"] } }],
    draft: { body: "New composer", mentionUserIds: ["bob"], rootCommentId: "comment" },
    reviewedAudienceEpoch: 1,
  });
  const feed = await harness(outgoingCache);
  const pending = find(feed.first, "PendingRow");
  const composer = find(feed.first, "Composer");
  assert.ok(pending && composer);
  assert.equal((pending.props!.item as { state: string }).state, "uncertain");
  assert.equal((pending.props!.item as { input: { clientRequestId: string } }).input.clientRequestId,
    "task_comment_edit_restored");
  assert.equal((composer.props!.draft as { body: string }).body, "New composer");
});

test("uncertain send retries its exact request id, body, root and structured mention ids", async () => {
  const feed = await harness();
  feed.setTransport(async (url, init) => {
    if (init?.method === "POST") return { json: async () => ({ ok: false, code: "temporarily_unavailable" }) };
    if (String(url).includes("action=receipt")) throw new Error("receipt unavailable");
    throw new Error("unexpected request");
  });
  const composer = find(feed.first, "Composer");
  assert.ok(composer);
  assert.equal(await (composer.props!.onSubmit as (
    body: string, mentions: readonly string[], root: string | null,
  ) => Promise<boolean>)("Exact body", ["bob"], "comment"), true);
  await flush();
  const pending = find(feed.render(), "PendingRow");
  assert.ok(pending);
  const operation = pending.props!.item as { input: Record<string, unknown> };
  const requestId = operation.input.clientRequestId;
  assert.deepEqual(Array.from(operation.input.mentionUserIds as readonly string[]), ["bob"]);
  const posts: Array<Record<string, unknown>> = [];
  feed.setTransport(async (url, init) => {
    if (String(url).includes("action=receipt")) return { json: async () => ({ ok: true, value: { state: "absent" } }) };
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return { json: async () => ({ ok: true, value: { commentId: "created", clientRequestId: requestId,
        createSeq: 2, changeSeq: 2, revision: 1, committedAt: 2 } }) };
    }
    return { json: async () => ({ ok: true, value: { ...feed.snapshot, throughChangeSeq: 2 } }) };
  });
  (pending.props!.onResolve as () => void)();
  await flush();
  assert.equal(posts.length, 1);
  assert.deepEqual({ id: posts[0].clientRequestId, body: posts[0].body,
    root: posts[0].rootCommentId, mentions: posts[0].mentionUserIds },
  { id: requestId, body: "Exact body", root: "comment", mentions: ["bob"] });
});

for (const action of ["edit", "tombstone"] as const) {
  test(`uncertain ${action} retains one exact mutation for receipt-first recovery`, async () => {
    const feed = await harness();
    feed.setTransport(async (url, init) => {
      if (init?.method === "POST") return { json: async () => ({ ok: false, code: "temporarily_unavailable" }) };
      if (String(url).includes("action=receipt")) throw new Error("receipt unavailable");
      throw new Error("unexpected request");
    });
    const row = find(feed.first, "CommentRow");
    assert.ok(row);
    if (action === "edit") assert.equal(await (row.props!.onEdit as (
      comment: unknown, body: string, mentions: readonly string[],
    ) => Promise<boolean>)(row.props!.comment, "Edited exact body", ["bob"]), true);
    else await (row.props!.onDelete as (comment: unknown) => Promise<void>)(row.props!.comment);
    await flush();
    const pending = find(feed.render(), "PendingRow");
    assert.ok(pending);
    const input = (pending.props!.item as { input: Record<string, unknown> }).input;
    assert.equal(input.action, action);
    assert.equal(input.commentId, "comment");
    assert.equal(input.expectedRevision, 1);
    assert.match(String(input.clientRequestId), action === "edit" ? /^task_comment_edit_/ : /^task_comment_delete_/);
    if (action === "edit") {
      assert.equal(input.body, "Edited exact body");
      assert.deepEqual(Array.from(input.mentionUserIds as readonly string[]), ["bob"]);
    }
  });
}
