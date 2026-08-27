import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

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
const DRIVE_GRANTS_FILE = "src/server/connections/drive-grants.ts";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Files that are allowed to talk to Drive at all, per PROJECT.md §4. */
const DRIVE_SURFACE = /^src[\\/](server[\\/]connections|app[\\/]api[\\/]connections)[\\/]/;

function driveSurfaceFiles(): string[] {
  return SOURCES.filter((p) => DRIVE_SURFACE.test(p) && !/\.test\./.test(p));
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
  it("permission creation lives in one file, and calls the guard", () => {
    const callers = SOURCES.filter(
      (p) => !/\.test\./.test(p) && /permissions\.create|permissions\/create/.test(codeOf(p)),
    );
    if (callers.length === 0) return; // WP-5 has not landed.

    assert.deepEqual(
      callers,
      [DRIVE_GRANTS_FILE],
      "every Drive permission must be created in drive-grants.ts, so there " +
        "is exactly one place the guard can be bypassed",
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

  it("every Drive surface file proves a Project before it acts", () => {
    for (const path of driveSurfaceFiles()) {
      const code = codeOf(path);
      // Files that touch Google at all must show a proof in the same file.
      if (!/googleapis\.com|driveFetch|drive\.files|permissions\./.test(code)) {
        continue;
      }
      assert.match(
        code,
        /scopeFor|authorizeStoredProject|authorizeObjectProject|requireCapability/,
        `${path} calls Drive; it must prove the caller's Project first ` +
          "(ADR 0001 §9)",
      );
    }
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

  it("every server action in the Drive surface does the same", () => {
    for (const path of driveSurfaceFiles()) {
      const raw = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      if (!/^["']use server["']/m.test(raw)) continue;
      for (const m of codeOf(path).matchAll(
        /export async function (\w+)/g,
      )) {
        const at = codeOf(path).indexOf(m[0]);
        assert.match(
          codeOf(path).slice(at, at + 400),
          /isDemoMode\(\)/,
          `${path}: ${m[1]} must early-return under demo mode`,
        );
      }
    }
  });

  it("the token route refuses demo before it reads anything", () => {
    const route = codeOf("src/app/api/attachments/upload/route.ts");
    const demoAt = route.indexOf("isDemoMode()");
    const bodyAt = route.indexOf("request.json()");
    assert.ok(demoAt > -1 && bodyAt > -1);
    assert.ok(demoAt < bodyAt, "the demo check must come first");
  });
});
