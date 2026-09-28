import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The Countdown's layout contract: the page fills the screen without
 * stranding its footer, nothing is truncated to make it fit, long names are
 * re-sized rather than cut, and the phone arrangement stacks the row rather
 * than squeezing it.
 */

const styles = readFileSync(new URL("./timeline-artifact.module.css", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const artifact = readFileSync(new URL("./timeline-artifact.tsx", import.meta.url), "utf8").replaceAll("\r\n", "\n");

function block(selector) {
  const pattern = new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const match = styles.match(pattern);
  assert.ok(match, `${selector} must exist`);
  return match[1];
}

function declaration(body, property) {
  const match = body.match(new RegExp(`(?:^|;|\\n)\\s*${property}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

test("the artifact fills the screen without stranding its footer", () => {
  const artifactBlock = block(".artifact");
  assert.match(artifactBlock, /min-height:\s*100dvh;/);
  assert.match(artifactBlock, /flex-direction:\s*column;/);
  assert.match(block(".footer"), /margin-block-start:\s*auto;/);
  assert.match(styles, /\.artifact\[data-embedded="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
  assert.match(styles, /\.artifact\[data-compact="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
});

test("nothing shrinks or hides content to make the page fit", () => {
  assert.doesNotMatch(styles, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(styles, /line-clamp/);
  assert.doesNotMatch(styles, /white-space:\s*nowrap;[\s\S]{0,40}overflow:\s*hidden/);
  for (const selector of [".hero", ".row", ".rowText", ".finale"]) {
    assert.equal(declaration(block(selector), "overflow"), null, `${selector} must not clip`);
  }
  // Titles wrap; only dates and figures hold to one line.
  assert.equal(declaration(block(".rowTitle"), "white-space"), null);
});

test("a long project title is re-sized, never truncated or forced onto one line", () => {
  assert.match(artifact, /data-title-length=\{artifactTitleLength\(timeline\.label\)\}/);
  assert.match(styles, /\.artifact\[data-title-length="long"\] \.hero h1\s*\{/);
  assert.match(styles, /\.artifact\[data-title-length="epic"\] \.hero h1\s*\{/);
  assert.match(block(".hero h1"), /text-wrap:\s*balance;/);
});

test("the count is set as a sentence: the number, then what it counts", () => {
  assert.match(artifact, /className=\{styles\.countValue\}/);
  assert.match(artifact, /className=\{styles\.countUnit\}/);
  assert.match(block(".count"), /flex-wrap:\s*wrap;/);
  // A four-character value ("Today") steps down instead of overflowing.
  assert.match(styles, /\.countValue\[data-scale="long"\]\s*\{/);
});

test("on a phone each row stacks, the figure over the title and its date", () => {
  const phone = styles.match(/@container timeline-artifact \(max-width: 620px\) \{([\s\S]*?)\n\}\n/);
  assert.ok(phone, "the phone arrangement must exist");
  assert.match(phone[1], /\.row\s*\{[^}]*grid-template-columns:\s*1rem minmax\(0, 1fr\);/);
  assert.match(phone[1], /\.rowFigureCell,\s*\n\s*\.rowText\s*\{\s*grid-column:\s*2;/);
});

test("rows can be reached from the strip and land clear of the top edge", () => {
  assert.match(artifact, /id=\{`m-\$\{point\.item\.publicId\}`\}/);
  assert.match(block(".row"), /scroll-margin-block:/);
  assert.match(styles, /\.row:target\s*\{/);
});
