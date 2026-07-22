import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("shared Timeline metadata boundary", () => {
  it("keeps operating-product discovery metadata out of every /s response", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "app", "s", "layout.tsx"), "utf8");

    assert.match(source, /alternates:\s*\{\s*canonical:\s*null\s*\}/);
    assert.match(source, /manifest:\s*null/);
    assert.match(source, /index:\s*false/);
    assert.match(source, /follow:\s*false/);
    assert.match(source, /noarchive:\s*true/);
    assert.match(source, /nosnippet:\s*true/);
    assert.match(source, /title:\s*"timeline"/);
    assert.doesNotMatch(source, /Tasks · execution clarity/);
  });
});
