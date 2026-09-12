import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { assertProjectId } from "../../lib/projects/project-ref";
import { authenticateConversationActor, getConversationService, getConversationTaskOutcomeService } from "./runtime";

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
      const outcomes = await getConversationTaskOutcomeService();
      assert.deepEqual(await outcomes.getTaskDestination({ actorId: "synthetic_alice", projectId: assertProjectId("synthetic_project_a") }), { ok: false, code: "temporarily_unavailable" });
    }
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test("local runtime shares one serialized adapter across conversation and task services", async () => {
  const keys = ["NODE_ENV", "VERCEL", "TASKS_DATABASE_URL", "SIGNAL_CONVERSATION_DATABASE_MODE", "SIGNAL_CONVERSATION_INTERNAL_ENABLED"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const root = process.env.PC08_WORK_DIR ? resolve(process.env.PC08_WORK_DIR) : tmpdir();
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "signal-runtime-pc08-"));
  const databasePath = join(directory, "tasks.db").replaceAll("\\", "/");
  const setup = createClient({ url: `file:${databasePath}` });
  try {
    await setup.execute("PRAGMA foreign_keys=OFF");
    for (const migration of (await readdir(join(resolve(process.cwd()), "drizzle"))).filter((name) => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_").sort()) {
      await setup.executeMultiple(await readFile(join(resolve(process.cwd()), "drizzle", migration), "utf8"));
    }
    const projectId = assertProjectId("synthetic_runtime_project");
    const now = Date.now();
    await setup.batch([
      { sql: "INSERT INTO users(id,clerk_id,name,color,initials) VALUES ('runtime_alice','clerk_runtime_alice','Alice','#111','AA')" },
      { sql: "INSERT INTO workspaces(id,slug,name,owner_user_id,context_type,created_at,updated_at) VALUES (?,'runtime','Runtime Project','runtime_alice','project',?,?)", args: [projectId, now, now] },
      { sql: "INSERT INTO workspace_members(workspace_id,user_id,role,joined_at) VALUES (?,'runtime_alice','owner',?)", args: [projectId, now] },
    ], "write");
    setup.close();
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: "test", TASKS_DATABASE_URL: `file:${databasePath}`,
      SIGNAL_CONVERSATION_DATABASE_MODE: "local", SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true" });
    const [conversation, outcomes] = await Promise.all([getConversationService(), getConversationTaskOutcomeService()]);
    const operations = await Promise.all(Array.from({ length: 20 }, (_, index) => index % 2 === 0
      ? conversation.ensureProjectConversation({ actorId: "runtime_alice", projectId })
      : outcomes.getTaskDestination({ actorId: "runtime_alice", projectId })));
    assert.equal(operations.every((value) => value.ok), true);
    assert.equal((await outcomes.getTaskDestination({ actorId: "runtime_alice", projectId })).ok, true);
  } finally {
    setup.close();
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
});
