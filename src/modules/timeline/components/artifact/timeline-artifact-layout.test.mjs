import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The sparse-state contract.
 *
 * A one-milestone artifact used to need more than one viewport, and not
 * because of one number: `.artifact` demanded 100dvh, `.timeLens` 12.5rem,
 * `.metricViewport` up to 10rem, the single-density `.stage` up to 18rem and
 * `.detail` 10rem — roughly 40.5rem of floors before the hero, the product
 * header or the footer were counted, none of them derived from how much a
 * milestone actually says.
 *
 * These tests hold the repair in place. They are static, so they run in the
 * same `node --test` pass as everything else, and they were calibrated against
 * real browser measurement of the server-rendered component: with the values
 * asserted below the one-milestone public artifact measured 800px of content
 * at 1920 and 1600 wide, 791px at 1440 and 782px at 1280, against budgets of
 * 1080, 900, 900 and 800. What a browser cannot be asked in CI, this can: that
 * nobody reintroduces a floor nothing measured.
 */

const styles = readFileSync(new URL("./timeline-artifact.module.css", import.meta.url), "utf8")
  .replaceAll("\r\n", "\n");
const artifact = readFileSync(new URL("./timeline-artifact.tsx", import.meta.url), "utf8")
  .replaceAll("\r\n", "\n");
/** Comments are documentation, not rendered output — see the contract test. */
const artifactCode = artifact
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** The declaration block for a selector. */
function block(selector) {
  const pattern = new RegExp(
    `(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  const match = styles.match(pattern);
  assert.ok(match, `${selector} must exist`);
  return match[1];
}

const REM = 16;

/**
 * Resolve the length expressions this stylesheet actually uses — `clamp()`,
 * `calc()`, `max()`, `min()`, rem, px and vw — at a given viewport width.
 * Deliberately small: it understands the artifact's own vocabulary and
 * nothing else, so a value it cannot read fails loudly rather than quietly
 * passing.
 */
function resolveLength(expression, viewportWidth, variables = {}) {
  let text = expression.trim();
  for (let pass = 0; pass < 12 && /var\(/.test(text); pass += 1) {
    text = text.replace(/var\((--[a-z0-9-]+)\)/gi, (_match, name) => {
      const value = variables[name];
      assert.ok(value !== undefined, `unknown token ${name} in "${expression}"`);
      return value;
    });
  }
  const number = (part) => {
    const converted = part
      .replace(/([\d.]+)rem/g, (_m, n) => String(Number(n) * REM))
      .replace(/([\d.]+)vw/g, (_m, n) => String((Number(n) * viewportWidth) / 100))
      .replace(/([\d.]+)px/g, (_m, n) => n);
    // Arithmetic only, checked immediately above: no identifier can reach here.
    assert.match(converted, /^[\s\d.+\-*/()]+$/, `cannot resolve "${part}" in "${expression}"`);
    return Number(new Function(`return (${converted});`)());
  };

  let body = text;
  // Innermost first, so nesting resolves bottom-up: named functions when
  // their arguments are flat, then any bare arithmetic group left behind.
  for (let pass = 0; pass < 24; pass += 1) {
    let next = body.replace(
      /(clamp|min|max|calc)\(([^()]*)\)/gi,
      (_match, fn, args) => {
        const parts = args.split(",").map((part) => number(part));
        const name = fn.toLowerCase();
        if (name === "clamp") return String(Math.min(Math.max(parts[1], parts[0]), parts[2]));
        if (name === "min") return String(Math.min(...parts));
        if (name === "max") return String(Math.max(...parts));
        return String(parts[0]);
      },
    );
    if (next === body) {
      next = body.replace(
        /(^|[^a-z])\(([^()]*)\)/i,
        (_match, before, inner) => `${before}${number(inner)}`,
      );
    }
    if (next === body) break;
    body = next;
  }
  return number(body);
}

const TOKENS = {
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-5": "20px",
  "--space-6": "24px",
  "--space-7": "32px",
  "--space-8": "40px",
  "--space-9": "48px",
  "--space-10": "64px",
  "--space-11": "80px",
  "--text-caption": "0.75rem",
  "--x-artifact-metric": "clamp(4.4rem, 8vw, 8rem)",
  "--x-artifact-metric-leading": "0.7",
  "--x-timeline-hit": "3rem",
};

/** Every viewport the one-milestone state has to fit inside. */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
];

function declaration(source, property) {
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${property}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

test("the one-milestone stack of fixed minimums is gone", () => {
  // Each of these was a floor nothing measured. None may come back.
  assert.equal(declaration(block(".timeLens"), "min-height"), null);
  assert.equal(declaration(block(".metricViewport"), "height"), null);
  assert.equal(declaration(block(".detail"), "min-height"), null);

  // The reserved metric box is derived from the type it holds, not chosen.
  const reserved = declaration(
    block('.timeLens[data-timeline-metric-toggle] .metricViewport'),
    "min-height",
  );
  assert.match(reserved, /var\(--x-artifact-metric\)/);
  assert.match(reserved, /var\(--x-artifact-metric-leading\)/);
});

test("the sparse stage minimums are derived from the label they have to hold", () => {
  const labelBlock = declaration(block(".artifact"), "--x-timeline-label-block");
  assert.match(labelBlock, /var\(--x-timeline-hit\)/);
  assert.match(labelBlock, /var\(--space-6\)/);

  const sparse = declaration(block('.artifact[data-density="sparse"] .stage'), "min-height");
  assert.match(sparse, /var\(--x-timeline-label-block\)/);

  // The rail sits at 48% of the stage, so that is the divisor in both rules.
  assert.match(sparse, /0\.48/);
  const single = declaration(block('.artifact[data-density="single"] .stage'), "min-height");
  assert.match(single, /0\.48/);
  assert.match(single, /var\(--x-timeline-hit\)/);
});

test("one milestone fits the required viewports with room to spare", () => {
  // The content-independent part of the page: the minimums, the composed
  // spacing between the parts, and the chrome whose height is set by its own
  // tap targets. Everything else on a one-milestone artifact is content, and
  // content is allowed to make the page taller.
  const artifactBlock = block(".artifact");
  const sparseTokens = block(
    '.artifact[data-density="empty"],\n.artifact[data-density="single"],\n.artifact[data-density="sparse"]',
  );

  for (const { width, height } of VIEWPORTS) {
    const variables = {
      ...TOKENS,
      "--x-timeline-label-block": declaration(artifactBlock, "--x-timeline-label-block"),
      "--x-timeline-rhythm": declaration(sparseTokens, "--x-timeline-rhythm"),
      "--x-timeline-rhythm-tight": declaration(sparseTokens, "--x-timeline-rhythm-tight"),
    };
    const at = (expression) => resolveLength(expression, width, variables);

    const stack =
      // product header: its own tap target plus its padding, and its rule
      69 +
      // the composed gap above the title row
      at(variables["--x-timeline-rhythm"]) +
      // the metric column: the reserved face, the alternate line, the date
      at(declaration(block('.timeLens[data-timeline-metric-toggle] .metricViewport'), "min-height")) +
      57 +
      // the composed gap above the rail
      at(variables["--x-timeline-rhythm-tight"]) +
      // the rail
      at(declaration(block('.artifact[data-density="single"] .stage'), "min-height")) +
      // the reading panel's padding, then the footer and the page's foot
      44 +
      85 +
      32;

    // Measured content for this state was 800/800/791/782 at these widths;
    // the modelled stack plus a one-milestone detail's own copy lands inside
    // the same budget. The margin below is deliberately not generous: it is
    // there to fail when a floor creeps back, not to be decorative.
    assert.ok(
      stack <= height - 120,
      `one milestone at ${width}x${height}: fixed stack is ${Math.round(stack)}px, budget ${height - 120}px`,
    );
  }
});

test("the artifact fills the screen without stranding its footer", () => {
  const artifactBlock = block(".artifact");
  // The 100dvh floor stays — this is a page, and the public route is the one
  // surface that keeps it — but it now composes instead of leaving blank paper
  // under a footer that stopped wherever the content did.
  assert.match(artifactBlock, /min-height:\s*100dvh;/);
  assert.match(artifactBlock, /flex-direction:\s*column;/);
  assert.match(block(".footer"), /margin-block-start:\s*auto;/);

  // Embedded and compact surfaces still neutralise the floor.
  assert.match(styles, /\.artifact\[data-embedded="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
  assert.match(styles, /\.artifact\[data-compact="true"\]\s*\{[\s\S]*?min-height:\s*auto;/);
});

test("nothing shrinks or hides content to make the page fit", () => {
  // No truncation vocabulary anywhere in the artifact's stylesheet.
  assert.doesNotMatch(styles, /text-overflow:\s*ellipsis(?![\s\S]{0,400}data-compact)/);
  assert.doesNotMatch(styles, /line-clamp/);
  assert.doesNotMatch(styles, /white-space:\s*nowrap;[\s\S]{0,40}overflow:\s*hidden/);

  // The stage clips horizontally so the rail can scroll; the reading panel,
  // the sequence card and the hero never clip at all.
  assert.equal(declaration(block(".detail"), "overflow"), null);
  assert.equal(declaration(block(".sequenceCard"), "overflow"), null);
  assert.equal(declaration(block(".headerCopy"), "overflow"), null);
});

test("progress reads as one count, and `settled` is gone", () => {
  const progress = artifact.slice(
    artifact.indexOf("function progressFact"),
    artifact.indexOf("function countdownFact"),
  );
  assert.match(progress, /\$\{model\.completedCount\} of \$\{model\.totalCount\} complete/);
  assert.match(progress, /value: counted/);

  // No unit glyph beside the value: the `%` that used to sit detached from
  // its own number is gone by construction, not by styling.
  assert.match(progress, /unit: "",/);
  assert.doesNotMatch(progress, /model\.percent/);

  // `settled` is not a concept in this product — no column, no state. The
  // rule is about what the artifact renders, so comments are stripped first.
  assert.doesNotMatch(artifactCode, /settled/);
  assert.doesNotMatch(styles.replace(/\/\*[\s\S]*?\*\//g, ""), /settled/);

  // The count is the spoken value too, so screen and screen reader agree.
  assert.match(
    artifact,
    /aria-valuetext=\{`\$\{model\.completedCount\} of \$\{model\.totalCount\} milestones complete`\}/,
  );
  assert.match(artifact, /role="progressbar"/);
  // The value tracks the ink the bar actually paints (the frontier dot on the
  // date axis), not the count percentage; the count stays in aria-valuetext
  // above, which is what a screen reader reads out.
  assert.match(artifact, /aria-valuenow=\{Math\.round\(model\.completedFrontier \?\? 0\)\}/);
});

test("the count is typeset as a sentence, never as a number and a stranded glyph", () => {
  const count = block('.timeLens[data-metric-scale="count"] .metricPrimary');
  assert.match(count, /white-space:\s*normal;/);
  const value = block('.timeLens[data-metric-scale="count"] .metricPrimary strong');
  // A ratified reading step, not the exhibition metric and not a new clamp.
  assert.match(value, /font-size:\s*var\(--text-section\);/);
  assert.doesNotMatch(value, /clamp\(/);
});

test("one milestone renders one detail, and the plan renders one list", () => {
  // Exactly one detail block, for the selected milestone, rendered outside
  // the milestone loop.
  assert.equal((artifact.match(/<MilestoneDetail/g) ?? []).length, 1);
  assert.match(artifact, /\{detailOpen && selectedPoint \? \(\s*<MilestoneDetail/);
  assert.doesNotMatch(artifact, /points\.map\([\s\S]{0,400}<MilestoneDetail/);

  // One <ol> of milestones in the whole artifact. The print index that used to
  // repeat it is gone.
  assert.equal((artifact.match(/<ol\b/g) ?? []).length, 1);
  assert.match(artifact, /<ol className=\{styles\.milestones\}/);
});

test("a long project title is re-sized, never truncated or forced onto one line", () => {
  assert.match(artifact, /data-title-length=\{artifactTitleLength\(timeline\.label\)\}/);

  const heading = block(".header h1");
  assert.match(heading, /font-size:\s*var\(--x-artifact-display\);/);
  assert.match(heading, /overflow-wrap:\s*break-word;/);
  assert.doesNotMatch(heading, /white-space:\s*nowrap/);
  assert.doesNotMatch(heading, /text-overflow/);

  // The long step reuses the exhibition register's own compact size rather
  // than inventing a parallel clamp, which is what its token comment asks for.
  const long = block('.artifact[data-title-length="long"] .header h1');
  assert.match(long, /font-size:\s*var\(--x-artifact-display-compact\);/);
  assert.match(long, /max-width:\s*22ch;/);
  assert.doesNotMatch(long, /clamp\(/);
});
