/**
 * Marketing golden-path smoke test.
 *
 * Pure-Node version (no Playwright dependency installed). Runs
 * sequential `fetch` calls against a locally running dev/preview
 * server and asserts each marketing route returns 200 + a
 * known-good substring of the rendered HTML.
 *
 * Run via:
 *   # in one terminal:
 *   npm run dev
 *   # in another:
 *   npm run test:smoke
 *
 * Override the base URL with SMOKE_BASE_URL=https://… for prod.
 *
 * NOTE: this script is intentionally NOT run in CI — CI doesn't
 * boot the Next.js server. Wire it into a preview-deploy hook or
 * a manual dev-time check.
 */
import { strict as assert } from "node:assert";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

interface Check {
  path: string;
  // Either a literal substring, an array (any-of), or a regex.
  expect: string | string[] | RegExp;
  label: string;
}

const checks: Check[] = [
  {
    path: "/",
    expect: "Project management",
    label: "home contains 'Project management'",
  },
  {
    path: "/pricing",
    expect: ["$9.95", "$79"],
    label: "pricing contains $9.95 or $79",
  },
  {
    path: "/principles",
    expect: ["refusal", "we will never", "we'll never"],
    label: "principles contains 'refusal' or 'we will never'",
  },
  {
    // The /about page renders strikethrough phrases like
    // "sprint planning", "epic refinement", "ticket triage" inside
    // motion.span elements. We assert at least one of them is in
    // the HTML — that's our proxy for the strikethrough block.
    path: "/about",
    expect: [
      "sprint planning",
      "epic refinement",
      "ticket triage",
      "burndown",
      "story points",
    ],
    label: "about contains a strikethrough phrase",
  },
  {
    path: "/changelog",
    expect: "Cycle",
    label: "changelog contains 'Cycle'",
  },
  {
    path: "/sitemap.xml",
    expect: "<url>",
    label: "sitemap.xml contains <url>",
  },
  {
    path: "/robots.txt",
    expect: "Disallow",
    label: "robots.txt contains 'Disallow'",
  },
];

async function check(c: Check): Promise<void> {
  const url = `${BASE}${c.path}`;
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "tasks-smoke/1.0" },
  });
  assert.equal(
    res.status,
    200,
    `${c.path} returned ${res.status} (expected 200)`,
  );
  const body = await res.text();
  let matched = false;
  if (c.expect instanceof RegExp) {
    matched = c.expect.test(body);
  } else if (Array.isArray(c.expect)) {
    matched = c.expect.some((needle) => body.includes(needle));
  } else {
    matched = body.includes(c.expect);
  }
  assert.ok(
    matched,
    `${c.path} body did not contain: ${
      Array.isArray(c.expect)
        ? c.expect.join(" | ")
        : String(c.expect)
    }`,
  );
}

async function main(): Promise<void> {

  console.log(`smoke: base=${BASE}\n`);
  let failed = 0;
  for (const c of checks) {
    try {
      await check(c);

      console.log(`ok  - ${c.label}`);
    } catch (err) {
      failed += 1;

      console.error(`FAIL - ${c.label}`);

      console.error(`       ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n${checks.length - failed}/${checks.length} passing`);
  if (failed > 0) process.exit(1);
}

void main();
