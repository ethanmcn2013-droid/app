/** Browser-visible freshness marker for task snapshots, never an auth token. */
export const TASK_SNAPSHOT_EPOCH_COOKIE = "signal_task_snapshot_epoch";
const EPOCH_CHANGED = "signal-task-snapshot-epoch-changed";
const CHANNEL = "signal-task-snapshot-epoch";
const TAB_SOURCE = Math.random().toString(36).slice(2);
const EPOCH_PATTERN = /^[a-f0-9]{32}$/;
let localInvalidationSerial = 0;

export function normalizeTaskSnapshotEpoch(value: string | null | undefined): string | null {
  return typeof value === "string" && EPOCH_PATTERN.test(value) ? value : null;
}

export function readTaskSnapshotEpoch(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const prefix = `${TASK_SNAPSHOT_EPOCH_COOKIE}=`;
    const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
    return normalizeTaskSnapshotEpoch(entry?.slice(prefix.length));
  } catch {
    return null;
  }
}

/** A tab-local read fence also works when browser cookie writes are blocked. */
export function readTaskSnapshotFreshness(): string {
  return `${readTaskSnapshotEpoch() ?? "absent"}:${localInvalidationSerial}`;
}

export function serverTaskSnapshotFreshness(epoch: string | null): string {
  return `${epoch ?? "absent"}:0`;
}

function announceChange(incrementSerial: boolean): void {
  if (incrementSerial) localInvalidationSerial++;
  window.dispatchEvent(new Event(EPOCH_CHANGED));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ source: TAB_SOURCE });
    channel.close();
  }
}

function writeEpoch(value: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${TASK_SNAPSHOT_EPOCH_COOKIE}=${value}; Path=/; SameSite=Lax${secure}`;
    if (readTaskSnapshotEpoch() !== value) return false;
    announceChange(false);
    return true;
  } catch {
    return false;
  }
}

function newEpoch(): string | null {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") return null;
  return crypto.randomUUID().replaceAll("-", "");
}

/** Only mints on absence. A queued gesture never rotates the marker. */
export function ensureTaskSnapshotEpoch(): string | null {
  const current = readTaskSnapshotEpoch();
  if (current) return current;
  const next = newEpoch();
  return next && writeEpoch(next) ? next : null;
}

/** Return null when another tab changed the cookie before this response settled. */
export function rotateTaskSnapshotEpoch(expected: string | null): string | null {
  if (readTaskSnapshotEpoch() !== expected) return null;
  const next = newEpoch();
  return next && writeEpoch(next) ? next : null;
}

/** Invalidate only; never publish a Task list or reuse a captured old marker. */
export function invalidateTaskSnapshotEpoch(): void {
  const next = newEpoch();
  if (next && writeEpoch(next)) return;
  if (typeof window !== "undefined") announceChange(true);
}

export function subscribeTaskSnapshotEpoch(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = () => callback();
  const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
  if (channel) channel.onmessage = (event: MessageEvent) => {
    if (event.data?.source === TAB_SOURCE) return;
    localInvalidationSerial++;
    changed();
  };
  window.addEventListener(EPOCH_CHANGED, changed);
  window.addEventListener("focus", changed);
  document.addEventListener("visibilitychange", changed);
  return () => {
    window.removeEventListener(EPOCH_CHANGED, changed);
    window.removeEventListener("focus", changed);
    document.removeEventListener("visibilitychange", changed);
    channel?.close();
  };
}
