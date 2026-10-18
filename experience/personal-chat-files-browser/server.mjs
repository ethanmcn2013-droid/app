import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const contract = JSON.parse(readFileSync(path.join(root, "experience/browser-contract.json"), "utf8"));
if (contract.determinism.accessMode !== "demo" || contract.determinism.deploymentEnvironment !== "preview") {
  throw new Error("This credential-free suite requires the canonical demo/preview build contract");
}
// Next loads dotenv independently of its inherited environment. Refuse loaded
// dotenv files rather than accidentally reconnecting an operator's providers.
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (existsSync(path.join(root, name))) throw new Error(`Refusing ${name}; use a credential-free checkout`);
}
const env = {};
for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE", "CI", "NO_COLOR"]) {
  if (process.env[key] !== undefined) env[key] = process.env[key];
}
Object.assign(env, {
  NODE_ENV: "production",
  NODE_OPTIONS: "--max-old-space-size=6144",
  NEXT_TELEMETRY_DISABLED: "1",
  VERCEL_ENV: contract.determinism.deploymentEnvironment,
  SIGNAL_ACCESS_MODE: contract.determinism.accessMode,
  NEXT_PUBLIC_SIGNAL_ACCESS_MODE: contract.determinism.accessMode,
  NEXT_PUBLIC_TASKS_FIRST_COMPLETION: "off",
  SIGNAL_ANALYTICS_V1_ENABLED: "false",
  SIGNAL_HOME_ANALYTICS_ENABLED: "false",
  SIGNAL_ACTIVE_PROJECT_V3_ENABLED: "true",
});
let child;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child?.kill(signal));
async function run(args) {
  const code = await new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
  if (code !== 0) process.exit(Number(code));
}
const mode = process.argv[2];
if (mode === "build") {
  await run([require.resolve("next/dist/bin/next"), "build"]);
  await run([path.join(root, "scripts/check-v3-tokens.mjs"), "--built"]);
} else if (mode === "start") {
  const port = Number(process.argv[3]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid browser-suite port");
  // Fail on any occupied TCP port, including a non-HTTP listener. No reuse,
  // process lookup, termination or fallback to another operator's server.
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
  if (!existsSync(path.join(root, ".next/BUILD_ID"))) throw new Error("Run the canonical demo/preview production build first");
  await run([require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)]);
} else throw new Error("Usage: node experience/personal-chat-files-browser/server.mjs build | start <port>");
