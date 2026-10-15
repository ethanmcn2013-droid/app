import { test } from "node:test";
import assert from "node:assert/strict";
import { readableLinkLabel } from "./readable-link";
test("visible links describe destinations without credentials or query secrets", () => {
  assert.equal(readableLinkLabel("https://user:password@example.com/project/abc?token=secret"), "example.com / project / abc");
  assert.equal(readableLinkLabel("https://example.com/files/ws-625a01c4-4a9a-43de-8218-89e6b49b6bab"), "example.com / files");
  assert.equal(readableLinkLabel("https://example.com/wedding-planning/guest_list"), "example.com / wedding planning / guest list");
  assert.equal(readableLinkLabel("https://example.com/bad%"), "example.com / bad%");
  assert.equal(readableLinkLabel("https://example.com/share/privateAccessToken/not-a-label"), "example.com / share");
  assert.equal(readableLinkLabel("javascript:alert(1)"), "Open link");
});
