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

  it("unfurls with viewer vocabulary, twitter parity, and the data-free card", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src", "app", "s", "[token]", "page.tsx"),
      "utf8",
    );

    // The layout contract pins containment; this pins the page that drifted
    // past it once already. Storage enums never reach a chat preview: every
    // audience kind maps to viewer wording, and no template string
    // interpolates the raw kind into prose.
    assert.match(page, /couple:\s*"A shared wedding timeline\."/);
    assert.match(page, /class:\s*"A shared class timeline\."/);
    assert.match(page, /module:\s*"A shared project timeline\."/);
    assert.doesNotMatch(page, /\$\{result\.dto\.audienceKind\} timeline/);

    // X-style consumers read their own tags or fall back to the layout's
    // generic card, dropping the timeline's name. The page must mirror
    // title and description into twitter explicitly.
    assert.match(page, /twitter:\s*\{/);
    assert.match(page, /card:\s*"summary_large_image"/);

    // The unfurl image is the token segment's file-convention card (it must
    // live IN the page's segment — a parent-segment card is dropped when the
    // page defines its own openGraph object), and it stays data-free: no DTO
    // reaches it.
    const card = readFileSync(
      path.join(process.cwd(), "src", "app", "s", "[token]", "opengraph-image.tsx"),
      "utf8",
    );
    assert.doesNotMatch(card, /resolveAudienceTimeline|AudienceTimelineDto|dto\./);
    assert.match(card, /data-free/i);
  });
});
