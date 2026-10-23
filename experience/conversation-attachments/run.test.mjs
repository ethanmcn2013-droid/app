import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import os from "node:os";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fixtureEnvironment, fixturePorts, fixtureCommands, assertFreePort, runFixture } from "./run.mjs";

test("browser runtime copies only OS variables and pins demo without provider or database credentials", () => {
  const env = fixtureEnvironment({ PATH: "fixture-path", BLOB_READ_WRITE_TOKEN: "synthetic-do-not-copy", TASKS_DB_URL: "synthetic-db", CLERK_SECRET_KEY: "synthetic-key", SIGNAL_ACCESS_MODE: "production", NODE_OPTIONS: "synthetic-options", CI: "true" });
  assert.equal(env.PATH, "fixture-path"); assert.equal(env.CI, "true"); assert.equal(env.SIGNAL_ACCESS_MODE, "demo");
  for (const key of ["BLOB_READ_WRITE_TOKEN", "TASKS_DB_URL", "CLERK_SECRET_KEY", "NODE_OPTIONS"]) assert.equal(key in env, false);
  assert.equal(env.NODE_ENV, "development");
});
test("ports are explicit, distinct, bounded and never reuse an occupied listener", async () => {
  assert.deepEqual(fixturePorts({}), { next: 3448, proxy: 3449 });
  assert.throws(() => fixturePorts({ CONVERSATION_ATTACHMENT_NEXT_PORT: "22" }));
  assert.throws(() => fixturePorts({ CONVERSATION_ATTACHMENT_NEXT_PORT: "3449" }));
  const server = net.createServer(); await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try { await assert.rejects(assertFreePort(port), error => error.code === "EADDRINUSE"); assert.equal(server.listening, true); }
  finally { await new Promise(resolve => server.close(resolve)); }
  await assertFreePort(port);
});
test("commands target actual dev client and synthetic backend with exact loopback origin", () => {
  const commands = fixtureCommands("/fixture/root", { next: 3448, proxy: 3449 }, "/fixture/output");
  assert.deepEqual(commands.browser, ["experience/conversation-attachments/browser.mjs", "http://127.0.0.1:3449", path.join("/fixture/output", "browser")]);
  assert.ok(commands.proxy.includes("scripts/conversations/preview-server.ts")); assert.ok(commands.proxy.includes("./src/test/register-server-only.mjs"));
  assert.ok(commands.next.includes("dev")); assert.equal(commands.next.includes("build"), false);
});
test("a loaded dotenv checkout is refused before any process or output is created", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "conversation-files-env-"));
  const file = path.join(directory, ".env");
  try {
    await writeFile(file, "SYNTHETIC_FIXTURE_ONLY=1\n");
    await assert.rejects(runFixture({ root: directory, source: {} }), /Refusing \.env/);
  } finally { await unlink(file); await rmdir(directory); }
});
test("canonical App suite discovers every shared attachment test and required browser workflow retains evidence", () => {
  const root = new URL("../../", import.meta.url);
  const stages = JSON.parse(readFileSync(new URL("scripts/app-test-stages.json", root), "utf8"));
  assert.equal(stages.filter(stage => stage[0] === "pnpm" && stage[1] === "test:conversations").length, 1);
  assert.equal(stages.filter(stage => stage.includes("experience/conversation-attachments/run.test.mjs")).length, 1);
  const discovery = readFileSync(new URL("scripts/conversations/check.mjs", root), "utf8");
  for (const directory of ["src/lib/conversations", "src/server/conversations", "src/components/app/messages"]) assert.ok(discovery.includes(directory));
  assert.match(discovery, /endsWith\("\.test\.ts"\)/);
  const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  assert.equal(pkg.scripts["test:conversation-attachments:browser"], "node experience/conversation-attachments/run.mjs");
  const quality = readFileSync(new URL(".github/workflows/design-quality.yml", root), "utf8");
  assert.match(quality, /run: pnpm test:conversation-attachments:browser/);
  assert.match(quality, /experience\/output\/conversation-attachments/);
  const candidate = readFileSync(new URL(".github/workflows/experience-candidate-capture.yml", root), "utf8");
  const candidateJobCondition = candidate.split("\n").find(line => line.trimStart().startsWith("if: contains(fromJSON("));
  assert.ok(candidateJobCondition?.includes('"feat/conversation-files-runtime-release-oct23"'));
  assert.ok(candidateJobCondition.includes("github.event.pull_request.head.repo.full_name == github.repository"));
  assert.match(candidate, /run: pnpm test:conversation-attachments:browser/);
  assert.match(candidate, /experience\/output\/conversation-attachments/);
});
