import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  SNIFF_BYTES,
  allowedMimeTypes,
  uploadRejectionMessage,
  validateUpload,
  type UploadRejection,
} from "@/lib/upload-validation";

/**
 * E08.07 — attachment upload security contract.
 *
 * The control being tested is content-type validation against an allowlist,
 * checked on the file's own bytes. It is NOT malware scanning, and nothing
 * here should be read as claiming otherwise.
 */

/** First `SNIFF_BYTES` of a real file of each type, as the action would read them. */
const HEADS: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52],
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01],
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00],
  webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x0c, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20],
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, 0x31],
  zip: [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0x00, 0x00],
  heic: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00, 0x00, 0x00, 0x00],
};

function head(name: keyof typeof HEADS): Uint8Array {
  return new Uint8Array(HEADS[name]);
}

function bytesOf(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf8").subarray(0, SNIFF_BYTES));
}

describe("upload validation: the allowlist", () => {
  it("accepts each declared type when the bytes agree", () => {
    const cases: Array<[string, Uint8Array]> = [
      ["image/png", head("png")],
      ["image/jpeg", head("jpeg")],
      ["image/gif", head("gif")],
      ["image/webp", head("webp")],
      ["image/heic", head("heic")],
      ["application/pdf", head("pdf")],
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", head("zip")],
      ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", head("zip")],
    ];
    for (const [mimeType, bytes] of cases) {
      const verdict = validateUpload(mimeType, bytes, 4096);
      assert.ok(verdict.ok, `${mimeType} should be accepted: ${JSON.stringify(verdict)}`);
      assert.equal(verdict.mimeType, mimeType);
      assert.equal(verdict.sniffed, "matched");
    }
  });

  it("refuses SVG, HTML and XML by ABSENCE, which is what an allowlist means", () => {
    // The denylist this replaces named these explicitly. The point of the new
    // rule is that a type nobody thought of is refused too, so these are
    // asserted as "not on the list" rather than "on the blocked list".
    for (const mimeType of [
      "image/svg+xml",
      "text/html",
      "application/xhtml+xml",
      "application/xml",
      "text/xml",
      "application/x-msdownload",
      "text/x-shellscript",
      "application/octet-stream",
      "application/javascript",
      "application/x-httpd-php",
    ]) {
      assert.ok(
        !allowedMimeTypes().includes(mimeType),
        `${mimeType} must not be on the allowlist`,
      );
      const verdict = validateUpload(mimeType, head("png"), 4096);
      assert.equal(verdict.ok, false);
      assert.equal(
        verdict.ok === false ? verdict.reason : null,
        "type-not-allowed",
      );
    }
  });
});

describe("upload validation: the bytes decide, not the label", () => {
  it("refuses HTML wearing an image/png label — the exact bypass the denylist had", () => {
    // Rename payload.html to photo.png, let the browser declare image/png.
    // Under the old rule this passed: image/png was not on the blocklist and
    // nothing read the file.
    const verdict = validateUpload(
      "image/png",
      bytesOf("<html><script>alert(1)</script>"),
      512,
    );
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false ? verdict.reason : null, "content-mismatch");
  });

  it("refuses an SVG wearing an image/png label", () => {
    const verdict = validateUpload("image/png", bytesOf("<svg xmlns=\"http://"), 512);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false ? verdict.reason : null, "content-mismatch");
  });

  it("refuses a Windows executable wearing an application/pdf label", () => {
    const mz = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00]);
    const verdict = validateUpload("application/pdf", mz, 8192);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false ? verdict.reason : null, "content-mismatch");
  });

  it("refuses a JPEG that claims to be a PNG, so the stored type is never a lie", () => {
    const verdict = validateUpload("image/png", head("jpeg"), 4096);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false ? verdict.reason : null, "content-mismatch");
  });

  it("does not accept a RIFF container that is not WebP", () => {
    // RIFF....AVI — the wildcard bytes in the WebP signature must not make
    // every RIFF file a WebP.
    const avi = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x0c, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20, 0x4c, 0x49, 0x53, 0x54]);
    const verdict = validateUpload("image/webp", avi, 4096);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false ? verdict.reason : null, "content-mismatch");
  });
});

describe("upload validation: the honest edges", () => {
  it("marks signature-less types as such rather than pretending to have checked", () => {
    const verdict = validateUpload("text/plain", bytesOf("just some notes"), 15);
    assert.ok(verdict.ok);
    assert.equal(verdict.sniffed, "no-signature");
  });

  it("accepts HTML source stored as text/plain, because that is what it is", () => {
    // Not a hole. It is stored as text/plain, served as text/plain with
    // `nosniff` and a sandbox CSP, so the browser renders it as text.
    const verdict = validateUpload("text/plain", bytesOf("<html><body>hi"), 14);
    assert.ok(verdict.ok);
    assert.equal(verdict.mimeType, "text/plain");
  });

  it("strips a charset parameter and normalises case before matching", () => {
    const verdict = validateUpload("TEXT/CSV; charset=utf-8", bytesOf("a,b,c"), 5);
    assert.ok(verdict.ok);
    assert.equal(verdict.mimeType, "text/csv");
  });

  it("refuses an empty file and a missing type", () => {
    assert.equal(validateUpload("image/png", new Uint8Array(), 0).ok, false);
    assert.equal(validateUpload("", head("png"), 10).ok, false);
  });

  it("never echoes the uploader's filename or raw type back into the message", () => {
    const reasons: UploadRejection[] = ["empty", "type-not-allowed", "content-mismatch"];
    for (const reason of reasons) {
      const message = uploadRejectionMessage(reason);
      assert.ok(message.length > 0);
      assert.ok(!message.includes("<"), "no markup may reach the message");
    }
  });
});

describe("source contract: the upload and download paths", () => {
  const action = readFileSync(
    new URL("./actions/attachments.ts", import.meta.url),
    "utf8",
  );
  const storage = readFileSync(
    new URL("./storage.ts", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../app/api/attachments/[id]/route.ts", import.meta.url),
    "utf8",
  );

  it("the upload action validates on bytes and stores the validated type", () => {
    assert.match(action, /validateUpload\(/);
    assert.match(action, /const mimeType = verdict\.mimeType;/);
    // The denylist is deleted, not merely unreferenced. (The name still
    // appears in the comment explaining why it went; the declaration and every
    // use of it must be gone.)
    assert.doesNotMatch(action, /const BLOCKED_MIME_TYPES/);
    assert.doesNotMatch(action, /BLOCKED_MIME_TYPES\.has/);
    // And validation happens before the row is claimed, so a refused file
    // never reaches the database.
    const validate = action.indexOf("validateUpload(");
    const insert = action.indexOf(".insert(attachments)");
    assert.ok(validate > 0 && insert > 0 && validate < insert);
  });

  it("the download route streams private blobs instead of redirecting to them", () => {
    // A private Vercel Blob URL needs the store token on the request, which a
    // browser does not have. A 302 to it cannot work.
    assert.doesNotMatch(route, /Response\.redirect/);
    assert.match(route, /openBlobStream\(/);
    // The write side and the read side must agree on that access level: `put`
    // writes private, `get` reads private. A mismatch either makes every
    // attachment world-readable or makes every download 404.
    assert.match(storage, /put\(key, buf, \{[\s\S]{0,120}access: "private"/);
    assert.match(storage, /get\(url, \{ access: "private" \}\)/);
  });

  it("the download route keeps its security headers on every backend", () => {
    // These used to apply only to disk-backed files; the redirect branch
    // discarded them.
    assert.match(route, /"X-Content-Type-Options": "nosniff"/);
    assert.match(route, /default-src 'none'; sandbox; frame-ancestors 'none'/);
    assert.match(route, /"Cache-Control": "private, no-store"/);
    // One Response, one header block, so a future branch cannot skip them.
    assert.equal(route.match(/"X-Content-Type-Options"/g)?.length, 1);
  });

  it("the download route still answers 404 for a cross-tenant id", () => {
    assert.match(route, /att\.workspaceId !== ws/);
    assert.match(route, /return notFound\(\);/);
    assert.doesNotMatch(route, /status: 403/);
  });
});
