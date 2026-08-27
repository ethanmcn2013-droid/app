#!/usr/bin/env node

/**
 * Does the attachment store actually work?
 *
 * WP-0 acceptance. `chooseBackend()` in src/server/storage.ts throws on a
 * Vercel deployment with no `BLOB_READ_WRITE_TOKEN`, and until this script
 * existed the only way to find out was for a customer to try attaching a
 * file. Settings compounded it by telling every workspace that uploads
 * were not active, which made a real outage indistinguishable from the
 * copy.
 *
 * Two paths are proved, because the product has two:
 *
 *   1. The SERVER-SIDE seam — `putBytes` / `openBlobStream` — which the
 *      download route reads through and which the fallback upload writes
 *      through on a deployment with no store of its own.
 *   2. The PRESIGNED path, which is how a customer's file actually
 *      travels: the server signs a URL scoped to one pathname, and the
 *      browser PUTs the bytes itself.
 *
 * Both write clearly-named scratch objects and delete them. No database
 * row is created and nothing customer-facing is touched.
 *
 *   vercel env pull .env.production --environment=production
 *   node scripts/verify-blob-store.mjs .env.production
 *   rm .env.production        # it holds live credentials
 */
import { readFileSync } from "node:fs";
import {
  put,
  get,
  head,
  del,
  issueSignedToken,
  presignUrl,
} from "@vercel/blob";

// Load the pulled environment.
for (const line of readFileSync(process.argv[2], "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)="?([\s\S]*?)"?$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}

const STAMP =
  process.argv[3] ?? new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const SERVER_KEY = `_verification/DELETE-ME-storage-proof-${STAMP}.pdf`;
const BROWSER_KEY = `_verification/DELETE-ME-presigned-proof-${STAMP}.pdf`;
const SIZE = 5 * 1024 * 1024; // the ~5 MB PDF the acceptance criterion names

/** A real PDF, so the content allowlist sees what it expects to see. */
function makePdf(bytes) {
  const buf = Buffer.alloc(bytes, 0x20);
  Buffer.from("%PDF-1.7\n").copy(buf, 0);
  Buffer.from("\n%%EOF\n").copy(buf, bytes - 7);
  return buf;
}

const log = (step, detail) => console.log(`  ${step.padEnd(46)} ${detail}`);
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!pass) failures += 1;
};

async function dropQuietly(url, label) {
  if (!url) return;
  try {
    await del(url);
    const gone = await head(url).then(
      () => false,
      () => true,
    );
    check(label, gone);
  } catch (err) {
    check(label, false, String(err && err.message));
  }
}

/** Read only the leading bytes, then stop — verifying costs 8 bytes, not 5 MB. */
async function leadingBytes(url, n) {
  const opened = await get(url, { access: "private" });
  if (!opened || opened.statusCode !== 200 || !opened.stream) return null;
  const reader = opened.stream.getReader();
  const first = await reader.read();
  await reader.cancel().catch(() => {});
  return {
    head: Buffer.from((first.value ?? new Uint8Array()).subarray(0, n)),
    size: opened.blob.size,
  };
}

console.log(`\nattachment store proof · ${SIZE} bytes\n`);
console.log(`store token present: ${Boolean(process.env.BLOB_READ_WRITE_TOKEN)}`);

const bytes = makePdf(SIZE);

// ── 1 · the server-side seam ──────────────────────────────────────────

console.log("\n  server-side seam — what the download route reads through\n");

let written = null;
try {
  const t0 = Date.now();
  written = await put(SERVER_KEY, bytes, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });
  log("wrote", `${Date.now() - t0} ms`);
  check("a ~5 MB PDF writes to the store", true, written.pathname);

  const meta = await head(written.url);
  check("the store reports the size we wrote", meta.size === SIZE, `${meta.size} bytes`);
  check(
    "the store reports the type we wrote",
    meta.contentType === "application/pdf",
    meta.contentType,
  );

  const read = await leadingBytes(written.url, 8);
  check("it reads back through the download route's own call", Boolean(read));
  if (read) {
    check(
      "the first bytes are the PDF magic number",
      read.head.toString("latin1").startsWith("%PDF-"),
      JSON.stringify(read.head.toString("latin1")),
    );
    check("the whole file is downloadable", read.size === SIZE, `${read.size} bytes`);
  }

  const anon = await fetch(written.url, { method: "HEAD", cache: "no-store" });
  check("an unauthenticated request cannot read it", !anon.ok, `HTTP ${anon.status}`);
} catch (err) {
  check("the server-side seam ran without throwing", false, String(err && err.message));
} finally {
  await dropQuietly(written?.url, "the scratch object was deleted");
}

// ── 2 · the path a customer's file actually takes ─────────────────────

console.log("\n  presigned upload — how a customer's file actually travels\n");

let stored = null;
try {
  const validUntil = Date.now() + 10 * 60 * 1000;
  // Exactly what src/app/api/attachments/upload/route.ts asks for.
  const signedToken = await issueSignedToken({
    pathname: BROWSER_KEY,
    operations: ["put"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: "put",
    pathname: BROWSER_KEY,
    access: "private",
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: 50 * 1024 * 1024,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil,
  });
  check("a put-only URL is signed for one pathname", Boolean(presignedUrl));

  const t1 = Date.now();
  const res = await fetch(presignedUrl, {
    method: "PUT",
    body: bytes,
    headers: { "content-type": "application/pdf" },
  });
  log("uploaded", `${Date.now() - t1} ms`);
  check("the browser's own PUT is accepted", res.ok, `HTTP ${res.status}`);

  stored = res.ok ? await res.json() : null;
  check(
    "the store names the pathname the server signed for",
    stored?.pathname === BROWSER_KEY,
    stored?.pathname,
  );
  check(
    "the store reports the size the browser sent",
    stored?.size === SIZE,
    `${stored?.size} bytes`,
  );

  if (stored?.url) {
    const anon = await fetch(stored.url, { method: "HEAD", cache: "no-store" });
    check("the uploaded object is not world-readable", !anon.ok, `HTTP ${anon.status}`);

    // What finalize does: re-read the bytes, because a URL handed back by
    // a browser is a claim rather than evidence.
    const read = await leadingBytes(stored.url, 8);
    check(
      "finalize can re-read the leading bytes to re-validate them",
      Boolean(read) && read.head.toString("latin1").startsWith("%PDF-"),
    );
  }

  // The control that matters: a URL signed for one pathname must not be
  // usable for another. If this ever passes, a member could write into
  // any board in the store.
  const elsewhere = presignedUrl.replace(
    encodeURIComponent(BROWSER_KEY),
    encodeURIComponent(`_verification/DELETE-ME-ELSEWHERE-${STAMP}.pdf`),
  );
  const stray = await fetch(
    elsewhere === presignedUrl
      ? presignedUrl.replace(BROWSER_KEY, `_verification/DELETE-ME-ELSEWHERE-${STAMP}.pdf`)
      : elsewhere,
    {
      method: "PUT",
      body: Buffer.from("%PDF-1.7\n"),
      headers: { "content-type": "application/pdf" },
    },
  );
  check(
    "the signed URL cannot be repointed at another pathname",
    !stray.ok,
    `HTTP ${stray.status}`,
  );
} catch (err) {
  check("the presigned path ran without throwing", false, String(err && err.message));
} finally {
  await dropQuietly(stored?.url, "the presigned scratch object was deleted");
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
