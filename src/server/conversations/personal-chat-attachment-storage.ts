import "server-only";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { uploadsRoot, resolveDiskStorageKeyDeleteTarget } from "@/server/storage";

export type PersonalStorageBackend = "disk" | "blob";
export type PersonalWriteAdmission = { deadline: number; signal: AbortSignal; admit: () => Promise<boolean> };
/** settled means this invocation cannot land another write, not that bytes are absent. */
export class PersonalAttachmentWriteError extends Error {
  constructor(readonly settled: boolean) { super("personal_attachment_write_failed"); }
}
export type PersonalAttachmentStorage = {
  backend: () => PersonalStorageBackend | null;
  identity: (backend: string) => string | null;
  put: (key: string, bytes: Uint8Array, mime: string, backend: PersonalStorageBackend, identity: string, admission: PersonalWriteAdmission) => Promise<string>;
  remove: (backend: string, key: string, identity: string) => Promise<void>;
  open?: (row: Record<string, unknown>) => Promise<ReadableStream<Uint8Array> | null>;
};
type BlobPort = {
  put: (key: string, bytes: Uint8Array, mime: string, signal: AbortSignal, token: string, beforePut: () => Promise<void>) => Promise<string>;
  remove: (key: string, token: string) => Promise<void>;
  open: (url: string, token: string) => Promise<ReadableStream<Uint8Array> | null>;
};
const blobPort: BlobPort = {
  async put(key, bytes, mime, signal, token, beforePut) {
    const blob = await import("@vercel/blob");
    await beforePut();
    return (await blob.put(key, Buffer.from(bytes), { access: "private", contentType: mime, addRandomSuffix: false, abortSignal: signal, token })).url;
  },
  async remove(key, token) {
    const blob = await import("@vercel/blob");
    try { await blob.del(key, { token }); }
    catch (error) { if (!(error instanceof blob.BlobNotFoundError)) throw error; }
  },
  async open(url, token) {
    const blob = await import("@vercel/blob");
    const result = await blob.get(url, { access: "private", token });
    return result?.statusCode === 200 ? result.stream : null;
  },
};

/**
 * Personal files pin credentials/root; never use ambient SDK storage selection.
 * Token rotation (even within one store) defers access/cleanup until the original
 * credential is restored or a separately reviewed store reconciliation occurs.
 * A rejected remote PUT cannot prove terminal completion. Its durable custody
 * must survive indefinitely; neither a timeout nor a later 404 is such proof.
 * No automatic reconciliation or universal rollback is offered by this seam.
 */
export function createPersonalAttachmentStorage(options: {
  env?: () => Readonly<{ BLOB_READ_WRITE_TOKEN?: string; VERCEL?: string }>; root?: () => string; now?: () => number; blob?: BlobPort;
  disk?: { mkdir: (directory: string) => Promise<void>; write: (path: string, bytes: Uint8Array, signal: AbortSignal) => Promise<void>; remove: (path: string) => Promise<void> };
} = {}): PersonalAttachmentStorage {
  const env = options.env ?? (() => process.env);
  const root = () => resolve((options.root ?? uploadsRoot)());
  const now = options.now ?? Date.now;
  const blob = options.blob ?? blobPort;
  const disk = options.disk ?? {
    mkdir: (directory: string) => mkdir(directory, { recursive: true }).then(() => undefined),
    write: (path: string, bytes: Uint8Array, signal: AbortSignal) => writeFile(path, bytes, { signal }),
    remove: async (path: string) => { try { await unlink(path); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } },
  };
  const token = () => env().BLOB_READ_WRITE_TOKEN || null;
  const identity = (backend: string): string | null => backend === "disk" ? `disk:${root()}` : backend === "blob" && token() ? `blob-credential:${createHash("sha256").update(token()!).digest("hex")}` : null;
  function capture(backend: string, expected: string) {
    const credential = token();
    if (!expected || identity(backend) !== expected) throw new Error("personal_attachment_store_changed");
    return credential;
  }
  function diskPath(key: string) {
    // Reuse exact-key validation. Root is also checked against the pinned identity.
    const validated = resolveDiskStorageKeyDeleteTarget(key);
    const relativeKey = key.split("/");
    return options.root ? resolve(root(), ...relativeKey) : validated.absPath;
  }
  return {
    backend: () => token() ? "blob" : env().VERCEL === "1" ? null : "disk",
    identity,
    async put(key, bytes, mime, backend, expected, admission) {
      let admitted = false;
      const eligible = async () => {
        capture(backend, expected);
        if (admission.signal.aborted || now() >= admission.deadline || !await admission.admit()) throw new PersonalAttachmentWriteError(true);
        // The durable check can itself suspend beyond the original absolute grant.
        capture(backend, expected);
        if (admission.signal.aborted || now() >= admission.deadline) throw new PersonalAttachmentWriteError(true);
      };
      try {
        const credential = capture(backend, expected);
        if (backend === "disk") {
          const path = diskPath(key);
          if (admission.signal.aborted || now() >= admission.deadline) throw new PersonalAttachmentWriteError(true);
          await disk.mkdir(dirname(path));
          await eligible();
          admitted = true;
          // Await even a partial-write failure before proving this writer terminal.
          await disk.write(path, bytes, admission.signal);
          return path;
        }
        await eligible();
        admitted = true;
        return await blob.put(key, bytes, mime, admission.signal, credential!, eligible);
      } catch (error) {
        if (error instanceof PersonalAttachmentWriteError) throw error;
        throw new PersonalAttachmentWriteError(!admitted || backend === "disk");
      }
    },
    async remove(backend, key, expected) {
      const credential = capture(backend, expected);
      if (backend === "disk") await disk.remove(diskPath(key));
      else if (backend === "blob") await blob.remove(key, credential!);
      else throw new Error("invalid_attachment_backend");
    },
    async open(row) {
      const backend = String(row.backend);
      const credential = capture(backend, String(row.store_identity));
      if (backend === "blob") return blob.open(String(row.stored_path), credential!);
      if (backend !== "disk" || resolve(String(row.stored_path)) !== diskPath(String(row.storage_key))) return null;
      return Readable.toWeb(createReadStream(String(row.stored_path))) as ReadableStream<Uint8Array>;
    },
  };
}
export const personalAttachmentStorage = createPersonalAttachmentStorage();
