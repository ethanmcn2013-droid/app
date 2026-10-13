import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { validateProofInput, type ProofInput } from "./fixture";
import { captureOwnedProcesses, stopRemainingOwnedProcesses, type OwnedProcess } from "./owned-processes";

/** Parent cleanup custody survives child failures and native SQLite handles.
 * Requires the separately reviewed private runtime admission input. */
async function launch(path: string) {
  const input = validateProofInput(JSON.parse(readFileSync(resolve(path), "utf8")) as ProofInput);
  const ownedRoot = resolve(input.storeRoot);
  if (existsSync(ownedRoot) || existsSync(input.evidenceRoot)) throw new Error("Owned runtime roots must be fresh");
  let childExit: number | null = null;
  let childSignal: string | null = null;
  const owned = new Map<string, OwnedProcess>();
  const custodyErrors: string[] = [];
  try {
    childExit = await new Promise<number | null>((accept, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "experience/authenticated-task-proof/run.ts", resolve(path)], { cwd: process.cwd(), env: process.env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
      const capture = async (requiredPid?: number) => {
        const records = await captureOwnedProcesses(child.pid!);
        for (const record of records) owned.set(`${record.pid}:${record.created}`, record);
        if (requiredPid !== undefined && !records.some(record => record.pid === requiredPid)) throw new Error("Spawned process ancestry mismatch");
        return records;
      };
      let forcedStop: ReturnType<typeof setTimeout> | undefined;
      let stopRequested = false;
      const requestStop = () => {
        if (stopRequested || child.exitCode !== null) return;
        stopRequested = true;
        forcedStop = setTimeout(() => { if (child.exitCode === null) child.kill(); }, 20000);
        void capture().catch(() => custodyErrors.push("interruption-capture-failed")).finally(() => { if (child.connected) child.send({ type: "stop-owned-proof" }); });
      };
      const expiry = setTimeout(requestStop, Math.max(1, Date.parse(input.runtimeGrant.expiresAt) - Date.now()));
      process.once("SIGINT", requestStop); process.once("SIGTERM", requestStop);
      child.on("message", message => {
        const checkpoint = message as { type?: string; id?: string; name?: string; pid?: number };
        if (checkpoint.type !== "custody-checkpoint" || typeof checkpoint.id !== "string" || typeof checkpoint.name !== "string") return;
        void capture(checkpoint.pid).then(records => {
          writeFileSync(resolve(input.evidenceRoot, "owned-process-custody.json"), JSON.stringify({ owned: [...owned.values()], checkpoint: checkpoint.name, observed: records }, null, 2));
          if (child.connected) child.send({ type: "custody-ack", id: checkpoint.id, ok: true });
        }).catch(() => { custodyErrors.push(`capture-failed:${checkpoint.name}`); if (child.connected) child.send({ type: "custody-ack", id: checkpoint.id, ok: false }); });
      });
      child.once("spawn", () => { void capture().catch(() => { custodyErrors.push("initial-child-capture-failed"); requestStop(); }); });
      const finish = () => { clearTimeout(expiry); if (forcedStop) clearTimeout(forcedStop); process.off("SIGINT", requestStop); process.off("SIGTERM", requestStop); };
      child.once("error", error => { finish(); reject(error); }); child.once("exit", (code, signal) => { childSignal = signal; finish(); accept(code); });
    });
  } finally {
    // This root was confirmed unoccupied before the admitted child could create
    // it. No computed enumeration is used for destructive operations.
    let cleanup = false;
    let processReceipt: Awaited<ReturnType<typeof stopRemainingOwnedProcesses>> | undefined;
    try { processReceipt = await stopRemainingOwnedProcesses([...owned.values()]); } catch { custodyErrors.push("terminal-native-inventory-failed"); }
    const processesGone = !!processReceipt && processReceipt.captured.length > 0 && processReceipt.remaining.length === 0 && custodyErrors.length === 0;
    if (processesGone) try { rmSync(ownedRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); cleanup = !existsSync(ownedRoot); } catch { /* preserve failed cleanup */ }
    mkdirSync(input.evidenceRoot, { recursive: true });
    const { createHash } = await import("node:crypto");
    const serverDiagnostics = readdirSync(input.evidenceRoot).filter(file => /^server-\d+\.sanitized\.log$/.test(file)).map(file => { const bytes = readFileSync(resolve(input.evidenceRoot, file)); return { file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; });
    writeFileSync(resolve(input.evidenceRoot, "parent-exit-cleanup.json"), JSON.stringify({ childExit, childSignal, processReceipt, custodyErrors, serverDiagnostics, ownedStoreCleanup: cleanup, ownedRootSha256: createHash("sha256").update(ownedRoot).digest("hex") }, null, 2));
    if (!cleanup) throw new Error("Owned store cleanup failed");
  }
  if (childExit !== 0) throw new Error("Receiving proof failed; original denominator retained");
}
if (!process.argv[2]) throw new Error("Private runtime admission path required");
launch(process.argv[2]).catch(() => { console.error("Receiving proof or cleanup failed; inspect private evidence."); process.exitCode = 1; });
