import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opLog, safeError } from "@/server/operational-log";

const REFRESH = "1//0gABCDEFGHIJKLMNOPqrstuvwxyz0123456789";
const ACCESS = "ya29.a0AfB_byABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CLIENT_SECRET = "GOCSPX-abcdefghijklmnopqrstuvwxyz";

function captureWarn(run: () => void): string {
  const original = console.warn;
  const lines: string[] = [];
  console.warn = (...values: unknown[]) => {
    lines.push(values.map(String).join(" "));
  };
  try {
    run();
  } finally {
    console.warn = original;
  }
  return lines.join("\n");
}

function captureError(run: () => void): string {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...values: unknown[]) => {
    lines.push(values.map(String).join(" "));
  };
  try {
    run();
  } finally {
    console.error = original;
  }
  return lines.join("\n");
}

describe("operational log credential boundary", () => {
  it("safeError removes credential shapes, bearer URLs, and provider JSON", () => {
    const rendered = safeError(
      new Error(
        `exchange failed for ${REFRESH} at ` +
          `https://tasks.test/oauth/callback-secret?code=${ACCESS}&state=state-secret ` +
          `with {"client_secret":"opaque-json-secret"}`,
      ),
    );

    for (const secret of [
      REFRESH,
      ACCESS,
      "callback-secret",
      "state-secret",
      "opaque-json-secret",
    ]) {
      assert.equal(rendered.includes(secret), false, secret);
    }
    assert.match(rendered, /^Error: exchange failed/);
    assert.match(rendered, /\[redacted\]/);
  });

  it("opLog scrubs messages, scalar fields, and sensitive field names", () => {
    const line = captureWarn(() =>
      opLog("warn", "google-drive", `refresh failed for ${REFRESH}`, {
        callback: `https://tasks.test/invite/invite-secret?code=${ACCESS}`,
        providerFailure: CLIENT_SECRET,
        refreshToken: "opaque-value-with-no-provider-prefix",
        statusCode: 401,
      }),
    );

    for (const secret of [
      REFRESH,
      ACCESS,
      CLIENT_SECRET,
      "invite-secret",
      "opaque-value-with-no-provider-prefix",
    ]) {
      assert.equal(line.includes(secret), false, secret);
    }
    assert.match(line, /^\[google-drive\]/);
    assert.match(line, /statusCode=401/);
    assert.match(line, /refreshToken=\[redacted\]/);
  });

  it("the error sink applies the same production boundary", () => {
    const line = captureError(() =>
      opLog("error", "google-drive", "token exchange refused", {
        providerFailure: ACCESS,
      }),
    );
    assert.equal(line.includes(ACCESS), false);
    assert.match(line, /^\[google-drive\]/);
    assert.match(line, /\[redacted\]/);
  });
});
