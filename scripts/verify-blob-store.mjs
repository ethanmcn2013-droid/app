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
 * This writes one clearly-named scratch object, reads it back through the
 * exact calls the download route makes, confirms an anonymous request
 * cannot read it, and deletes it. No database row is created and nothing
 * customer-facing is touched.
 *
 *   vercel env pull .env.production --environment=production
 *   node scripts/verify-blob-store.mjs .env.production
 *
 * The environment file holds live credentials. Delete it afterwards.
 */
import { readFileSync } from "node:fs";
import { put, get, head, del } from "@vercel/blob";

// Load the pulled production environment.
for (const line of readFileSync(process.argv[2], "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)="?([\s\S]*?)"?$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}

const STAMP =
  process.argv[3] ?? new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
const KEY = `_verification/DELETE-ME-storage-proof-${STAMP}.pdf`;
const SIZE = 5 * 1024 * 1024; // the ~5 MB PDF the acceptance criterion names

function makePdf(bytes) {
  const buf = Buffer.alloc(bytes, 0x20);
  Buffer.from("%PDF-1.7\n").copy(buf, 0); // real magic number, so the
  Buffer.from("\n%%EOF\n").copy(buf, bytes - 7); // allowlist sees a real PDF
  return buf;
}

const log = (step, detail) => console.log(`  ${step.padEnd(46)} ${detail}`);
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!pass) failures += 1;
};

console.log(`\nWP-0 production storage proof · ${SIZE} bytes · key ${KEY}\n`);
console.log(`store token present: ${Boolean(process.env.BLOB_READ_WRITE_TOKEN)}\n`);

const bytes = makePdf(SIZE);
let written = null;

try {
  const t0 = Date.now();
  written = await put(KEY, bytes, {
    access: "private",
    contentType: "application/pdf",
    addRandomSuffix: false,
  });
  log("wrote", `${Date.now() - t0} ms`);
  check("a ~5 MB PDF writes to the production store", true, written.pathname);

  const meta = await head(written.url);
  check(
    "the store reports the size we wrote",
    meta.size === SIZE,
    `${meta.size} bytes`,
  );
  check(
    "the store reports the type we wrote",
    meta.contentType === "application/pdf",
    meta.contentType,
  );

  // The exact call src/server/storage.ts openBlobStream() makes, and the
  // one the download route depends on.
  const opened = await get(written.url, { access: "private" });
  const okStream = opened && opened.statusCode === 200 && opened.stream;
  check("it reads back through the download route's own call", Boolean(okStream));

  if (okStream) {
    const reader = opened.stream.getReader();
    const first = await reader.read();
    await reader.cancel().catch(() => {});
    const head16 = Buffer.from(first.value.subarray(0, 8)).toString("latin1");
    check(
      "the first bytes are the PDF magic number",
      head16.startsWith("%PDF-"),
      JSON.stringify(head16),
    );
    check(
      "the whole file is downloadable",
      opened.blob.size === SIZE,
      `${opened.blob.size} bytes`,
    );
  }

  // The property the finalize step checks: a private blob must not be
  // readable by somebody with no credentials.
  const anon = await fetch(written.url, { method: "HEAD", cache: "no-store" });
  check(
    "an unauthenticated request cannot read it",
    !anon.ok,
    `HTTP ${anon.status}`,
  );
} catch (err) {
  check("proof ran without throwing", false, String(err && err.message));
} finally {
  if (written) {
    try {
      await del(written.url);
      const gone = await head(written.url).then(
        () => false,
        () => true,
      );
      check("the scratch object was deleted", gone);
    } catch (err) {
      check("the scratch object was deleted", false, String(err && err.message));
    }
  }
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
