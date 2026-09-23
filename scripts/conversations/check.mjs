/** Conversation checks always run with isolated synthetic state and no provider settings. */
import { readdirSync, mkdirSync, mkdtempSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const parent = resolve(process.env.CONVERSATION_TEST_WORK_DIR ?? join(root, "work", "conversation-checks"));
mkdirSync(parent, { recursive: true });
const directory = mkdtempSync(join(parent, "run-"));
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/^(TASKS_|NOTES_|TIMELINE_|SIGNAL_|NEXT_PUBLIC_|CLERK_|SENTRY_|RESEND_|STRIPE_|BLOB_|OPENAI_|ANTHROPIC_|VERCEL_|CRON_|OUTBOX_)/.test(key)) delete environment[key];
}
environment.PC06_WORK_DIR = directory;
environment.PC08_WORK_DIR = directory;
const files = ["src/lib/conversations", "src/server/conversations", "src/components/app/messages", "src/components/app/task-detail"]
  .flatMap((folder) => readdirSync(join(root, folder)).filter((name) => name.endsWith(".test.ts")).map((name) => `${folder}/${name}`));
// The task creation core retains its own domain folder.
try {
  files.push(...readdirSync(join(root, "src/server/tasks")).filter((name) => (name.includes("conversation") || name === "create-task-core.test.ts") && name.endsWith(".test.ts")).map((name) => `src/server/tasks/${name}`));
} catch (error) { if (error.code !== "ENOENT") throw error; }
const result = spawnSync(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "--test", ...files.sort()], { cwd: root, env: environment, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
