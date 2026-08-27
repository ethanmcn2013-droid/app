import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MAX_UPLOAD_BYTES,
  PLATFORM_FUNCTION_BODY_CAP_BYTES,
  SERVER_ACTION_BODY_LIMIT,
  SERVER_ACTION_BODY_LIMIT_BYTES,
  SERVER_ACTION_FILE_LIMIT_BYTES,
  formatUploadLimit,
} from "@/lib/upload-limit";
import { SERVER_UPLOAD_LIMIT_BYTES, getQuota } from "@/lib/storage-config";

/**
 * WP-0 — the file-size numbers agree, and are reachable.
 *
 * The defect this locks shut was not one wrong number. It was five
 * independent numbers, each maintained by a comment asking a future reader
 * to keep them in step, and every one of them unreachable because none had
 * been checked against the platform:
 *
 *   next.config.ts  bodySizeLimit               8 MB
 *   storage-config  SERVER_UPLOAD_LIMIT_BYTES  50 MB
 *   storage-config  free tier maxFileBytes     10 MB
 *   resources-section.tsx  MAX_BYTES + toast   50 MB
 *   Vercel          function request body cap   4.5 MB  ← binding
 *
 * These tests assert the two properties that make the five one: every
 * limit derives from `src/lib/upload-limit.ts`, and no limit on a body
 * that crosses a function exceeds what the platform will carry.
 *
 * The source-text assertions are deliberate. A value equality test would
 * pass the day someone re-introduces a literal that happens to match, and
 * the whole failure mode here was numbers agreeing by coincidence and then
 * drifting.
 */

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");

describe("upload limits: one source", () => {
  it("next.config.ts imports the limit instead of restating it", () => {
    const source = read("next.config.ts");
    assert.match(
      source,
      /import \{ SERVER_ACTION_BODY_LIMIT \} from "\.\/src\/lib\/upload-limit"/,
      "next.config.ts must import the shared constant",
    );
    assert.match(
      source,
      /bodySizeLimit: SERVER_ACTION_BODY_LIMIT/,
      "bodySizeLimit must be the imported constant, not a literal",
    );
    assert.doesNotMatch(
      source,
      /bodySizeLimit:\s*["'][0-9]/,
      "bodySizeLimit must never be a literal again",
    );
  });

  it("storage-config re-exports the ceiling rather than declaring one", () => {
    const source = read("src/lib/storage-config.ts");
    assert.match(
      source,
      /export \{ MAX_UPLOAD_BYTES as SERVER_UPLOAD_LIMIT_BYTES \} from "@\/lib\/upload-limit"/,
      "SERVER_UPLOAD_LIMIT_BYTES must be the shared constant",
    );
    assert.equal(
      SERVER_UPLOAD_LIMIT_BYTES,
      MAX_UPLOAD_BYTES,
      "the re-export must resolve to the same number",
    );
  });

  it("the client hint and its toast both read the constant", () => {
    const source = read("src/components/app/detail-panel/resources-section.tsx");
    assert.match(
      source,
      /const MAX_BYTES = MAX_UPLOAD_BYTES;/,
      "the client hint must be the shared constant",
    );
    assert.match(
      source,
      /is over \$\{formatUploadLimit\(MAX_BYTES\)\}/,
      "the over-size toast must render the constant, not a typed number",
    );
    assert.doesNotMatch(
      source,
      /\bover 50 MB\b/,
      "no hardcoded megabyte figure may reappear in the toast",
    );
  });

  it("the settings panel shows what can actually be attached", () => {
    const source = read("src/components/app/settings/sections/storage.tsx");
    assert.match(
      source,
      /Math\.min\(quota\.maxFileBytes, MAX_UPLOAD_BYTES\)/,
      "the per-file figure must be the effective cap, not the plan's alone",
    );
    assert.doesNotMatch(
      source,
      /not yet active/,
      "the panel must not claim uploads are inactive; they are live",
    );
  });
});

describe("upload limits: reachable on the platform", () => {
  it("the server-action body budget sits under Vercel's own cap", () => {
    assert.ok(
      SERVER_ACTION_BODY_LIMIT_BYTES < PLATFORM_FUNCTION_BODY_CAP_BYTES,
      `bodySizeLimit ${SERVER_ACTION_BODY_LIMIT_BYTES} must be below the ` +
        `platform cap ${PLATFORM_FUNCTION_BODY_CAP_BYTES}; above it the value ` +
        "never fires and the caller gets an opaque 413 instead",
    );
  });

  it("the string and byte forms of the body budget are the same number", () => {
    const mb = Number(SERVER_ACTION_BODY_LIMIT.replace(/mb$/i, ""));
    assert.ok(Number.isFinite(mb), "the string form must parse as megabytes");
    assert.equal(
      mb * 1024 * 1024,
      SERVER_ACTION_BODY_LIMIT_BYTES,
      "the two forms of the body budget must agree",
    );
  });

  it("a file sent through a server action leaves room for its framing", () => {
    assert.ok(
      SERVER_ACTION_FILE_LIMIT_BYTES < SERVER_ACTION_BODY_LIMIT_BYTES,
      "a file cap equal to the body budget leaves nothing for multipart " +
        "framing and the other form fields, so the last megabyte fails",
    );
  });

  it("the product ceiling exceeds the platform cap, because it must", () => {
    // This is the point of the whole package. A ceiling at or below the
    // platform cap would mean the bytes were still crossing a function.
    assert.ok(
      MAX_UPLOAD_BYTES > PLATFORM_FUNCTION_BODY_CAP_BYTES,
      "the advertised ceiling is only honest because uploads go browser → " +
        "store; if it ever drops below the platform cap, the direct path " +
        "has been lost and the number should be re-derived",
    );
  });
});

describe("upload limits: the tiers still mean something", () => {
  it("the free plan's own per-file limit is the one it advertises", () => {
    const free = getQuota("free");
    assert.ok(
      free.maxFileBytes < MAX_UPLOAD_BYTES,
      "the free plan must be constrained by its plan, not by transport",
    );
    assert.equal(
      Math.min(free.maxFileBytes, MAX_UPLOAD_BYTES),
      free.maxFileBytes,
      "a free board's effective cap is its plan's number",
    );
  });

  it("a paid plan is constrained by transport, and says so", () => {
    const paid = getQuota("studio");
    assert.ok(
      paid.maxFileBytes > MAX_UPLOAD_BYTES,
      "the paid plan is generous enough that the ceiling binds",
    );
    assert.equal(
      Math.min(paid.maxFileBytes, MAX_UPLOAD_BYTES),
      MAX_UPLOAD_BYTES,
      "a paid board's effective cap is the transport ceiling",
    );
  });

  it("limits are rendered the way a person says them", () => {
    assert.equal(formatUploadLimit(MAX_UPLOAD_BYTES), "50 MB");
    assert.equal(formatUploadLimit(SERVER_ACTION_FILE_LIMIT_BYTES), "3 MB");
    assert.equal(formatUploadLimit(getQuota("free").maxFileBytes), "10 MB");
  });
});
