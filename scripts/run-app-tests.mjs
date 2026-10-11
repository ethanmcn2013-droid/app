import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const stages = JSON.parse(readFileSync(new URL("./app-test-stages.json", import.meta.url), "utf8"));

/** Run the existing stages directly, avoiding cmd.exe's 8191-character limit. */
export function runAppTests({ commands = stages, execute = spawnSync, env = process.env, write = console.log } = {}) {
  for (const [index, stage] of commands.entries()) {
    if (!Array.isArray(stage) || !["node", "pnpm"].includes(stage[0]) || stage.length < 2 ||
        stage.some(arg => typeof arg !== "string" || !arg || /[\r\n\0]/.test(arg))) throw new Error("Invalid App test stage");
    const [tool, ...args] = stage;
    if (tool === "pnpm" && !env.npm_execpath) throw new Error("Run the App suite with pnpm test so its locked package manager is available");
    write(`App test stage ${index + 1}/${commands.length}: ${tool} ${args[0]}`);
    const result = execute(process.execPath, tool === "node" ? args : [env.npm_execpath, ...args], {
      cwd: fileURLToPath(new URL("..", import.meta.url)), env, stdio: "inherit", shell: false, windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runAppTests();
}
