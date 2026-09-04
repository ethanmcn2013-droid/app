/**
 * Cross-tenant isolation guard — Signal Tasks.
 *
 * WHY A DIFFERENT SHAPE THAN NOTES. Tasks does not scope every query
 * inline with `WHERE user_id = ?`. Its tenant boundary is architectural:
 * a server action resolves the caller's identity and *validated* active
 * workspace through two choke-point helpers in `auth.ts`, then queries
 * by that already-authorized workspace id (often `WHERE tasks.id = ?`).
 * An inline-scope guard would false-positive on every authorized
 * query-by-id. So this guard protects the choke points themselves, plus
 * the rule that every mutating action goes through them.
 *
 * Three invariants, all by source inspection (no DB, no server-only
 * imports). Run: node --test src/server/cross-tenant-isolation.test.mjs
 *
 *   1. getActiveWorkspace() validates cookie membership before honoring
 *      it — the literal cross-tenant boundary ("a hijacked cookie can't
 *      leak data across tenants"). If the membership check is removed,
 *      a forged cookie reads another tenant's workspace. This fails.
 *
 *   2. getCurrentUser() fails closed in production — an unauthenticated
 *      production request throws instead of silently running as the dev
 *      seed user ("david", a real DB row). If the prod throw is removed,
 *      unauth prod requests leak real data. This fails.
 *
 *   3. Every server action that mutates an owner-scoped table resolves
 *      the tenant through getActiveWorkspace()/getCurrentUser() (or
 *      carries an explicit `isolation-ok:` waiver). A new action that
 *      writes owned data while trusting a raw client-supplied id fails.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url)); // src/server
const authSrc = readFileSync(join(serverDir, "auth.ts"), "utf8");

/** Slice a named exported function body up to the next top-level `export`. */
function functionBody(src, name) {
  const start = src.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `auth.ts no longer exports ${name} — update this guard`);
  const after = src.indexOf("\nexport ", start + 1);
  return src.slice(start, after === -1 ? src.length : after);
}

test("getActiveWorkspace validates cookie membership before honoring it", () => {
  const body = functionBody(authSrc, "getActiveWorkspace");
  // The cookie value must be checked against workspaceMembers for THIS user
  // and THIS workspace before it is trusted.
  for (const needle of [
    "cookieValue",
    "workspaceMembers",
    "workspaceMembers.userId",
    "workspaceMembers.workspaceId",
  ]) {
    assert.ok(
      body.includes(needle),
      `getActiveWorkspace must still validate the cookie against ${needle} — ` +
        `without it a forged "${"tasks_active_ws"}" cookie leaks another tenant's workspace.`,
    );
  }
});

test("getCurrentUser fails closed in production (no silent dev-user fallback)", () => {
  const body = functionBody(authSrc, "getCurrentUser");
  assert.ok(body.includes("isProd"), "getCurrentUser must branch on production");
  assert.ok(
    /throw new Error/.test(body),
    "getCurrentUser must throw in production when unauthenticated — otherwise an " +
      "unauthed prod request runs as the dev seed user and reads real data.",
  );
  // Defense-in-depth: the dev fallback identity must never be returned without
  // a production guard in front of it. Every `return DEV_FALLBACK_USER` should
  // be reachable only after an isProd check has had the chance to throw.
  assert.ok(
    body.indexOf("isProd") < body.indexOf("return DEV_FALLBACK_USER"),
    "the production guard must precede any dev-fallback return",
  );
});

// ── Invariant 3: mutating actions resolve the validated tenant ───────────
// Per-tenant tables only. (The old GLOBAL GTM tables — roadmap_items /
// blockers / action_items — were retired in the 2026-07-31 data-layer
// reset; they were empty scaffolding that never shipped.)
const OWNER_TABLES = [
  "tasks",
  "comments",
  "activities",
  "notifications",
  "attachments",
  "subtasks",
  "workspaceMembers",
  "shareLinks",
  "projectDriveOperations",
];
const OK_MARKER = "isolation-ok";
const tableAlt = OWNER_TABLES.join("|");
const MUTATION_RE = new RegExp(`\\.(update|delete|insert)\\(\\s*(${tableAlt})\\b`);

function actionFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) out.push(...actionFiles(join(dir, name.name)));
    else if (name.name.endsWith(".ts") && !name.name.includes(".test."))
      out.push(join(dir, name.name));
  }
  return out;
}

test("every mutating server action resolves the tenant via the auth choke points", () => {
  const actionsDir = join(serverDir, "actions");
  const offenders = [];
  let scanned = 0;
  for (const file of actionFiles(actionsDir)) {
    const src = readFileSync(file, "utf8");
    if (!MUTATION_RE.test(src)) continue;
    scanned++;
    const resolvesTenant =
      src.includes("getActiveWorkspace") || src.includes("getCurrentUser");
    if (!resolvesTenant && !src.includes(OK_MARKER)) {
      offenders.push(file.slice(file.indexOf("src")));
    }
  }
  assert.ok(scanned >= 6, `expected ≥6 mutating action files, found ${scanned} — scan likely broken`);
  assert.deepEqual(
    offenders,
    [],
    `These actions mutate owner-scoped tables without resolving the validated ` +
      `tenant (getActiveWorkspace/getCurrentUser) and without an "${OK_MARKER}:" waiver:\n  ` +
      offenders.join("\n  "),
  );
});
