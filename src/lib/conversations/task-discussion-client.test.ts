import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { ConversationPoller } from "./polling";

const requireFromRepo = createRequire(resolve("package.json"));

async function harness(outgoingCache?: Map<string, unknown>) {
  const ts = requireFromRepo("typescript") as typeof import("typescript");
  const source = await readFile(resolve("src/components/app/detail-panel/conversation-feed.tsx"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const states: unknown[] = [];
  const effects: Array<() => void | (() => void)> = [];
  const scheduled = new Map<number, () => void>();
  let nextTimer = 1;
  let slot = 0;
  let transport: (url: unknown, init?: RequestInit) => Promise<{ json(): Promise<unknown> }> = async () => {
    throw new Error("unexpected transport");
  };
  const element = (type: unknown, props: unknown) => ({ type, props });
  const clock = {
    set(callback: () => void) {
      const timer = nextTimer++;
      scheduled.set(timer, callback);
      return timer as unknown as ReturnType<typeof setTimeout>;
    },
    clear(timer: ReturnType<typeof setTimeout>) { scheduled.delete(Number(timer)); },
  };
  class HarnessConversationPoller<T> extends ConversationPoller<T> {
    constructor(options: ConstructorParameters<typeof ConversationPoller<T>>[0]) {
      super({ ...options, clock });
    }
  }
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
    document: { visibilityState: "visible", hasFocus: () => true,
      addEventListener: () => {}, removeEventListener: () => {} },
    window: { addEventListener: () => {}, removeEventListener: () => {},
      matchMedia: () => ({ matches: false }) },
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
      if (id === "@/lib/conversations/polling") return { ConversationPoller: HarnessConversationPoller };
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
  return { snapshot, first, render, setTransport: (next: typeof transport) => { transport = next; },
    poll: async () => {
      const next = scheduled.entries().next().value as [number, () => void] | undefined;
      assert.ok(next, "poller scheduled a request");
      scheduled.delete(next[0]);
      next[1]();
      for (let index = 0; index < 100 && scheduled.size === 0; index++) await Promise.resolve();
    } };
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

function textContent(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  return textContent((node as ElementNode)?.props?.children);
}

const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

test("the real poller path clears canonical content after access revocation", async () => {
  const feed = await harness();
  feed.setTransport(async () => ({ json: async () => ({ ok: false, code: "unavailable" }) }));
  await feed.poll();
  const current = feed.render();
  assert.equal(current?.props?.["data-discussion-unavailable"], true);
});

test("the real poller path requires review after an audience expansion", async () => {
  const feed = await harness();
  feed.setTransport(async (url) => ({ json: async () => String(url).includes("action=history")
    ? { ok: true, value: { audienceEpoch: 2, throughChangeSeq: 2, comments: [], hasMore: false } }
    : { ok: true, value: { ...feed.snapshot, audienceEpoch: 2, throughChangeSeq: 2 } } }));
  await feed.poll();
  const composer = find(feed.render(), "Composer");
  assert.ok(composer);
  let posts = 0;
  feed.setTransport(async (_url, init) => {
    if (init?.method === "POST") posts++;
    return { json: async () => ({ ok: false, code: "temporarily_unavailable" }) };
  });
  assert.equal(await (composer.props!.onSubmit as (
    body: string, mentions: readonly string[], root: string | null,
  ) => Promise<boolean>)("Retained draft", [], null), false);
  assert.equal(posts, 0);
});

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
  const pendingView = (pending.type as unknown as (props: unknown) => unknown)(pending.props);
  assert.doesNotMatch(textContent(pendingView), /Discard/,
    "an uncertain request may already be committed and cannot be presented as discardable");
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
