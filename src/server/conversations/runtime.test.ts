import assert from "node:assert/strict";
import test from "node:test";
import { assertProjectId } from "../../lib/projects/project-ref";
import { authenticateConversationActor, getConversationService } from "./runtime";

test("runtime refuses remote, production, memory and missing configuration without opening storage or inventing identity", async () => {
  const keys = ["NODE_ENV", "VERCEL", "TASKS_DATABASE_URL", "SIGNAL_CONVERSATION_DATABASE_MODE", "SIGNAL_CONVERSATION_INTERNAL_ENABLED", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const cases = [
      {},
      { SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_DATABASE_MODE: "local", TASKS_DATABASE_URL: "file::memory:" },
      { SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_DATABASE_MODE: "local", TASKS_DATABASE_URL: "libsql://unreachable.invalid" },
      { SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_DATABASE_MODE: "local", TASKS_DATABASE_URL: "file:must-not-create.db", NODE_ENV: "production" },
      { SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_DATABASE_MODE: "local", TASKS_DATABASE_URL: "file:must-not-create.db", VERCEL: "1" },
    ];
    for (const values of cases) {
      for (const key of keys) delete process.env[key];
      Object.assign(process.env, values);
      assert.equal(await authenticateConversationActor(), null);
      const service = await getConversationService();
      assert.deepEqual(await service.getProjectConversation({ actorId: "synthetic_alice", projectId: assertProjectId("synthetic_project_a") }), { ok: false, code: "temporarily_unavailable" });
    }
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
