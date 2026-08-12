/**
 * Home experience contract — asserted against the captured product.
 *
 * Specified by docs/projects/home-operating-layer/contracts/HOME_EXPERIENCE.md.
 * Ids below (X1, X5, …) are that file's §18 table.
 *
 * THIS FILE IS EXPECTED TO FAIL AT THIS BASE, AND THAT IS THE DELIVERABLE.
 * It reads the live structural capture in
 * docs/projects/home-operating-layer/design/current-product-evidence/ —
 * 10 routes × 3 viewports taken from a running review-mode server — and asserts
 * the experience floor against it. It fails today because the rendered product
 * does not meet the floor, and because three of the five Home routes do not
 * exist so their captures are absent. Wave 4+ makes it pass by fixing the
 * product and re-taking the capture with
 * `node scripts/home-layer/capture-current-product.mjs`.
 *
 * WHY ASSERT AGAINST A CAPTURE. The defects this file guards against —
 * a second aria-current="page", a heading above the h1, a badge concatenated
 * into an accessible name, a row that says less at 320px — are all properties
 * of the rendered document. None is visible to a unit test of a component, and
 * none is caught by any gate in this repository today.
 *
 * WHAT THIS FILE DOES NOT PROVE. The capture is Chromium only, light theme
 * only, seed data, no hover/focus/error states, no axe, no contrast
 * measurement, no real zoom and no screen reader
 * (design/current-product-evidence/README.md, "Honest limits"). Passing this
 * file is necessary and nowhere near sufficient: HOME_EXPERIENCE.md §15 and §17
 * carry the rest, and every unrun assistive-technology pairing stays `unproven`.
 *
 * Run: node --test src/lib/home-layer/experience/home-experience-contract.test.mjs
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");
const evidenceDir = join(
  repoRoot,
  "docs",
  "projects",
  "home-operating-layer",
  "design",
  "current-product-evidence",
);
const auditPath = join(evidenceDir, "structural-audit.json");

const VIEWPORTS = ["desktop-1440", "mobile-390", "narrow-320"];

/** HOME_EXPERIENCE.md §2 — the sealed titles. */
const HOME_ROUTES = {
  home: { path: "/app/home", title: "Home · Signal Studio" },
  "home-briefing": {
    path: "/app/home/briefing",
    title: "Full briefing · Home · Signal Studio",
  },
  "home-inbox": { path: "/app/home/inbox", title: "Inbox · Home · Signal Studio" },
  "home-my-work": {
    path: "/app/home/my-work",
    title: "My work · Home · Signal Studio",
  },
  "home-analytics": {
    path: "/app/home/analytics",
    title: "Analytics · Home · Signal Studio",
  },
};

/**
 * The surfaces the Home operating layer composes. /app/inbox and /app/my-tasks
 * are included because they become Home modes (charter, wave sequence W6/W7),
 * so their current structure is Home's inheritance, not somebody else's problem.
 */
const ABSORBED = ["home", "home-briefing", "inbox", "my-tasks"];

assert.ok(
  existsSync(auditPath),
  `${relative(repoRoot, auditPath)} is missing. Re-take it with ` +
    `node scripts/home-layer/capture-current-product.mjs --base http://localhost:3212`,
);
const audit = JSON.parse(readFileSync(auditPath, "utf8"));

const key = (route, viewport) => `${route}@${viewport}`;
const capture = (route, viewport) => audit.routes[key(route, viewport)];

/** Every capture present, as [key, row] pairs. */
const allCaptures = Object.entries(audit.routes);

function ariaSnapshot(route, viewport) {
  const file = join(evidenceDir, viewport, `${route}.aria.txt`);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

/**
 * Pull { name, url } for every link in an ARIA snapshot. Names may contain
 * escaped quotes (`button "Mark \"…\" done"`), so the name pattern has to
 * tolerate them rather than stopping at the first quote.
 */
function linksFromSnapshot(snapshot) {
  const lines = snapshot.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)-\s+link "((?:[^"\\]|\\.)*)"/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    let url = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const child = /^(\s*)-\s+\/url:\s*(.+)$/.exec(lines[j]);
      const anyLine = /^(\s*)\S/.exec(lines[j]);
      if (anyLine && anyLine[1].length <= indent) break;
      if (child) {
        url = child[2].trim().replace(/^"|"$/g, "");
        break;
      }
    }
    out.push({ name: m[2], url });
  }
  return out;
}

/**
 * The `- main:` subtree of a snapshot. X10 is about what a CONTENT ROW says, not
 * about chrome: the suite rail and the mobile bar deliberately label the same
 * destination differently ("Notes Open Notes" against "Notes"), and that is a
 * navigation-affordance decision, not a claim about a piece of work.
 */
function mainBlock(snapshot) {
  const lines = snapshot.split(/\r?\n/);
  const start = lines.findIndex((line) => /^(\s*)-\s+main:?\s*$/.test(line));
  if (start === -1) return "";
  const indent = /^(\s*)/.exec(lines[start])[1].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const anyLine = /^(\s*)\S/.exec(lines[i]);
    if (anyLine && anyLine[1].length <= indent) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

/** Live regions exposed in a snapshot: `- alert`, `- status`, `- status:`. */
function liveRegionCount(snapshot) {
  return snapshot
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s+(alert|status)(:|\s*$)/.test(line)).length;
}

// ── X1 · titles ─────────────────────────────────────────────────────────────

test("X1 · every Home route has its sealed, route-specific title (§2)", () => {
  const wrong = [];
  for (const [route, spec] of Object.entries(HOME_ROUTES)) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) {
        wrong.push(`${key(route, viewport)}: no capture (route does not exist)`);
        continue;
      }
      if (row.title !== spec.title) {
        wrong.push(`${key(route, viewport)}: "${row.title}" ≠ "${spec.title}"`);
      }
    }
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join("\n  ")}\n`);
});

test("§2 rule 2 · no Home title says Tasks, or workspace", () => {
  const bad = [];
  for (const route of Object.keys(HOME_ROUTES)) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) continue;
      if (/\bTasks\b/.test(row.title) || /workspace/i.test(row.title)) {
        bad.push(`${key(route, viewport)}: "${row.title}"`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join("; "));
});

// ── X2 · one h1, one main ───────────────────────────────────────────────────

test("X2 · exactly one h1 and one main on every Home capture (§3.1, §4.1)", () => {
  const bad = [];
  for (const route of Object.keys(HOME_ROUTES)) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) {
        bad.push(`${key(route, viewport)}: no capture`);
        continue;
      }
      if (row.h1Count !== 1) bad.push(`${key(route, viewport)}: h1Count=${row.h1Count}`);
      if (row.mainCount !== 1) bad.push(`${key(route, viewport)}: mainCount=${row.mainCount}`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join("\n  ")}\n`);
});

// ── X3 / X4 · the heading tree ──────────────────────────────────────────────

test("X3 · no heading precedes the h1 in DOM order (§3.1 rule 2)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row || !row.headings?.length) continue;
      const firstH1 = row.headings.findIndex((h) => h.level === 1);
      if (firstH1 > 0) {
        const before = row.headings
          .slice(0, firstH1)
          .map((h) => `h${h.level} "${h.text}"`)
          .join(", ");
        bad.push(`${key(route, viewport)}: ${before} before the h1`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `a chrome landmark must not carry a heading element (D-HX03):\n  ${bad.join("\n  ")}\n`,
  );
});

test("X4 · the heading level sequence is identical at every viewport (§3.1 rule 4)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    const shapes = VIEWPORTS.map((viewport) => {
      const row = capture(route, viewport);
      return row ? row.headings.map((h) => h.level).join(">") : null;
    }).filter((s) => s !== null);
    if (new Set(shapes).size > 1) {
      bad.push(
        `${route}: ${VIEWPORTS.map((v, i) => `${v}=${shapes[i]}`).join("  ")}`,
      );
    }
  }
  assert.deepEqual(
    bad,
    [],
    `content may reflow; structure may not:\n  ${bad.join("\n  ")}\n`,
  );
});

test("§3.1 rule 3 · no heading level is skipped (§3.2)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) continue;
      let previous = 0;
      for (const heading of row.headings) {
        if (previous && heading.level > previous + 1) {
          bad.push(`${key(route, viewport)}: h${previous} → h${heading.level}`);
        }
        previous = heading.level;
      }
    }
  }
  assert.deepEqual(bad, [], bad.join("; "));
});

// ── X5 / X6 · nested-current semantics ──────────────────────────────────────

test("X5 · exactly one aria-current=page, and it names the current route (§5 R1, R6)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) continue;
      const pages = (row.ariaCurrent ?? []).filter((c) => c.value === "page");
      if (pages.length !== 1) {
        bad.push(
          `${key(route, viewport)}: ${pages.length} aria-current="page" ` +
            `[${pages.map((p) => `${JSON.stringify(p.text)}→${p.href}`).join(", ")}]`,
        );
        continue;
      }
      const href = (pages[0].href ?? "").split("?")[0];
      if (href !== row.route) {
        bad.push(
          `${key(route, viewport)}: aria-current="page" points at ${href || "(no href)"}, ` +
            `but the document is ${row.route}`,
        );
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `a subtree match is aria-current="true"; only an exact match is "page" ` +
      `(D-HX04):\n  ${bad.join("\n  ")}\n`,
  );
});

test("X6 · aria-current appears only on links and controls (§5 R5)", () => {
  const bad = [];
  for (const [k, row] of allCaptures) {
    for (const current of row.ariaCurrent ?? []) {
      if (current.href === null || current.href === undefined) {
        bad.push(`${k}: aria-current="${current.value}" on ${JSON.stringify(current.text)} with no href`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `aria-current on a span states a relationship no user can act on:\n  ${bad.join("\n  ")}\n`,
  );
});

// ── X7 · the badge ──────────────────────────────────────────────────────────

test("X7 · no count is adjacent-concatenated into an accessible name (§6 rule 2)", () => {
  const bad = [];
  for (const [k, row] of allCaptures) {
    for (const current of row.ariaCurrent ?? []) {
      // A letter immediately followed by a digit: "Inbox8", "Notebook14".
      if (/[A-Za-z]\d/.test(current.text ?? "")) {
        bad.push(`${k}: ${JSON.stringify(current.text)}`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `the numeral lives in its own element; the name is composed deliberately:\n  ${bad.join("\n  ")}\n`,
  );
});

test("X7b · one Inbox affordance name, and one count (§6 rules 1 and 3)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const snapshot = ariaSnapshot(route, viewport);
      if (!snapshot) continue;
      const inboxLinks = linksFromSnapshot(snapshot).filter(
        (l) => (l.url ?? "").split("?")[0].endsWith("/inbox"),
      );
      const names = new Set(inboxLinks.map((l) => l.name));
      if (names.size > 1) {
        bad.push(`${key(route, viewport)}: ${[...names].map((n) => JSON.stringify(n)).join(" vs ")}`);
      }
      const withCount = inboxLinks.filter((l) => /\d/.test(l.name));
      if (withCount.length > 1) {
        bad.push(`${key(route, viewport)}: ${withCount.length} affordances announce the count`);
      }
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join("\n  ")}\n`);
});

// ── X8 / X9 · landmarks and regions ─────────────────────────────────────────

test("X8 · every navigation landmark has a unique, non-empty name (§4 rules 3 and 4)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) continue;
      const names = (row.navigations ?? []).map((n) => n.name);
      const unnamed = names.filter((n) => !n);
      if (unnamed.length) {
        bad.push(`${key(route, viewport)}: ${unnamed.length} unnamed navigation landmark(s)`);
      }
      const named = names.filter(Boolean);
      if (new Set(named).size !== named.length) {
        bad.push(`${key(route, viewport)}: duplicate navigation name in [${named.join(" | ")}]`);
      }
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join("\n  ")}\n`);
});

test("X8b · a Home route carries a navigation landmark named Home (§4 rule 6)", () => {
  const bad = [];
  for (const route of Object.keys(HOME_ROUTES)) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) continue;
      const names = (row.navigations ?? []).map((n) => n.name);
      if (!names.includes("Home")) {
        bad.push(`${key(route, viewport)}: navigations are [${names.join(" | ")}]`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `the four modes need one navigation landmark of their own; today Home has ` +
      `nowhere to live (audit C §3.7):\n  ${bad.join("\n  ")}\n`,
  );
});

test("X9 · every section carrying a heading is named (§4 rule 5)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const row = capture(route, viewport);
      if (!row) continue;
      if (row.unnamedRegions > 0) {
        bad.push(`${key(route, viewport)}: ${row.unnamedRegions} unnamed section(s)`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `a headed block with no region gives a screen-reader user no boundary to ` +
      `navigate to:\n  ${bad.join("\n  ")}\n`,
  );
});

// ── X10 · content parity across viewports ───────────────────────────────────

test("X10 · a row's accessible name is identical at 320 and 1440 (§12 rule 4)", () => {
  const bad = [];
  for (const route of ABSORBED) {
    const wide = ariaSnapshot(route, "desktop-1440");
    const narrow = ariaSnapshot(route, "narrow-320");
    if (!wide || !narrow) continue;

    const byUrl = (snapshot) => {
      const map = new Map();
      for (const link of linksFromSnapshot(mainBlock(snapshot))) {
        if (!link.url) continue;
        map.set(link.url, link.name);
      }
      return map;
    };
    const w = byUrl(wide);
    const n = byUrl(narrow);
    for (const [url, wideName] of w) {
      if (!n.has(url)) continue;
      const narrowName = n.get(url);
      if (narrowName !== wideName) {
        bad.push(
          `${route} ${url}\n      1440: ${JSON.stringify(wideName)}` +
            `\n       320: ${JSON.stringify(narrowName)}`,
        );
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `a narrow viewport may change layout; it may not change what a row says. ` +
      `Provenance is exactly what charter locked decision 12 forbids Home from ` +
      `asserting without attribution:\n    ${bad.join("\n    ")}\n`,
  );
});

// ── X12 · the skip link ─────────────────────────────────────────────────────

test("X12 · wherever the skip link renders, its target exists (§4 rule 2)", () => {
  const bad = [];
  for (const [k, row] of allCaptures) {
    const [route, viewport] = k.split("@");
    const snapshot = ariaSnapshot(route, viewport);
    if (!snapshot) continue;
    const hasSkip = /Skip to main content/.test(snapshot);
    if (hasSkip && row.mainCount < 1) {
      bad.push(`${k}: skip link → #app-main-content, but mainCount=${row.mainCount}`);
    }
    if (!hasSkip && /^\/app\//.test(row.route)) {
      bad.push(`${k}: no skip link on an /app route`);
    }
  }
  assert.deepEqual(bad, [], `\n  ${bad.join("\n  ")}\n`);
});

// ── §10.2 · live regions ────────────────────────────────────────────────────

test("§10.2 rule 1 · at most two live regions on a Home surface", () => {
  const bad = [];
  for (const route of ABSORBED) {
    for (const viewport of VIEWPORTS) {
      const snapshot = ariaSnapshot(route, viewport);
      if (!snapshot) continue;
      const count = liveRegionCount(snapshot);
      if (count > 2) bad.push(`${key(route, viewport)}: ${count} live regions`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    `one route-owned polite announcer plus the app-wide development notice. ` +
      `More than that and one event speaks several times:\n  ${bad.join("\n  ")}\n`,
  );
});

// ── §12 · reflow, held as a regression guard ────────────────────────────────

test("§12 rule 1 · no horizontal overflow at 320 px, anywhere", () => {
  const bad = [];
  for (const [k, row] of allCaptures) {
    if (!k.endsWith("@narrow-320")) continue;
    if (row.horizontalOverflow) {
      bad.push(`${k}: scrollWidth=${row.scrollWidth} clientWidth=${row.clientWidth}`);
    }
  }
  assert.deepEqual(bad, [], bad.join("; "));
});

test("§1.2 · zero nested interactive controls inside a wrapping link, anywhere", () => {
  const bad = allCaptures
    .filter(([, row]) => row.nestedInteractiveInsideLink > 0)
    .map(([k, row]) => `${k}: ${row.nestedInteractiveInsideLink}`);
  assert.deepEqual(bad, [], bad.join("; "));
});

// ── X11 / X14 · the two gates that are not in the capture ───────────────────

test("X11 · scroll-margin-top is still 128px, or the change was deliberate (§7 rule 6)", () => {
  const css = readFileSync(join(repoRoot, "src", "app", "globals.css"), "utf8");
  assert.ok(
    /scroll-margin-top:\s*128px/.test(css),
    `src/app/globals.css:932-937 sets scroll-margin-top: 128px so sticky chrome ` +
      `never obscures a focused element (WCAG 2.4.11). A Home mode nav changes the ` +
      `sticky height; this tripwire exists so the number is revisited on purpose.`,
  );
});

test("X14 · all five Home routes are in the contrast sweep (§13.2 rule 5)", () => {
  const script = readFileSync(
    join(repoRoot, "scripts", "check-contrast.mjs"),
    "utf8",
  );
  const missing = Object.values(HOME_ROUTES)
    .map((r) => r.path)
    .filter((p) => !script.includes(p));
  assert.deepEqual(
    missing,
    [],
    `scripts/check-contrast.mjs sweeps /app/tasks, /app/notes and /app/timeline ` +
      `only. Home is not measured for contrast at all, and Home is where the ` +
      `11–12.5px metadata lives (HOME_EXPERIENCE.md §13.2). Missing: ${missing.join(", ")}`,
  );
});
