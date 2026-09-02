import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_DRIVE_SCOPES,
  GoogleDriveScopeError,
  assertExactGoogleDriveScopeSet,
  isExactGoogleDriveScopeSet,
  parseGoogleDriveScopes,
} from "./google-drive-scopes";

describe("Google Drive scope contract", () => {
  it("exports one frozen drive.file-only list", () => {
    assert.deepEqual(GOOGLE_DRIVE_SCOPES, [GOOGLE_DRIVE_FILE_SCOPE]);
    assert.equal(Object.isFrozen(GOOGLE_DRIVE_SCOPES), true);
  });

  it("accepts the exact scope as a string or list", () => {
    assert.equal(isExactGoogleDriveScopeSet(GOOGLE_DRIVE_FILE_SCOPE), true);
    assert.equal(isExactGoogleDriveScopeSet([GOOGLE_DRIVE_FILE_SCOPE]), true);
    assert.doesNotThrow(() =>
      assertExactGoogleDriveScopeSet(`  ${GOOGLE_DRIVE_FILE_SCOPE}  `),
    );
  });

  it("rejects missing, duplicate, and widened scope sets", () => {
    const widerScope = GOOGLE_DRIVE_FILE_SCOPE.replace(".file", "");
    const invalid = [
      null,
      undefined,
      "",
      [],
      `${GOOGLE_DRIVE_FILE_SCOPE} ${GOOGLE_DRIVE_FILE_SCOPE}`,
      `${GOOGLE_DRIVE_FILE_SCOPE} ${widerScope}`,
      [widerScope],
    ] as const;

    for (const value of invalid) {
      assert.equal(isExactGoogleDriveScopeSet(value), false);
      assert.throws(
        () => assertExactGoogleDriveScopeSet(value),
        GoogleDriveScopeError,
      );
    }
  });

  it("parses Google's space-delimited response without hiding duplicates", () => {
    assert.deepEqual(
      parseGoogleDriveScopes(
        `${GOOGLE_DRIVE_FILE_SCOPE}  ${GOOGLE_DRIVE_FILE_SCOPE}`,
      ),
      [GOOGLE_DRIVE_FILE_SCOPE, GOOGLE_DRIVE_FILE_SCOPE],
    );
  });
});
