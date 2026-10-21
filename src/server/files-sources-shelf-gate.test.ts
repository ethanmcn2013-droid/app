import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { callerIsAdmin } from "./admin";
import { filesSourcesShelfEnabled, type FilesShelfGateDeps } from "./files-sources-shelf-gate";

/**
 * The Files Sources + shelf gate: operators only, everyone else unchanged,
 * and any failure answers false. The admin decision is the real
 * `callerIsAdmin` over ADMIN_USER_IDS; only the caller is stubbed.
 *
 * Run with: node --import tsx --import ./src/test/register-server-only.mjs --test src/server/files-sources-shelf-gate.test.ts
 */

function deps(over: Partial<FilesShelfGateDeps>): FilesShelfGateDeps {
  return { currentUser: async () => "user_member", isAdmin: callerIsAdmin, demo: () => false, ...over };
}

function withAdmins<T>(ids: string, run: () => Promise<T>): Promise<T> {
  const before = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_USER_IDS = ids;
  return run().finally(() => {
    if (before === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = before;
  });
}

test("a signed-in member who is not an operator keeps today's Files page", async () => {
  await withAdmins("user_operator", async () => {
    assert.equal(await filesSourcesShelfEnabled(deps({ currentUser: async () => "user_member" })), false);
  });
});

test("an operator named in ADMIN_USER_IDS sees the shelf", async () => {
  await withAdmins("user_other, user_operator", async () => {
    assert.equal(await filesSourcesShelfEnabled(deps({ currentUser: async () => "user_operator" })), true);
  });
});

test("the gate fails closed when the caller cannot be resolved", async () => {
  await withAdmins("user_operator", async () => {
    const failing = deps({ currentUser: async () => { throw new Error("no session"); } });
    assert.equal(await filesSourcesShelfEnabled(failing), false);
  });
});

test("the gate fails closed when the admin decision throws or is not a plain yes", async () => {
  const throwing = deps({ currentUser: async () => "user_operator", isAdmin: () => { throw new Error("bad config"); } });
  assert.equal(await filesSourcesShelfEnabled(throwing), false);
  const truthy = deps({ currentUser: async () => "user_operator", isAdmin: (() => "yes") as unknown as (id: string) => boolean });
  assert.equal(await filesSourcesShelfEnabled(truthy), false);
});

test("an empty caller id is never an operator", async () => {
  await withAdmins("user_operator", async () => {
    assert.equal(await filesSourcesShelfEnabled(deps({ currentUser: async () => "" })), false);
  });
});

test("demo and review builds always keep today's page, even for a listed id", async () => {
  await withAdmins("user_operator", async () => {
    assert.equal(await filesSourcesShelfEnabled(deps({ currentUser: async () => "user_operator", demo: () => true })), false);
  });
});

test("the Files page renders FilesView unless the gate says yes", () => {
  const page = readFileSync(fileURLToPath(new URL("../app/app/files/page.tsx", import.meta.url)), "utf8");
  assert.match(page, /filesSourcesShelfEnabled\(\)/, "the page asks the gate");
  assert.match(page, /\{shelf \? \(\s*<FilesShelfView[\s\S]*?\) : \(\s*<FilesView/, "the shelf renders only on yes; FilesView otherwise");
});
