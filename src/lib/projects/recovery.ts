import { parseProjectId } from "./project-ref";

export const RECOVERY_PAGE_SIZE = 20;
export type RecoveryCursor = { links?: number; files?: number; publications?: number };
export type RecoveryPage<T> = { items: T[]; next: number | null };
export type RecoveryUnavailable = { kind: "unavailable" };
export type RecoveryShare = {
  row: number;
  fingerprint: string;
  createdAt: string;
  state: "active" | "expired" | "revoked";
};
export type RecoveryFile = { id: string; filename: string; bytes: number };
export type TasksRecovery = RecoveryUnavailable | {
  kind: "ready";
  project: { id: string; name: string; archived: boolean };
  canDelete: boolean;
  canUnpublish: boolean;
  published: boolean;
  deletionPending: boolean;
  links: RecoveryPage<RecoveryShare>;
  files: RecoveryPage<RecoveryFile>;
};
export type TimelineRecovery = RecoveryUnavailable | {
  kind: "ready";
  publications: RecoveryPage<{ id: string; createdAt: string; state: string }>;
};
export type ProjectRecovery = {
  projectId: string | null;
  tasks: TasksRecovery;
  timeline: TimelineRecovery;
};
export type RecoveryActionResult =
  | { ok: true; deleted?: boolean }
  | { ok: false; message: string };

export function recoveryCursor(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^[1-9]\d{0,15}$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** Independent Settings entry. A URL candidate never supplies authority. */
export function projectRecoveryPath(projectId: string, cursor: RecoveryCursor = {}): string {
  if (!parseProjectId(projectId)) throw new TypeError("Invalid project");
  const query = new URLSearchParams();
  for (const key of ["links", "files", "publications"] as const) {
    const value = cursor[key];
    if (value !== undefined && Number.isSafeInteger(value) && value > 0) query.set(key, String(value));
  }
  return `/settings/projects/${encodeURIComponent(projectId)}/recovery${query.size ? `?${query}` : ""}`;
}
