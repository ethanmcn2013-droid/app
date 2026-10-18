import test from "node:test";
import assert from "node:assert/strict";
import { discardPersonalFile, personalFileProblem, personalFileSize, uploadPersonalFile } from "./personal-attachment-client";

test("file selection rejects empty, oversized and active document types while allowing the exact size limit", () => {
  assert.match(personalFileProblem({ name: "notes.txt", size: 0 })!, /not empty/);
  assert.match(personalFileProblem({ name: "photo.png", size: 2 * 1024 * 1024 + 1 })!, /2 MiB/);
  for (const name of ["page.html", "vector.svg", "archive.zip", "photo.png.exe"]) assert.ok(personalFileProblem({ name, size: 10 }));
  assert.equal(personalFileProblem({ name: "PHOTO.JPEG", size: 2 * 1024 * 1024 }), null);
  assert.equal(personalFileProblem({ name: "notes.markdown", size: 8 }), null);
  assert.equal(personalFileSize(2048), "2 KiB");
});

test("upload retries carry the same operation ID and private credentials; quota failures remain actionable", async () => {
  const original = globalThis.fetch;
  const requests: RequestInit[] = [];
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => { requests.push(init); return Response.json({ error: "quota_exceeded" }, { status: 409 }); }) as typeof fetch;
  try {
    const file = new File(["private thought"], "note.txt", { type: "text/plain" });
    for (let attempt = 0; attempt < 2; attempt++) await assert.rejects(uploadPersonalFile(file, "file_fixed_request"), /storage is full/);
    assert.equal(requests.length, 2);
    for (const init of requests) {
      assert.equal(init.credentials, "same-origin");
      assert.equal(init.cache, "no-store");
      const form = init.body as FormData;
      assert.equal(form.get("clientRequestId"), "file_fixed_request");
      assert.equal((form.get("file") as File).name, "note.txt");
    }
  } finally { globalThis.fetch = original; }
});

test("failed cancellation is not reported as confirmed byte deletion", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  try { await assert.rejects(discardPersonalFile("private_file"), /cleanup could not be confirmed/); }
  finally { globalThis.fetch = original; }
});
