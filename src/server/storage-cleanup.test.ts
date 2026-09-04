import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  deleteBytes,
  deleteBytesConfirmed,
  deleteStorageKeyConfirmed,
  resolveDiskStorageKeyDeleteTarget,
  resolveStorageKeyDeleteTarget,
  resolveStoredPathDeleteTarget,
  uploadsRoot,
} from "./storage";

const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
const originalVercel = process.env.VERCEL;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  while (temporaryDirectories.length) {
    await rm(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("strict storage-key cleanup", () => {
  it("passes a client-direct Blob pathname to Blob unchanged", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    delete process.env.VERCEL;
    const key = "ws-a/task-a/att-1234-file.pdf";
    assert.deepEqual(resolveStorageKeyDeleteTarget(key), {
      kind: "blob",
      locator: key,
    });
  });

  it("maps a local key under uploadsRoot and makes missing replay success", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL;
    await mkdir(uploadsRoot(), { recursive: true });
    const directory = await mkdtemp(join(uploadsRoot(), "cleanup-test-"));
    temporaryDirectories.push(directory);
    const key = `${basename(directory)}/object.bin`;
    const file = join(directory, "object.bin");
    await writeFile(file, Buffer.from("owned bytes"));

    assert.deepEqual(resolveStorageKeyDeleteTarget(key), {
      kind: "disk",
      absPath: file,
    });
    await deleteStorageKeyConfirmed(key);
    await assert.rejects(() => stat(file), { code: "ENOENT" });
    await deleteStorageKeyConfirmed(key);
  });

  it("refuses traversal and absolute targets before touching a backend", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL;
    for (const unsafe of ["../outside", "a/../outside", "/absolute", "a\\b"]) {
      assert.throws(() => resolveStorageKeyDeleteTarget(unsafe), TypeError);
    }
  });

  it("resolves a legacy relative stored path once and only beneath uploadsRoot", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL;
    await mkdir(uploadsRoot(), { recursive: true });
    const directory = await mkdtemp(join(uploadsRoot(), "legacy-cleanup-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "legacy.bin");
    await writeFile(file, Buffer.from("legacy bytes"));
    const legacyStoredPath = `.data/uploads/${basename(directory)}/legacy.bin`;

    assert.deepEqual(resolveStoredPathDeleteTarget(legacyStoredPath), {
      kind: "disk",
      absPath: file,
    });
    await deleteBytesConfirmed(legacyStoredPath);
    await assert.rejects(() => stat(file), { code: "ENOENT" });
    await deleteBytesConfirmed(legacyStoredPath);
    await writeFile(file, Buffer.from("legacy bytes again"));
    await deleteBytes(legacyStoredPath);
    await assert.rejects(() => stat(file), { code: "ENOENT" });
    for (const unsafe of [
      "../outside",
      "uploads/outside",
      ".data/uploads/../outside",
    ]) {
      assert.throws(() => resolveStoredPathDeleteTarget(unsafe), TypeError);
    }
  });

  it("keeps a disk key on disk even when Blob credentials later appear", () => {
    process.env.BLOB_READ_WRITE_TOKEN = "new-token";
    delete process.env.VERCEL;
    const key = "ws-a/task-a/att-disk-file.pdf";
    assert.deepEqual(resolveDiskStorageKeyDeleteTarget(key), {
      kind: "disk",
      absPath: join(uploadsRoot(), ...key.split("/")),
    });
  });
});
