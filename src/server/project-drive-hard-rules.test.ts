import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

// This file is the package-level server-only Project Drive test entry point.
// Keep the operation-key contract on the normal `pnpm test` path as well as
// available for focused execution.
import "./connections/project-drive-operation-key.test";

/**
 * Project Drive — the ten hard rules, enforced from the first commit.
 *
 * `docs/projects/project-drive/PROJECT.md` §2 lists ten invariants for a
 * feature that will put customer files in a member's personal Google
 * Drive. Eight of them govern code that does not exist yet (WP-1 through
 * WP-8), and that is exactly why this file is written now rather than
 * alongside the code it guards.
 *
 * A rule introduced with the code it constrains is a rule the author had
 * to remember. A rule that is already failing CI when the first Drive call
 * is written is a rule the author cannot miss. Rule 1 makes the point on
 * its own: a widened OAuth scope is not a bug that shows up in testing —
 * it shows up in a Google review nine months later, or never, and by then
 * every customer has granted it.
 *
 * So each rule here is a RATCHET. While the surface it governs is absent
 * the test asserts its absence, which is cheap and true. The moment the
 * file appears, the same test starts asserting the invariant against real
 * code — and the failure lands on the commit that introduced the risk, not
 * on a reviewer's memory.
 *
 * Two of the ten (§2.8 authorization-first and §2.10 demo-mode) already
 * have live targets: WP-0's own upload path. They are asserted against it
 * here as well as reserved for the Drive surface.
 *
 * When a rule's real enforcement lands, the corresponding assertion here
 * should get STRICTER, never removed. Deleting one of these is deleting
 * the control.
 */

const SRC = "src";

/** Every source file under `src`, so a rule cannot be dodged by relocating. */
function allSources(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      allSources(full, out);
      continue;
    }
    if (/\.(ts|tsx|mts|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Source with comments stripped — a rule is about code, not prose. */
function codeOf(path: string): string {
  // Line endings normalized: a Windows checkout can hand back CRLF and
  // turn an assertion about order into one about the checkout.
  return readFileSync(path, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, "$1");
}

/**
 * Import a file that may not exist yet.
 *
 * The specifier is computed rather than written as a literal on purpose:
 * a literal would make `tsc` resolve a WP-4 module during WP-0 and fail
 * the build, which would force this ratchet to be deleted — the one
 * outcome it exists to prevent. Callers guard with `existsSync` first.
 */
async function importIfPresent(
  path: string,
): Promise<Record<string, unknown> | null> {
  if (!existsSync(path)) return null;
  return (await import(pathToFileURL(resolve(path)).href)) as Record<
    string,
    unknown
  >;
}

const SOURCES = allSources();
const DRIVE_SCOPES_FILE = "src/server/connections/google-drive-scopes.ts";
const DRIVE_FOLDERS_FILE = "src/server/connections/drive-folders.ts";
const DRIVE_FOLDER_EXECUTOR_FILE =
  "src/server/connections/project-drive-folder-operation-executor.ts";
const DRIVE_GRANTS_FILE = "src/server/connections/drive-grants.ts";
const DRIVE_TRANSPORT_FILE = "src/server/connections/google-drive.ts";
const DRIVE_CONNECTIONS_FILE = "src/server/connections/drive-connections.ts";
const DRIVE_UPLOAD_ERASURE_RECOVERY_FILE =
  "src/server/connections/project-drive-upload-erasure-recovery.ts";
const DRIVE_AUTHORIZATION_FILE =
  "src/server/connections/project-drive-authz.ts";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const AUTHORIZED_DRIVE_CONTEXT = "AuthorizedProjectDriveContext";

/** Files that are allowed to talk to Drive at all, per PROJECT.md §4. */
const DRIVE_SURFACE = /^src[\\/](server[\\/]connections|app[\\/]api[\\/]connections)[\\/]/;

function driveSurfaceFiles(): string[] {
  return SOURCES.filter((p) => DRIVE_SURFACE.test(p) && !/\.test\./.test(p));
}

function canonicalPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function productionSources(): string[] {
  return SOURCES.filter((path) => !/\.test\./.test(path));
}

/** The raw Drive REST grammar, independent of SDK spelling. */
function containsRawDriveRest(code: string): boolean {
  return /\/(?:upload\/)?drive\/v3(?:\/|["'`])/.test(code);
}

/**
 * Detect both an SDK permission call and the REST spelling.
 *
 * The old ratchet only recognised `permissions.create`, so a bare
 * `/files/{id}/permissions` fetch silently escaped the single-guard rule.
 */
function containsPermissionApi(code: string): boolean {
  return (
    /permissions\s*\.\s*(?:create|delete|update|list|get)\s*\(/.test(code) ||
    /\/permissions(?:\/|\?|["'`])/.test(code)
  );
}

function importsDriveTransport(code: string): boolean {
  return /from\s+["'](?:[^"']*\/connections\/|\.\/)?google-drive["']/.test(
    code,
  );
}

function importsProjectDriveAuthorization(code: string): boolean {
  return /["'](?:[^"']*\/connections\/|\.\/)?project-drive-authz["']/.test(
    code,
  );
}

function exportedAsyncFunctionBlocks(
  code: string,
): Array<{ name: string; source: string }> {
  const matches = [
    ...code.matchAll(/\bexport\s+async\s+function\s+([A-Za-z0-9_]+)/g),
  ];
  return matches.map((match, index) => ({
    name: match[1],
    source: code.slice(
      match.index,
      matches[index + 1]?.index ?? code.length,
    ),
  }));
}

function asyncFunctionBlock(code: string, name: string): string | null {
  const matches = [
    ...code.matchAll(/\basync\s+function\s+([A-Za-z0-9_]+)/g),
  ];
  const index = matches.findIndex((match) => match[1] === name);
  if (index === -1) return null;
  return code.slice(
    matches[index].index,
    matches[index + 1]?.index ?? code.length,
  );
}

function isDrivePublicEntryPoint(path: string, code: string): boolean {
  const canonical = canonicalPath(path);
  const isRoute =
    /^src\/app\/api\/.+\/route\.(?:ts|tsx|mts|mjs)$/.test(canonical) &&
    !canonical.startsWith("src/app/api/cron/");
  const isServerAction = /^["']use server["'];?/m.test(code);
  if (!isRoute && !isServerAction) return false;

  return (
    /(?:google-drive|project-drive|drive-(?:folder|grant|upload|resource|connection))/i.test(
      canonical,
    ) ||
    /["'][^"']*\/connections\/(?:google-drive|drive-[^"']+|project-drive-authz)["']/.test(
      code,
    ) ||
    /\b(?:GoogleDrive|ProjectDrive|AuthorizedProjectDriveContext|authorizeProjectDrive)\b/.test(
      code,
    ) ||
    containsRawDriveRest(code)
  );
}

function drivePublicEntryPoints(): string[] {
  return productionSources().filter((path) =>
    isDrivePublicEntryPoint(path, codeOf(path)),
  );
}

function driveEntryPointViolations(path: string, code: string): string[] {
  const violations: string[] = [];
  if (importsDriveTransport(code) || containsRawDriveRest(code)) {
    violations.push(
      `${path}: a public entry point imports or embeds the raw Drive transport`,
    );
  }
  if (/\bexport\s+const\s+\w+\s*=\s*async\b/.test(code)) {
    violations.push(
      `${path}: use named exported async functions so each entry point is audited`,
    );
  }

  const functions = exportedAsyncFunctionBlocks(code);
  if (functions.length === 0) {
    violations.push(`${path}: no auditable exported async entry point`);
    return violations;
  }

  for (const fn of functions) {
    const demo = fn.source.match(
      /if\s*\(\s*isDemoMode\(\)\s*\)\s*(?:return\b|\{[\s\S]{0,200}?return\b)/,
    );
    const demoAt = demo?.index ?? -1;
    const authorization = fn.source.match(
      /await\s+authorizeProjectDrive\s*\(/,
    );
    const authorizationAt = authorization?.index ?? -1;
    const bodyAt = fn.source.indexOf("request.json(");

    if (demoAt === -1) {
      violations.push(`${path}: ${fn.name} has no early demo return`);
    } else if (demoAt > 400) {
      violations.push(`${path}: ${fn.name} delays its demo return`);
    }
    if (authorizationAt === -1) {
      violations.push(
        `${path}: ${fn.name} does not mint fresh Project authorization`,
      );
    }
    if (demoAt !== -1 && authorizationAt !== -1 && demoAt > authorizationAt) {
      violations.push(
        `${path}: ${fn.name} authorizes before refusing demo mode`,
      );
    }
    if (demoAt !== -1 && bodyAt !== -1 && demoAt > bodyAt) {
      violations.push(
        `${path}: ${fn.name} reads the request before refusing demo mode`,
      );
    }
    if (
      demoAt !== -1 &&
      fn.source.slice(0, demoAt).includes(AUTHORIZED_DRIVE_CONTEXT)
    ) {
      violations.push(
        `${path}: ${fn.name} accepts an authorization capability from its caller`,
      );
    }
  }
  return violations;
}

function higherLevelDriveHelpers(): string[] {
  return productionSources().filter((path) => {
    const canonical = canonicalPath(path);
    if (!canonical.startsWith("src/server/connections/")) return false;
    if (
      canonical === DRIVE_TRANSPORT_FILE ||
      canonical === DRIVE_SCOPES_FILE ||
      canonical === DRIVE_AUTHORIZATION_FILE
    ) {
      return false;
    }
    const code = codeOf(path);
    return (
      importsDriveTransport(code) ||
      importsProjectDriveAuthorization(code) ||
      /\/(?:drive|google-drive)-[^/]+\.(?:ts|tsx|mts|mjs)$/.test(canonical) ||
      containsRawDriveRest(code)
    );
  });
}

// ── §2.1 · the only scope ever requested is drive.file ─────────────────

describe("§2.1 · the OAuth scope is drive.file, and nothing else", () => {
  it("no source anywhere requests a wider Drive scope", () => {
    // The point of the rule is that widening is silent. This finds any
    // Google Drive scope string in the tree and insists it is the narrow
    // one — `drive`, `drive.readonly`, `drive.metadata` and the rest all
    // fail here rather than in a Google review.
    const offenders: string[] = [];
    for (const path of SOURCES) {
      if (path.endsWith("project-drive-hard-rules.test.ts")) continue;
      for (const m of codeOf(path).matchAll(
        /https:\/\/www\.googleapis\.com\/auth\/drive[a-z.]*/g,
      )) {
        if (m[0] !== DRIVE_FILE_SCOPE) offenders.push(`${path}: ${m[0]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "only drive.file may be requested; widening needs the founder " +
        "(PROJECT.md §6.1), not a commit",
    );
  });

  it("the scope constant, once it exists, is exactly the one scope", async () => {
    // WP-4 has not landed. Absence is the current, honest state.
    const mod = await importIfPresent(DRIVE_SCOPES_FILE);
    if (!mod) return;
    const exported = Object.values(mod).filter(Array.isArray) as string[][];
    assert.equal(
      exported.length,
      1,
      "the scopes file must export exactly one scope list",
    );
    assert.deepEqual(
      [...exported[0]].sort(),
      [DRIVE_FILE_SCOPE],
      "the requested scope set must equal exactly [drive.file]",
    );
  });
});

// ── §2.2 / §2.4 · a grant only ever targets this board's own folder ────

describe("§2.2 §2.4 · the root folder is never a grant target", () => {
  it("every SDK or raw REST permission call lives behind one guard", () => {
    const callers = productionSources()
      .filter((path) => containsPermissionApi(codeOf(path)))
      .map(canonicalPath)
      .sort();
    if (callers.length === 0) return; // WP-5 has not landed.

    assert.deepEqual(
      callers,
      [DRIVE_GRANTS_FILE],
      "SDK calls and raw /permissions fetches belong only in " +
        "drive-grants.ts, so there is one grant-target guard",
    );
    const code = codeOf(DRIVE_GRANTS_FILE);
    assert.match(
      code,
      /assertGrantTarget\(/,
      "every grant path must call assertGrantTarget before the API call",
    );
    assert.match(
      code,
      /rootFolderId/,
      "the guard must be given the root folder id to refuse it",
    );

    for (const fn of exportedAsyncFunctionBlocks(code)) {
      const mutation =
        /permissions\s*\.\s*(?:create|delete|update)\s*\(/.test(fn.source) ||
        (containsPermissionApi(fn.source) &&
          /method\s*:\s*["'](?:POST|PATCH|DELETE)["']/.test(fn.source));
      if (!mutation) continue;
      const guardAt = fn.source.indexOf("assertGrantTarget(");
      const providerAt = fn.source.search(
        /(?:permissions\s*\.\s*(?:create|delete|update)|\b\w*fetch\w*|requestGoogleDrive|callGoogleDrive)\s*\(/i,
      );
      assert.ok(
        guardAt !== -1 && providerAt !== -1 && guardAt < providerAt,
        `${DRIVE_GRANTS_FILE}: ${fn.name} must call assertGrantTarget ` +
          "before its permission mutation",
      );
    }
  });

  it("the permission discovery ratchet sees SDK and raw REST spellings", () => {
    assert.equal(containsPermissionApi("drive.permissions.create(input)"), true);
    assert.equal(
      containsPermissionApi(
        "new URL(`/drive/v3/files/${fileId}/permissions/${permissionId}`)",
      ),
      true,
    );
    assert.equal(containsPermissionApi("createGoogleDriveFolder(input)"), false);
  });

  it("the guard refuses the root folder and a foreign folder", async () => {
    const mod = (await importIfPresent(DRIVE_GRANTS_FILE)) as {
      assertGrantTarget?: (i: Record<string, string>) => void;
    } | null;
    if (!mod) return;
    assert.equal(
      typeof mod.assertGrantTarget,
      "function",
      "assertGrantTarget must be exported so it can be tested directly",
    );
    const base = {
      fileId: "folder-A",
      workspaceFolderId: "folder-A",
      rootFolderId: "root",
      type: "user",
      role: "writer",
    };
    assert.doesNotThrow(() => mod.assertGrantTarget!(base));
    // Sharing the root exposes every board at once.
    assert.throws(() =>
      mod.assertGrantTarget!({ ...base, fileId: "root", workspaceFolderId: "root" }),
    );
    // A grant for board A must never land on board B's folder.
    assert.throws(() => mod.assertGrantTarget!({ ...base, fileId: "folder-B" }));
  });
});

// ── §2.3 · only type: "user" ───────────────────────────────────────────

describe("§2.3 · a board folder can never become a public link", () => {
  it("no Drive code names anyone, domain or group as a grantee type", () => {
    const offenders: string[] = [];
    for (const path of driveSurfaceFiles()) {
      const code = codeOf(path);
      for (const bad of ["anyone", "domain", "group"]) {
        // A permission `type` is written as a value, so this looks for it
        // as one rather than anywhere the word appears.
        const re = new RegExp(`type:\\s*["']${bad}["']`);
        if (re.test(code)) offenders.push(`${path}: type: "${bad}"`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "only named-user grants; a public link is not a v1 capability",
    );
  });

  it("the guard rejects every grantee type but user", async () => {
    const mod = (await importIfPresent(DRIVE_GRANTS_FILE)) as {
      assertGrantTarget?: (i: Record<string, string>) => void;
    } | null;
    if (!mod) return;
    const base = {
      fileId: "folder-A",
      workspaceFolderId: "folder-A",
      rootFolderId: "root",
      role: "writer",
    };
    for (const type of ["anyone", "domain", "group", "", "user "]) {
      assert.throws(
        () => mod.assertGrantTarget!({ ...base, type }),
        `type "${type}" must be refused`,
      );
    }
  });
});

// ── §2.5 · share-link guests are never granted anything ────────────────

describe("§2.5 · a bearer token is not a person", () => {
  it("no Drive grant path reads a share link or its token", () => {
    const offenders = driveSurfaceFiles().filter((p) =>
      /shareLinks|share_links|shareToken|share_token/.test(codeOf(p)),
    );
    assert.deepEqual(
      offenders,
      [],
      "a share-link guest is an anonymous bearer token with nobody behind " +
        "it; there is no email to grant and no person to revoke",
    );
  });
});

// ── §2.6 · we never delete a user's Drive file as a side effect ────────

describe("§2.6 · removing an attachment never destroys someone's file", () => {
  it("no Drive code calls a destructive files delete", () => {
    const offenders: string[] = [];
    for (const path of driveSurfaceFiles()) {
      const code = codeOf(path);
      if (/files\.delete|files\/delete/.test(code)) {
        offenders.push(`${path}: files.delete`);
      }
      // A purge is worse than a delete: it empties the owner's trash too.
      if (/emptyTrash/.test(code)) offenders.push(`${path}: emptyTrash`);
    }
    assert.deepEqual(
      offenders,
      [],
      "deleting from Drive is a separate, owner-only, confirmed action, and " +
        "it trashes rather than purges",
    );
  });
});

// ── §2.7 · access tokens are never persisted ───────────────────────────

describe("§2.7 · only refresh tokens rest, and only as ciphertext", () => {
  it("no table column stores an access token", () => {
    const schema = existsSync("src/server/db/schema.ts")
      ? codeOf("src/server/db/schema.ts")
      : "";
    assert.doesNotMatch(
      schema,
      /access_token|accessToken/,
      "an access token is minted per request, held in memory and discarded",
    );
  });

  it("a stored refresh token is named as ciphertext", () => {
    const schema = existsSync("src/server/db/schema.ts")
      ? codeOf("src/server/db/schema.ts")
      : "";
    const refreshColumns = [...schema.matchAll(/["']([a-z_]*refresh_token[a-z_]*)["']/g)]
      .map((m) => m[1]);
    for (const column of refreshColumns) {
      assert.match(
        column,
        /_cipher$/,
        `${column} must be named for what it holds: encrypted bytes. A ` +
          "plaintext name is how calendar_connections got where it is",
      );
    }
  });
});

// ── §2.8 · authorization is proved first, on the object's own Project ──

describe("§2.8 · the caller is proved before any provider is called", () => {
  it("WP-0's own upload path proves before it reserves or writes", () => {
    const claim = codeOf("src/server/attachments/client-upload.ts");
    const scopeAt = claim.indexOf("scopeForTask(");
    const insertAt = claim.indexOf("db.insert(attachments)");
    assert.ok(scopeAt > -1 && insertAt > -1);
    assert.ok(
      scopeAt < insertAt,
      "ADR 0001 §9: the object's own Project decides, before the write",
    );
  });

  it("keeps raw REST in the explicitly authorization-agnostic transport", () => {
    const rawRestFiles = productionSources()
      .filter((path) => containsRawDriveRest(codeOf(path)))
      .map(canonicalPath)
      .sort();
    const allowed = [DRIVE_TRANSPORT_FILE];
    if (
      existsSync(DRIVE_GRANTS_FILE) &&
      containsRawDriveRest(codeOf(DRIVE_GRANTS_FILE))
    ) {
      // Permission REST is deliberately co-located with assertGrantTarget;
      // §2.2 independently proves every such spelling stays in this file.
      allowed.push(DRIVE_GRANTS_FILE);
    }
    assert.deepEqual(
      rawRestFiles,
      allowed.sort(),
      "raw Drive REST belongs only in google-drive.ts, except guarded " +
        "permission REST in drive-grants.ts",
    );

    const transport = codeOf(DRIVE_TRANSPORT_FILE);
    assert.doesNotMatch(
      transport,
      /scopeFor|authorizeStoredProject|authorizeObjectProject|requireCapability|authorizeProjectDrive|AuthorizedProjectDriveContext|isDemoMode/,
      "the raw transport must not fake caller authorization with a same-file import",
    );
  });

  it("mints one unforgeable Drive context from fresh Project authorization", () => {
    const consumers = [
      ...higherLevelDriveHelpers(),
      ...drivePublicEntryPoints(),
    ];
    if (consumers.length > 0) {
      assert.ok(
        existsSync(DRIVE_AUTHORIZATION_FILE),
        `${DRIVE_AUTHORIZATION_FILE} must exist before a higher Drive ` +
          "helper or public entry point",
      );
    }
    if (!existsSync(DRIVE_AUTHORIZATION_FILE)) return;

    const code = codeOf(DRIVE_AUTHORIZATION_FILE);
    assert.match(code, /import\s+["']server-only["']/);
    assert.match(
      code,
      /export\s+(?:type|interface)\s+AuthorizedProjectDriveContext\b/,
      "the authorization proof needs one named context type",
    );
    const brand = code.match(
      /(?:declare\s+)?const\s+([A-Za-z0-9_]+)\s*:\s*unique symbol/,
    )?.[1];
    assert.ok(brand, "AuthorizedProjectDriveContext needs a unique-symbol brand");
    assert.doesNotMatch(
      code,
      new RegExp(
        `export\\s+(?:declare\\s+)?const\\s+${brand}\\s*:\\s*unique symbol`,
      ),
      "the brand must stay private so another module cannot mint a proof",
    );
    assert.match(
      code,
      new RegExp(`\\[${brand}\\]`),
      "the private brand must be part of AuthorizedProjectDriveContext",
    );
    const contextShape = code.match(
      /export\s+type\s+AuthorizedProjectDriveContext\s*=\s*Readonly<\{([\s\S]*?)\}>/,
    )?.[1];
    assert.ok(contextShape, "the branded context needs an auditable shape");
    for (const field of [
      "role: ProjectRole",
      "capabilities: ProjectCapabilities",
      "archived: boolean",
    ]) {
      assert.match(
        contextShape,
        new RegExp(field.replace(" ", "\\s*")),
        `AuthorizedProjectDriveContext must carry fresh ${field.split(":")[0]} truth`,
      );
    }

    const authorizer = exportedAsyncFunctionBlocks(code).find(
      (fn) => fn.name === "authorizeProjectDrive",
    );
    assert.ok(authorizer, "authorizeProjectDrive must be the sole minter");
    assert.match(
      authorizer.source.slice(0, 1_200),
      new RegExp(`\\b${AUTHORIZED_DRIVE_CONTEXT}\\b`),
      "authorizeProjectDrive must return the branded context",
    );
    assert.doesNotMatch(
      authorizer.source,
      /["']use cache["']|\b(?:unstable_cache|cache)\s*\(/,
      "Project authorization must be evaluated fresh, never cached",
    );
    assert.match(
      authorizer.source,
      /requiredCapability\s*:\s*ProjectCapabilityKey\s*=\s*["']manageProject["']/,
      "management stays the default while a stored-object path may request a narrower capability",
    );
    assert.match(
      authorizer.source,
      /capability\s*:\s*requiredCapability/,
      "the requested capability must be part of the fresh Project proof",
    );
    for (const field of ["role", "capabilities", "archived"]) {
      assert.match(
        authorizer.source,
        new RegExp(`${field}\\s*:\\s*grant\\.${field}`),
        `the minted context must preserve grant.${field}`,
      );
    }
    assert.match(
      code,
      /export\s+function\s+assertProjectDriveCapability\s*\(/,
      "lower-level Drive services need one capability-refinement helper",
    );
    assert.match(
      code,
      /capabilities\?\.\[capability\]\s*!==\s*true/,
      "capability refinement must require exact true and fail closed",
    );
    assert.match(
      code,
      /throw\s+new\s+ProjectDriveAuthorizationError\(\)/,
      "capability refusal must use the same neutral authorization error",
    );
    const demoAt =
      authorizer.source.match(
        /if\s*\(\s*isDemoMode\(\)\s*\)\s*(?:return\b|\{[\s\S]{0,200}?return\b)/,
      )?.index ?? -1;
    const proofAt = authorizer.source.search(
      /await\s+(?:scopeFor\w*|authorizeStoredProject|authorizeObjectProject|requireCapability)\s*\(/,
    );
    assert.ok(
      demoAt !== -1 && proofAt > demoAt,
      "authorizeProjectDrive must refuse demo, then freshly prove the " +
        "object's Project before minting its context",
    );

    const illegalMinters = productionSources()
      .filter((path) => canonicalPath(path) !== DRIVE_AUTHORIZATION_FILE)
      .filter((path) =>
        new RegExp(
          `(?:as|satisfies)\\s+(?:unknown\\s+as\\s+)?${AUTHORIZED_DRIVE_CONTEXT}\\b`,
        ).test(codeOf(path)),
      )
      .map(canonicalPath);
    assert.deepEqual(
      illegalMinters,
      [],
      "only authorizeProjectDrive may construct the branded proof",
    );
  });

  it("pins Drive management operations to manageProject at both boundaries", () => {
    const managementOperations = new Map<string, readonly string[]>([
      [DRIVE_CONNECTIONS_FILE, ["begin", "complete", "summary", "disconnect"]],
      [DRIVE_FOLDERS_FILE, ["provision", "verifyCurrent", "renameCurrent"]],
      [DRIVE_GRANTS_FILE, ["create", "revoke", "listLive"]],
    ]);
    for (const [path, names] of managementOperations) {
      if (!existsSync(path)) continue;
      const serviceCode = codeOf(path);
      for (const name of names) {
        const operation = asyncFunctionBlock(serviceCode, name);
        assert.ok(operation, `${path}: ${name} must exist`);
        assert.match(
          operation.slice(0, 600),
          /assertProjectDriveCapability\s*\(\s*authorization\s*,\s*["']manageProject["']\s*\)/,
          `${path}: ${name} must refuse a task-only context before doing work`,
        );
      }
    }

    for (const path of [
      "src/server/actions/connections.ts",
      "src/app/api/connections/google/start/route.ts",
      "src/app/api/connections/google/callback/route.ts",
    ]) {
      const entryCode = codeOf(path);
      const calls = [...entryCode.matchAll(/authorizeProjectDrive\s*\(/g)];
      const explicitManagementCalls = [
        ...entryCode.matchAll(
          /authorizeProjectDrive\s*\([\s\S]*?,\s*["']manageProject["']\s*,?\s*\)/g,
        ),
      ];
      assert.equal(
        explicitManagementCalls.length,
        calls.length,
        `${path}: every connection entry must explicitly request manageProject`,
      );
    }
  });

  it("keeps durable folder provider work behind account-fenced journal claims", () => {
    const folders = codeOf(DRIVE_FOLDERS_FILE);
    const provision = asyncFunctionBlock(folders, "provisionClaimed");
    const rename = asyncFunctionBlock(folders, "renameClaimed");
    assert.ok(provision, "the durable provision worker must remain auditable");
    assert.ok(rename, "the durable rename worker must remain auditable");
    assert.match(
      provision.slice(0, 500),
      /claim\s*:\s*ProjectDriveFolderProvisionClaim\b/,
      "durable provision must receive a claimed journal identity",
    );
    assert.match(
      rename.slice(0, 500),
      /claim\s*:\s*ProjectDriveFolderRenameClaim\b/,
      "durable rename must receive a claimed journal identity",
    );

    const executor = codeOf(DRIVE_FOLDER_EXECUTOR_FILE);
    assert.match(
      executor,
      /operations\s*:\s*accountFencedProjectDriveOperationJournal/,
      "the production executor must use the account-fenced orchestrator",
    );
    assert.match(
      executor,
      /deps\.operations\.prepare\s*\(/,
      "durable preparation must go through the fenced dependency",
    );
    assert.match(
      executor,
      /deps\.operations\.claim\s*\(/,
      "durable claims must go through the fenced dependency",
    );
    for (const name of ["persistProvision", "persistRename"]) {
      const persistence = asyncFunctionBlock(executor, name);
      assert.ok(persistence, `${name} must remain auditable`);
      assert.doesNotMatch(
        persistence,
        /deps\.folders\.|createGoogleDriveFolder|renameGoogleDriveFile|getGoogleDriveFile/,
        `${name} must not perform provider I/O in its writer transaction`,
      );
    }
  });

  it("requires the branded context on every higher-level Drive helper", () => {
    for (const path of higherLevelDriveHelpers()) {
      const code = codeOf(path);
      if (canonicalPath(path) === DRIVE_UPLOAD_ERASURE_RECOVERY_FILE) {
        // Account erasure has no interactive caller from which to mint a
        // Project capability. This single recovery-only exception is fenced
        // by the erased account and receives the exact durable upload/storage
        // receipt. It may reconcile provider truth but cannot start a new
        // upload or delete Drive bytes.
        assert.equal(importsProjectDriveAuthorization(code), false);
        assert.match(code, /withReceiptStorageSession/);
        assert.doesNotMatch(
          code,
          /createGoogleDriveResumableUploadSession|deleteGoogleDriveFile/,
        );
        for (const fn of exportedAsyncFunctionBlocks(code)) {
          assert.match(
            fn.source.slice(0, 1_200),
            /accountUserId\s*:\s*string/,
            `${path}: ${fn.name} must receive the exact erased account`,
          );
          assert.match(
            fn.source.slice(0, 1_200),
            /receipt\s*:\s*PendingDelegatedDriveUploadReceipt\b/,
            `${path}: ${fn.name} must receive an exact durable upload receipt`,
          );
        }
        continue;
      }
      assert.equal(
        importsProjectDriveAuthorization(code),
        true,
        `${path} must import its Project authorization context`,
      );
      const functions = exportedAsyncFunctionBlocks(code);
      if (containsRawDriveRest(code) || containsPermissionApi(code)) {
        assert.ok(
          functions.length > 0,
          `${path} contains provider calls but exposes no auditable helper`,
        );
      }
      for (const fn of functions) {
        if (
          canonicalPath(path) === DRIVE_GRANTS_FILE &&
          (fn.name === "deleteExactDriveUserPermission" ||
            fn.name === "recoverOrCreateExactDriveUserPermission")
        ) {
          // Account erasure and durable operation repair have no interactive
          // caller to mint a Project capability for. Their narrow transports
          // receive an access session resolved from an exact durable storage
          // receipt. Keep each exception named and structural so another
          // unauthorised helper cannot blend into it.
          assert.match(
            fn.source.slice(0, 1_200),
            /session\s*:\s*ProjectDriveStorageSession\b/,
            `${path}: ${fn.name} must receive a database-resolved storage session`,
          );
          if (fn.name === "recoverOrCreateExactDriveUserPermission") {
            assert.match(
              fn.source.slice(0, 1_200),
              /beforeCreate\s*:\s*\(\)\s*=>\s*Promise<void>/,
              `${path}: ${fn.name} must require a final pre-mutation fence check`,
            );
          }
          continue;
        }
        if (
          canonicalPath(path) ===
            "src/server/connections/project-drive-access.ts" &&
          fn.name === "withProjectDriveReceiptSession"
        ) {
          assert.match(
            fn.source.slice(0, 1_200),
            /receipt\s*:\s*ProjectDriveStorageReceipt\b/,
            `${path}: ${fn.name} must receive an exact durable storage receipt`,
          );
          continue;
        }
        assert.match(
          fn.source.slice(0, 1_200),
          new RegExp(`\\b${AUTHORIZED_DRIVE_CONTEXT}\\b`),
          `${path}: ${fn.name} must receive AuthorizedProjectDriveContext`,
        );
      }
    }
  });

  it("freshly authorizes every public Drive action and route", () => {
    const violations = drivePublicEntryPoints().flatMap((path) =>
      driveEntryPointViolations(canonicalPath(path), codeOf(path)),
    );
    assert.deepEqual(
      violations,
      [],
      "a public Drive entry point must refuse demo first, mint fresh " +
        "Project authorization, and call only branded higher-level helpers",
    );
  });

  it("the entry-point ratchet catches late demo, missing auth, and forgery", () => {
    const unsafe = driveEntryPointViolations(
      "src/server/actions/drive.ts",
      `"use server";
       export async function connectDrive(request: Request) {
         const body = await request.json();
         return createWorkspaceDriveFolder(body);
       }`,
    );
    assert.ok(unsafe.some((item) => item.includes("early demo")));
    assert.ok(unsafe.some((item) => item.includes("fresh Project")));

    const forged = driveEntryPointViolations(
      "src/server/actions/drive.ts",
      `"use server";
       export async function connectDrive(auth: AuthorizedProjectDriveContext) {
         if (isDemoMode()) return;
         const fresh = await authorizeProjectDrive("workspace-1");
         return createWorkspaceDriveFolder(fresh);
       }`,
    );
    assert.ok(forged.some((item) => item.includes("from its caller")));

    const safe = driveEntryPointViolations(
      "src/server/actions/drive.ts",
      `"use server";
       export async function connectDrive(workspaceId: string) {
         if (isDemoMode()) return;
         const authorization = await authorizeProjectDrive(workspaceId);
         return createWorkspaceDriveFolder(authorization);
       }`,
    );
    assert.deepEqual(safe, []);
  });
});

// ── §2.9 · a client-supplied file id is never evidence ─────────────────

describe("§2.9 · a finalize verifies, it does not believe", () => {
  it("WP-0's finalize proves the object before recording it", () => {
    const finalize = codeOf("src/server/actions/attachment-uploads.ts");
    assert.match(finalize, /pathnameMatchesClaim\(/);
    assert.match(finalize, /isWorldReadable\(/);
    assert.match(finalize, /inspectBlob\(/);
  });

  it("a Drive finalize checks BOTH the stamp and the parent folder", () => {
    const finalizers = SOURCES.filter(
      (p) => !/\.test\./.test(p) && /finalizeDriveUpload/.test(codeOf(p)),
    );
    if (finalizers.length === 0) return; // WP-6 has not landed.
    for (const path of finalizers) {
      const code = codeOf(path);
      assert.match(
        code,
        /signalResourceId/,
        `${path} must compare appProperties.signalResourceId to the claim`,
      );
      assert.match(
        code,
        /parents/,
        `${path} must confirm the file sits in THIS board's folder; the ` +
          "stamp alone would accept a file stamped elsewhere",
      );
    }
  });
});

// ── §2.10 · demo never reaches a provider or the real database ─────────

describe("§2.10 · demo mode stops at the door", () => {
  it("every server action on the upload path early-returns under demo", () => {
    const finalize = codeOf("src/server/actions/attachment-uploads.ts");
    for (const fn of ["finalizeUpload", "abandonStaleUploads"]) {
      const at = finalize.indexOf(`export async function ${fn}`);
      assert.ok(at > -1, `${fn} must exist`);
      assert.match(
        finalize.slice(at, at + 400),
        /isDemoMode\(\)/,
        `${fn} must early-return under demo mode`,
      );
    }
  });

  it("every public Drive action and route refuses demo before input or auth", () => {
    const violations = drivePublicEntryPoints()
      .flatMap((path) =>
        driveEntryPointViolations(canonicalPath(path), codeOf(path)),
      )
      .filter(
        (violation) =>
          violation.includes("demo") || violation.includes("reads the request"),
      );
    assert.deepEqual(
      violations,
      [],
      "demo must stop at each public Drive entry point, before request " +
        "parsing or authorization",
    );
  });

  it("the token route refuses demo before it reads anything", () => {
    const route = codeOf("src/app/api/attachments/upload/route.ts");
    const demoAt = route.indexOf("isDemoMode()");
    const bodyAt = route.indexOf("request.json()");
    assert.ok(demoAt > -1 && bodyAt > -1);
    assert.ok(demoAt < bodyAt, "the demo check must come first");
  });
});
