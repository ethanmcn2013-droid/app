import { spawn } from "node:child_process";
import path from "node:path";

const port = process.env.TASKS_LAB_PORT ?? "4317";
const nextBin = path.resolve("node_modules", "next", "dist", "bin", "next");
const base = `http://127.0.0.1:${port}/__design-lab/tasks`;

console.log("Tasks design lab · Phase 1 local comparison");
console.log(`Base: ${base}`);
console.log(`Option A Board: ${base}?option=a&view=board&dataset=normal&density=compact&mode=default`);
console.log("Session-only fixture; reload resets. Production data is not connected.");

const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    SIGNAL_ACCESS_MODE: "review",
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review",
    SIGNAL_TASKS_DESIGN_LAB: "true",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 0;
});
