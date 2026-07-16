import assert from "node:assert/strict";
import test from "node:test";
import {
  readBoundedRequestText,
  safeCspDirective,
  safeCspUri,
} from "./csp-report";

test("CSP URI logging strips paths, queries, fragments and tokens", () => {
  assert.equal(
    safeCspUri("https://tasks.signalstudio.ie/share/SECRET?token=VALUE#private"),
    "https://tasks.signalstudio.ie",
  );
  assert.equal(safeCspUri("data:text/plain,customer-content"), "data");
  assert.equal(safeCspUri("not a url SECRET"), "other");
  assert.equal(safeCspDirective("script-src-elem https://secret"), "script-src-elem");
});

test("CSP report reader rejects oversized request bodies", async () => {
  await assert.rejects(
    readBoundedRequestText(new Request("https://example.invalid", {
      method: "POST",
      body: "x".repeat(33),
    }), 32),
    /csp-report-too-large/,
  );
  assert.equal(
    await readBoundedRequestText(new Request("https://example.invalid", {
      method: "POST",
      body: "ok",
    }), 32),
    "ok",
  );
});
