import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");

test("Project Drive permits only Google's exact upload API origin", () => {
  assert.match(
    source,
    /const googleDriveApi = "https:\/\/www\.googleapis\.com"/,
  );

  const baselineConnect = source.match(
    /`connect-src 'self'[^`]*\$\{blobUpload\}[^`]*`/,
  )?.[0];
  assert.ok(baselineConnect, "expected the authenticated-app CSP baseline");
  assert.match(baselineConnect, /\$\{googleDriveApi\}/);

  assert.doesNotMatch(source, /https:\/\/\*\.googleapis\.com/);

  for (const frame of source.matchAll(/`frame-src[^`]*`/g)) {
    assert.doesNotMatch(frame[0], /googleDriveApi|googleapis|drive\.google/);
  }
});
