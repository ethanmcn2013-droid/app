import test from "node:test";
import assert from "node:assert/strict";
import { projectDriveUiEnabled, safeDriveFolderUrl } from "./project-drive-ui";

test("UI rollout is off by default and accepts only the literal true", () => {
  const before = process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI;
  try {
    for (const value of [undefined, "", "false", "TRUE", "1", " true "]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI; else process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI = value;
      assert.equal(projectDriveUiEnabled(), false);
    }
    process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI = "true"; assert.equal(projectDriveUiEnabled(), true);
  } finally { if (before === undefined) delete process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI; else process.env.NEXT_PUBLIC_PROJECT_DRIVE_UI = before; }
});
test("board folder links exclude roots, credentials, query strings and foreign hosts", () => {
  assert.equal(safeDriveFolderUrl("https://drive.google.com/drive/folders/abc-123"), "https://drive.google.com/drive/folders/abc-123");
  for (const value of [null, "javascript:alert(1)", "https://drive.google.com.evil.test/drive/folders/id", "https://user:password@drive.google.com/drive/folders/id", "https://drive.google.com/drive/folders/id?token=secret", "https://drive.google.com/drive/my-drive"]) assert.equal(safeDriveFolderUrl(value), null);
});
