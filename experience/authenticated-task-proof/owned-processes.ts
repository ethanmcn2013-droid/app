import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execute = promisify(execFile);
export type OwnedProcess = { pid: number; parentPid: number; name: string; created: string };
async function inventory(): Promise<OwnedProcess[]> {
  if (process.platform !== "win32" || !process.env.SystemRoot) throw new Error("Windows process custody is required");
  const script = "Get-CimInstance Win32_Process | Where-Object { $_.CreationDate } | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId;name=$_.Name;created=$_.CreationDate.ToUniversalTime().ToString('o')} } | ConvertTo-Json -Compress";
  const { stdout } = await execute(join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 10000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  const decoded = JSON.parse(stdout);
  const rows = Array.isArray(decoded) ? decoded : [decoded];
  if (rows.some(row => !Number.isSafeInteger(row.pid) || !Number.isSafeInteger(row.parentPid) || !row.created || typeof row.name !== "string")) throw new Error("Invalid native process inventory");
  return rows;
}
export async function captureOwnedProcesses(rootPid: number) {
  const all = await inventory();
  const root = all.find(record => record.pid === rootPid);
  if (!root) throw new Error("Owned child process is absent");
  const owned = [root];
  for (let cursor = 0; cursor < owned.length; cursor++) for (const record of all) if (record.parentPid === owned[cursor].pid && !owned.some(existing => existing.pid === record.pid)) owned.push(record);
  return owned;
}
/** Kill only a still-matching native PID+creation-time record captured through
 * the owned child's live ancestry. PID reuse never grants cleanup authority. */
export async function stopRemainingOwnedProcesses(records: OwnedProcess[]) {
  const before = await inventory();
  const remaining = records.filter(record => before.some(live => live.pid === record.pid && live.created === record.created));
  const attempts: { pid: number; created: string; exitCode: number }[] = [];
  const deadline = Date.now() + 60000;
  const roots = remaining.filter(record => !remaining.some(parent => parent.pid === record.parentPid));
  for (const record of roots) {
    if (Date.now() >= deadline) break;
    const current = await inventory();
    if (!current.some(live => live.pid === record.pid && live.created === record.created)) continue;
    try {
      await execute(join(process.env.SystemRoot!, "System32/taskkill.exe"), ["/PID", String(record.pid), "/T", "/F"], { timeout: 10000, windowsHide: true });
      attempts.push({ pid: record.pid, created: record.created, exitCode: 0 });
    } catch { attempts.push({ pid: record.pid, created: record.created, exitCode: 1 }); }
  }
  const after = await inventory();
  return { captured: records, before: remaining, attempts, remaining: records.filter(record => after.some(live => live.pid === record.pid && live.created === record.created)) };
}
