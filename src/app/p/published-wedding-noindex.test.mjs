import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * R-031 / D-033 Option B: a published WEDDING workspace is noindex by default on /p.
 *
 * A wedding workspace's task titles and tags carry guests' and suppliers' names.
 * The couple pressed "publish" to share a link, not to be indexed. /p stays
 * crawlable for an ordinary workspace, because a findable, unfurlable link is the
 * product; a wedding one does not.
 *
 * Asserted against source text on purpose. The alternative is booting Next and
 * calling generateMetadata against a live database, which this suite has no
 * harness for. The failure this guards against is someone deleting the robots
 * block during an unrelated edit to the metadata function, and source text
 * catches exactly that. It does not prove Next emits the header.
 *
 * robots.ts also disallows /p. That is a courtesy a crawler may ignore, and it
 * does nothing about link-preview fetchers. This is the control.
 */

const page = readFileSync(
  new URL("./[slug]/page.tsx", import.meta.url),
  "utf8",
);

test("a wedding workspace is detected in /p metadata", () => {
  assert.match(
    page,
    /ws\.activeDomain\s*===\s*"wedding"/,
    'src/app/p/[slug]/page.tsx must branch on ws.activeDomain === "wedding". Without that branch every published wedding workspace is indexable, which is what R-031 recorded and D-033 decided against.',
  );
});

test("the wedding branch sets index:false and follow:false", () => {
  assert.match(
    page,
    /robots:\s*\{[^}]*index:\s*false/s,
    "the wedding branch must set robots.index = false",
  );
  assert.match(
    page,
    /robots:\s*\{[^}]*follow:\s*false/s,
    "the wedding branch must set robots.follow = false",
  );
});

test("the wedding branch also suppresses archiving and snippets", () => {
  // noindex alone still lets a crawler keep a cached copy and show a snippet of
  // guest names from a page it fetched before the flag went on.
  assert.match(page, /noarchive:\s*true/, "must set noarchive");
  assert.match(page, /nosnippet:\s*true/, "must set nosnippet");
});

test("/p is disallowed in robots.txt as well as noindexed", () => {
  const robots = readFileSync(
    new URL("../robots.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    robots,
    /disallow:\s*\[[^\]]*"\/p"/s,
    'src/app/robots.ts must disallow "/p". The metadata header is the control and this is the courtesy, but D-033 ratified both.',
  );
});
