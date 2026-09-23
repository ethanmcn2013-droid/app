import assert from "node:assert/strict";
import test from "node:test";
import { loadInboxAttention } from "./attention-loader";
import { authenticateConversationActor } from "./runtime";
import { createMessageAttentionHttp } from "./attention-http";
import type { createMessageAttentionService } from "./attention";

type Service = ReturnType<typeof createMessageAttentionService>;

test("conversation flag off leaves the Inbox and API before opening any 0032/0035/0037 table", async () => {
  const keys = ["SIGNAL_CONVERSATION_INTERNAL_ENABLED", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "TASKS_DATABASE_URL"] as const;
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  let opened = 0;
  const service = async (): Promise<Service> => { opened++; throw new Error("should_not_open_missing_attention_tables"); };
  try {
    process.env.SIGNAL_CONVERSATION_INTERNAL_ENABLED = "false";
    process.env.CLERK_SECRET_KEY = "synthetic_secret_key";
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "synthetic_publishable_key";
    process.env.TASKS_DATABASE_URL = "file:missing_0037_must_not_be_created.db";
    assert.deepEqual(await loadInboxAttention({ authenticate: authenticateConversationActor, service }), { available: true });
    const http = createMessageAttentionHttp({ authenticate: authenticateConversationActor, service });
    const response = await http.GET(new Request("https://app.example.test/api/message-attention?action=list"));
    assert.equal(response.status, 401);
    assert.equal(await authenticateConversationActor(), null);
    assert.equal(opened, 0);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test("attention loader preserves the Tasks Inbox when storage is unavailable", async () => {
  const result = await loadInboxAttention({ authenticate: async () => "canonical_actor", service: async () => { throw new Error("private SQL body"); } });
  assert.deepEqual(result, { available: false });
});
