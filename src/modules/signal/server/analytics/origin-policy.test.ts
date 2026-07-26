import assert from "node:assert/strict";
import test from "node:test";
import { mutationOriginIssue } from "./origin-policy";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://app.signalstudio.ie/api/signal-studio/v1/preferences", {
    method: "PATCH",
    headers,
  });
}

test("preference origin policy accepts the same origin", () => {
  assert.equal(
    mutationOriginIssue(
      request({
        origin: "https://app.signalstudio.ie",
        "sec-fetch-site": "same-origin",
      }),
    ),
    null,
  );
});

test("preference origin policy rejects missing, malformed, and cross-site origins", () => {
  assert.equal(mutationOriginIssue(request()), "missing_origin");
  assert.equal(
    mutationOriginIssue(request({ origin: "not a URL" })),
    "invalid_origin",
  );
  assert.equal(
    mutationOriginIssue(
      request({
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      }),
    ),
    "cross_site",
  );
  assert.equal(
    mutationOriginIssue(
      request({
        origin: "https://evil.example",
        "sec-fetch-site": "same-site",
      }),
    ),
    "origin_mismatch",
  );
});

test("preference origin policy honors the first trusted proxy host and protocol", () => {
  assert.equal(
    mutationOriginIssue(
      request({
        origin: "https://preview.signalstudio.ie",
        host: "internal:3000",
        "x-forwarded-host": "preview.signalstudio.ie, edge.internal",
        "x-forwarded-proto": "https, http",
      }),
    ),
    null,
  );
});
