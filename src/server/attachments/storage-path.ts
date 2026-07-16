import { isAbsolute, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

function safeStorageId(value: string, label: string): string {
  if (value.length < 1 || value.length > 512) {
    throw new Error(`attachments: invalid ${label}`);
  }
  if (SAFE_ID.test(value)) return value;
  return `id-${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

/** Build a path that is provably contained by the configured upload root. */
export function buildAttachmentStoragePath(input: {
  root: string;
  workspaceId: string;
  taskId: string;
  attachmentId: string;
  filename: string;
}): string {
  if (!SAFE_FILENAME.test(input.filename)) {
    throw new Error("attachments: invalid filename");
  }
  const root = resolve(input.root);
  const candidate = resolve(
    root,
    safeStorageId(input.workspaceId, "workspace id"),
    safeStorageId(input.taskId, "task id"),
    `${safeStorageId(input.attachmentId, "attachment id")}-${input.filename}`,
  );
  const fromRoot = relative(root, candidate);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("attachments: storage path escaped upload root");
  }
  return candidate;
}
