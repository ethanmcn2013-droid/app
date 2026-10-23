/** Canonical, credential-free actual-client fixture. Starts/stops only its own processes. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function fixtureEnvironment(source) {
  const env = {};
  for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "CI"]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  return { ...env, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", SIGNAL_ACCESS_MODE: "demo", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "demo", SIGNAL_ACTIVE_PROJECT_V3_ENABLED: "true" };
}
export function fixturePorts(source) {
  const next = Number(source.CONVERSATION_ATTACHMENT_NEXT_PORT ?? 3448);
  const proxy = Number(source.CONVERSATION_ATTACHMENT_PROXY_PORT ?? 3449);
  for (const value of [next, proxy]) assert.ok(Number.isInteger(value) && value >= 1024 && value <= 65535, "Invalid fixture port");
  assert.notEqual(next, proxy, "Fixture ports must differ");
  return { next, proxy };
}
export async function assertFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once("error", reject);
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
export function fixtureCommands(root, ports, output) {
  return {
    next: [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(ports.next)],
    proxy: ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "scripts/conversations/preview-server.ts", path.join(output, "fixture"), String(ports.proxy), String(ports.next)],
    browser: ["experience/conversation-attachments/browser.mjs", `http://127.0.0.1:${ports.proxy}`, path.join(output, "browser")],
  };
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function ready(url, child, limit = 180_000) {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline) {
    if (child.fixtureError) throw child.fixtureError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Owned fixture exited before readiness: ${url}`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(20_000) }); if (response.ok) return; } catch { /* This owned server is starting. */ }
    await delay(300);
  }
  throw new Error(`Owned fixture readiness timed out: ${url}`);
}
async function listening(port, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.fixtureError) throw child.fixtureError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("Owned fixture proxy exited before readiness");
    const connected = await new Promise(resolve => { const socket = net.connect(port, "127.0.0.1"); socket.once("connect", () => { socket.destroy(); resolve(true); }); socket.once("error", () => { socket.destroy(); resolve(false); }); });
    if (connected) return;
    await delay(200);
  }
  throw new Error("Owned fixture proxy readiness timed out");
}
export async function runFixture({ root = fileURLToPath(new URL("../../", import.meta.url)), source = process.env } = {}) {
  for (const name of [".env", ".env.local", ".env.development", ".env.development.local"]) {
    assert.equal(await fs.access(path.join(root, name)).then(() => true, () => false), false, `Refusing ${name}; use a credential-free checkout`);
  }
  const output = path.resolve(source.CONVERSATION_ATTACHMENT_BROWSER_OUTPUT ?? path.join(root, "experience/output/conversation-attachments"));
  await fs.mkdir(output, { recursive: true });
  const receiptPath = path.join(output, "run-receipt.json");
  assert.equal(await fs.access(receiptPath).then(() => true, () => false), false, "Use a fresh evidence output directory");
  const ports = fixturePorts(source); await assertFreePort(ports.next); await assertFreePort(ports.proxy);
  const env = fixtureEnvironment(source); const commands = fixtureCommands(root, ports, output); const children = []; const logs = [];
  const receipt = { revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), synthetic: true, startedAt: new Date().toISOString(), root, ports, commands, status: "running", processes: [], cleanup: [] };
  function start(name) {
    const logPath = path.join(output, `${name}.log`); const log = createWriteStream(logPath); logs.push(log);
    const child = spawn(process.execPath, commands[name], { cwd: root, env, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    child.on("error", error => { child.fixtureError = error; });
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); children.push(child); receipt.processes.push({ name, pid: child.pid, log: logPath });
    return child;
  }
  let cleanupStarted = false;
  async function cleanup() {
    if (cleanupStarted) return; cleanupStarted = true;
    for (const child of [...children].reverse()) {
      if (child.exitCode !== null || child.signalCode !== null) continue;
      try {
        if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
        else process.kill(-child.pid, "SIGTERM");
      } catch { /* An owned child may already have exited. */ }
    }
    await Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : new Promise(resolve => { const timer = setTimeout(resolve, 3000); child.once("close", () => { clearTimeout(timer); resolve(); }); })));
    for (const log of logs) log.end();
    for (const port of [ports.next, ports.proxy]) {
      let closed = false;
      for (let attempt = 0; attempt < 30; attempt++) { try { await assertFreePort(port); closed = true; break; } catch { await delay(100); } }
      receipt.cleanup.push({ port, closed });
    }
  }
  const interrupted = () => { void cleanup().finally(() => { process.exitCode = 130; }); };
  process.once("SIGINT", interrupted); process.once("SIGTERM", interrupted);
  try {
    const next = start("next"); const proxy = start("proxy");
    await listening(ports.proxy, proxy);
    await ready(`http://127.0.0.1:${ports.next}/lab/project-conversation/live?actor=alice`, next);
    const browser = start("browser");
    const code = await new Promise((resolve, reject) => { browser.once("error", reject); browser.once("exit", code => resolve(code ?? 1)); });
    assert.equal(code, 0, "Actual conversation attachment browser assertions failed");
    receipt.status = "passed";
  } catch (error) {
    receipt.status = "failed"; receipt.error = error instanceof Error ? error.message : String(error); throw error;
  } finally {
    await cleanup(); process.removeListener("SIGINT", interrupted); process.removeListener("SIGTERM", interrupted);
    receipt.finishedAt = new Date().toISOString(); await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2));
    if (receipt.status === "failed") for (const name of ["next", "proxy", "browser"]) { const text = await fs.readFile(path.join(output, `${name}.log`), "utf8").catch(() => ""); console.error(`${name}: ${text.slice(-8000)}`); }
  }
  assert.ok(receipt.cleanup.every(item => item.closed), "Owned fixture listeners did not close");
  console.log(JSON.stringify({ status: receipt.status, revision: receipt.revision, output }));
  return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runFixture();
