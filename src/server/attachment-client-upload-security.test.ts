import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  claimPathname,
  safeFilename,
  newAttachmentId,
} from "@/lib/attachment-claim";
import {
  pathnameMatchesClaim,
  verifyBlobContents,
} from "@/server/attachments/verify-upload";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";

/**
 * WP-0 — the client-direct upload path's security contract.
 *
 * Moving the bytes out of the server action bought the 4.5 MB platform cap
 * back. It also gave away the thing the old path had for free: the file
 * passing through our hands. Three properties `uploadAttachmentAction`
 * could simply observe now have to be re-established after the fact, and
 * each one is a place where trusting the browser would be a defect:
 *
 *   - the bytes landed where WE said, not where the browser asked;
 *   - nobody without credentials can read them;
 *   - they are the file they claim to be.
 *
 * These are the same three questions WP-6 will ask Google Drive
 * (`files.get`, then `appProperties.signalResourceId` and `parents`). The
 * rule is one provider older than the feature that needs it: a file id
 * handed back by a browser is a claim, never evidence.
 */

/**
 * Source, with line endings normalized.
 *
 * These assertions read code as text, and this repo is worked on from
 * Windows: a checkout can hand back CRLF and turn an assertion about
 * ORDER into an assertion about the checkout. Normalizing here keeps the
 * test measuring what it means to measure.
 */
const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);
const HTML = new Uint8Array(Buffer.from("<!doctype html><script>", "utf8"));

describe("the pathname is ours, not the browser's", () => {
  it("composes a claim from the proved workspace, task and a fresh id", () => {
    const path = claimPathname("ws-1", "task-9", "att-abcd1234", "deck.pdf");
    assert.equal(path, "ws-1/task-9/att-abcd1234-deck.pdf");
  });

  it("strips separators so a filename cannot climb out of its board", () => {
    assert.equal(safeFilename("../../etc/passwd"), "passwd");
    assert.equal(safeFilename("a/b/c.pdf"), "c.pdf");
    assert.equal(safeFilename("..\\..\\win.ini"), "win.ini");
    // A name that sanitizes to nothing still has to be something.
    assert.equal(safeFilename("..."), "file.bin");
    assert.equal(safeFilename(""), "file.bin");
  });

  it("mints an id per claim, so two uploads never share a pathname", () => {
    const ids = new Set(Array.from({ length: 64 }, () => newAttachmentId()));
    assert.equal(ids.size, 64, "attachment ids must not collide");
  });

  it("accepts only a URL whose pathname is exactly the claim", () => {
    const claim = "ws-1/task-9/att-abcd1234-deck.pdf";
    const store = "https://abc123.blob.vercel-storage.com/";
    assert.ok(pathnameMatchesClaim(store + claim, claim));
  });

  it("refuses a blob that sits anywhere else", () => {
    const claim = "ws-1/task-9/att-abcd1234-deck.pdf";
    const store = "https://abc123.blob.vercel-storage.com/";
    const impostors = [
      // Another board entirely — the case that matters most.
      "ws-2/task-9/att-abcd1234-deck.pdf",
      // Another task on the same board.
      "ws-1/task-8/att-abcd1234-deck.pdf",
      // Another claim's id.
      "ws-1/task-9/att-99999999-deck.pdf",
      // A prefix, which a `startsWith` check would have let through.
      "ws-1/task-9/att-abcd1234-deck.pdf.exe",
      // A suffix, likewise.
      "prefix/ws-1/task-9/att-abcd1234-deck.pdf",
    ];
    for (const other of impostors) {
      assert.equal(
        pathnameMatchesClaim(store + other, claim),
        false,
        `${other} must not satisfy the claim ${claim}`,
      );
    }
  });

  it("refuses an escaped separator smuggling a different prefix", () => {
    const claim = "ws-1/task-9/att-abcd1234-deck.pdf";
    const store = "https://abc123.blob.vercel-storage.com/";
    assert.equal(
      pathnameMatchesClaim(store + "ws-2%2Ftask-9/att-abcd1234-deck.pdf", claim),
      false,
    );
  });

  it("refuses anything that is not https, and anything unparseable", () => {
    const claim = "ws-1/task-9/att-abcd1234-deck.pdf";
    assert.equal(
      pathnameMatchesClaim("http://abc.blob.vercel-storage.com/" + claim, claim),
      false,
      "a plaintext URL is not a blob we wrote",
    );
    assert.equal(pathnameMatchesClaim("not a url", claim), false);
    assert.equal(pathnameMatchesClaim("", claim), false);
    assert.equal(
      pathnameMatchesClaim("javascript:alert(1)", claim),
      false,
    );
  });
});

describe("the bytes are the file they claim to be", () => {
  const ok = {
    declaredMimeType: "image/png",
    declaredSize: 16,
    claimedSize: 16,
    openLeadingBytes: async () => PNG,
  };

  it("accepts a file whose bytes match its declared type", async () => {
    const verdict = await verifyBlobContents(ok);
    assert.equal(verdict.ok, true);
    if (verdict.ok) assert.equal(verdict.mimeType, "image/png");
  });

  it("refuses bytes that disagree with the declared type", async () => {
    // The E08.07 case, one transport later: rename payload.html to
    // photo.png, declare image/png, and the store will hold it happily.
    // The allowlist has to be re-applied to what actually landed.
    const verdict = await verifyBlobContents({
      ...ok,
      openLeadingBytes: async () => HTML,
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "content-rejected");
  });

  it("refuses a size the store disagrees with", async () => {
    // The quota is summed from this column, so a browser that declares one
    // number and writes another is writing its own allowance.
    const verdict = await verifyBlobContents({ ...ok, claimedSize: 4_000_000 });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "size-mismatch");
  });

  it("refuses anything past the ceiling, whatever was declared", async () => {
    const over = MAX_UPLOAD_BYTES + 1;
    const verdict = await verifyBlobContents({
      ...ok,
      declaredSize: over,
      claimedSize: over,
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "size-mismatch");
  });

  it("refuses a blob with nothing readable in it", async () => {
    const verdict = await verifyBlobContents({
      ...ok,
      openLeadingBytes: async () => null,
    });
    assert.equal(verdict.ok, false);
    if (!verdict.ok) assert.equal(verdict.reason, "missing");
  });
});

describe("the path proves itself before it does anything", () => {
  const route = read("src/app/api/attachments/upload/route.ts");
  const finalize = read("src/server/actions/attachment-uploads.ts");
  const claim = read("src/server/attachments/client-upload.ts");

  it("the signing route refuses demo before it reads a body", () => {
    // Hard rule §2.10. Ordering is the assertion: an early return that
    // happens after the work is not an early return.
    const demoAt = route.indexOf("isDemoMode()");
    const bodyAt = route.indexOf("request.json()");
    assert.ok(demoAt > -1, "the route must check demo mode");
    assert.ok(bodyAt > -1, "the route must read a body");
    assert.ok(demoAt < bodyAt, "the demo check must come first");
  });

  it("the route proves the caller before it signs anything", () => {
    const claimAt = route.indexOf("authorizeUploadClaim(");
    const signAt = route.indexOf("issueSignedToken(");
    assert.ok(claimAt > -1, "the route must authorize a claim");
    assert.ok(signAt > -1, "the route must sign a URL");
    assert.ok(
      claimAt < signAt,
      "a URL is a credential; nothing may be signed before the proof",
    );
  });

  it("a failure to sign does not leave a claim holding quota", () => {
    const catchAt = route.indexOf("} catch {", route.indexOf("issueSignedToken("));
    assert.ok(catchAt > -1, "signing must be guarded");
    assert.match(
      route.slice(catchAt, catchAt + 400),
      /releaseUploadClaim\(/,
      "the reserved row must be released when no URL is issued",
    );
  });

  it("every action on this path early-returns under demo", () => {
    // Hard rule §2.10, for the actions rather than the route.
    for (const fn of ["finalizeUpload", "abandonStaleUploads"]) {
      const at = finalize.indexOf(`export async function ${fn}`);
      assert.ok(at > -1, `${fn} must exist`);
      const body = finalize.slice(at, at + 600);
      assert.match(
        body,
        /isDemoMode\(\)/,
        `${fn} must early-return under demo mode`,
      );
    }
  });

  it("the claim proves the task's own Project before it reserves a row", () => {
    // ADR 0001 §9, object operation. The workspace id is not a filter
    // here: it is spliced into the pathname the token is locked to.
    const scopeAt = claim.indexOf("scopeForTask(");
    const insertAt = claim.indexOf("db.insert(attachments)");
    const quotaAt = claim.indexOf("getEffectiveTier(");
    assert.ok(scopeAt > -1 && insertAt > -1 && quotaAt > -1);
    assert.ok(scopeAt < quotaAt, "authorize before reading the tier");
    assert.ok(scopeAt < insertAt, "authorize before reserving the row");
  });

  it("finalize re-authorizes rather than trusting the call", () => {
    const scopeAt = finalize.indexOf("scopeForTask(");
    const updateAt = finalize.indexOf("db\n    .update(attachments)");
    assert.ok(scopeAt > -1, "finalize must prove the caller");
    assert.ok(updateAt > -1, "finalize must update the row");
    assert.ok(scopeAt < updateAt, "the proof must precede the write");
    assert.match(
      finalize,
      /row\.uploaderUserId !== me/,
      "only the claim's own author may close it",
    );
  });

  it("finalize checks all three properties before the row becomes real", () => {
    const order = [
      "pathnameMatchesClaim(",
      "isWorldReadable(",
      "inspectBlob(",
      "db\n    .update(attachments)",
    ].map((needle) => {
      const at = finalize.indexOf(needle);
      assert.ok(at > -1, `finalize must call ${needle.trim()}`);
      return at;
    });
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(
        order[i - 1] < order[i],
        "every check must run before the row is written",
      );
    }
  });

  it("a refused upload leaves neither bytes nor a row", () => {
    // Each refusal branch must release the claim; a rejected upload that
    // keeps its row would quietly hold quota for a file nobody can see.
    const branches = finalize.split("return { ok: false");
    // The first slice is everything before any refusal; skip it, and skip
    // the demo and not-found branches, which never reserved anything.
    const releasing = branches.filter((b) =>
      /pathname-mismatch|world-readable|verdict\.reason/.test(b.slice(0, 60)),
    );
    assert.ok(releasing.length >= 3, "expected three verifying refusals");
    assert.equal(
      (finalize.match(/releaseUploadClaim\(/g) ?? []).length >= 4,
      true,
      "every verifying refusal must release the claim",
    );
  });

  it("the signed URL is scoped to one pathname, size and type set", () => {
    assert.match(
      route,
      /addRandomSuffix: false/,
      "a random suffix would make the returned URL unpredictable and the " +
        "pathname proof impossible",
    );
    assert.match(
      route,
      /allowOverwrite: false/,
      "a second URL must not be able to replace accepted bytes",
    );
    assert.match(route, /maximumSizeInBytes: claim\.claim\.maximumSizeInBytes/);
    assert.match(
      route,
      /allowedContentTypes: claim\.claim\.allowedContentTypes/,
    );
    assert.match(
      route,
      /operations: \["put"\]/,
      "the delegation must not be able to read or delete anything",
    );
    assert.match(
      route,
      /validUntil/,
      "an upload permit must expire",
    );
  });

  it("the destination is the server's, never the browser's", () => {
    assert.match(
      route,
      /pathname: claim\.claim\.pathname/,
      "the URL must be signed for the pathname the server composed from " +
        "the workspace it proved",
    );
    assert.doesNotMatch(
      route,
      /pathname:\s*(?:asked|body)\./,
      "a browser-supplied pathname must never reach the signature",
    );
  });

  it("the browser cannot ask for a world-readable object", () => {
    // The client-token flow let the browser pass its own access mode. A
    // presigned URL bakes it in here, so a modified client cannot write
    // this board's attachment as a public object.
    assert.match(route, /access: "private"/);
  });

  it("no upload library is shipped to the browser", () => {
    // 36.7 KB gzip, in every browser that loads the app, breaching the
    // bundle ratchet — which is a founder decision, not an edit.
    const client = read(
      "src/components/app/detail-panel/resources-section.tsx",
    );
    assert.doesNotMatch(
      client,
      /@vercel\/blob/,
      "the browser sends bytes with a bare fetch; no SDK belongs here",
    );
    assert.match(client, /method: "PUT"/, "the upload is a plain PUT");
  });

  it("the hosts the browser now calls are allowed by the policy", () => {
    const config = read("next.config.ts");
    const connect = /`connect-src[^`]*`/.exec(config)?.[0] ?? "";
    assert.match(
      connect,
      /\$\{blobUpload\}/,
      "connect-src must admit the upload hosts, or an enforced policy " +
        "breaks every attachment",
    );
    assert.match(config, /https:\/\/vercel\.com/);
    assert.match(config, /https:\/\/\*\.blob\.vercel-storage\.com/);
  });
});
