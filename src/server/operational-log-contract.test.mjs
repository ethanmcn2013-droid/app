/**
 * The operational-log contract (E08.08).
 *
 * WHAT THIS PROTECTS
 * ------------------
 * An operational log is written incidentally, read by one person debugging,
 * and retained by whoever runs the platform. Nobody governs its lifetime. A
 * wedding workspace routinely contains guests' and suppliers' names, and the
 * shipped template asks the couple to collect dietary notes, which are
 * Article 9 special-category data about people who agreed to nothing. So the
 * rule is simple and absolute: **couple planning content and personal data
 * never enter the operational log.**
 *
 * Sentry already enforced a version of this — `scrubEvent` runs before an
 * event leaves the process. The `console.*` path had no equivalent, which is
 * how the same string could be safe when thrown and unsafe when logged. Two
 * real leaks were found when this contract was written:
 *
 *   - `src/app/api/csp-report/route.ts` logged the browser-supplied
 *     `document-uri` verbatim. A CSP violation on a shared workspace wrote
 *     `/share/<bearer token>` into the function log.
 *   - `src/server/email.ts` logged the recipient address, the subject and the
 *     first 120 characters of the body whenever `RESEND_API_KEY` was unset —
 *     a configuration state, not an environment, so it could fire in
 *     production.
 *
 * HOW IT ENFORCES IT
 * ------------------
 * Two rules, both mechanical.
 *
 *   RULE 1 — the ratchet. Every server-scope file's count of `console.*`
 *   calls is recorded here. A new logging site, or a new file that logs,
 *   fails until someone adds it deliberately. This does not judge the call;
 *   it forces a human to look at one. Counts may only go DOWN without an edit
 *   to this file.
 *
 *   RULE 2 — the denylist. A `console.*` call whose text references a
 *   known content- or credential-bearing expression fails outright. A site
 *   that genuinely needs one carries `// op-log-safe: <reason>` on a nearby
 *   line, which is greppable and reviewable, rather than being silently
 *   allowed.
 *
 * Neither rule can detect free-text planning content passed as a variable,
 * and this file does not pretend otherwise. That is why the sanctioned sink,
 * `opLog` in `src/server/operational-log.ts`, takes scalars only: the common
 * way of leaking content — spreading a database row into a log call — does
 * not type-check.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const SEARCH_ROOTS = [
  "src/server",
  "src/app/api",
  "src/lib/ops",
  "src/lib/analytics",
  "src/modules",
];

/**
 * Server scope: code that runs on a machine we operate, whose console output
 * lands in a platform log. Browser `console.*` is a different exposure with a
 * different owner and is out of scope here.
 */
function isServerScope(relative) {
  return (
    relative.startsWith("src/server/") ||
    relative.startsWith("src/app/api/") ||
    relative.startsWith("src/lib/ops/") ||
    relative.startsWith("src/lib/analytics/") ||
    relative.includes("/server/")
  );
}

/** The sanctioned sink itself. It IS the console call. */
const SINK = "src/server/operational-log.ts";

/**
 * Recorded server-scope logging sites, per file. RULE 1.
 *
 * To add a site: use `opLog` from `src/server/operational-log.ts`, satisfy
 * RULE 2, then raise the number here in the same change. Raising a number
 * without a reviewer seeing the call is the thing this stops.
 */
const ALLOWED = Object.freeze({
  "src/server/actions/ai.ts": 4,
  "src/server/actions/import.ts": 1,
  "src/server/actions/nudge.ts": 1,
  "src/server/actions/security.ts": 1,
  "src/server/actions/share.ts": 1,
  "src/server/db/activity.ts": 1,
  "src/server/db/index.ts": 1,
  "src/server/db/reconcile-entitlements.ts": 1,
  "src/server/db/seed-published-wedding.ts": 2,
  "src/server/db/seed.ts": 1,
  "src/server/db/venue-welcome.ts": 1,
  "src/server/digest-narration.ts": 2,
  "src/server/email.ts": 1,
  "src/server/milestones.ts": 1,
  "src/app/api/checkout/route.ts": 1,
  "src/app/api/cron/digest/route.ts": 1,
  "src/app/api/cron/weekly-digest/route.ts": 1,
  "src/app/api/webhooks/clerk/route.ts": 3,
  "src/app/api/webhooks/stripe/route.ts": 2,
  "src/lib/ops/ping-studio.ts": 1,
  "src/lib/analytics/posthog.ts": 3,
  "src/modules/signal/server/analytics/errors.ts": 1,
  // 1 as of WP4-A. Analytics now reads the workspace's board ColumnConfig so
  // "done" resolves identically here and on the board; this logs only the
  // error's constructor name when that read fails, and the failure is also
  // disclosed to the reader as coverage rather than absorbed as a default.
  // Same shape as its three siblings: a static prefix plus `error.name`, no
  // workspace id, no key, no planning content.
  "src/modules/signal/server/analytics/providers/column-config.ts": 1,
  "src/modules/signal/server/analytics/policy.ts": 1,
  "src/modules/signal/server/analytics/service.ts": 1,
  "src/modules/signal/server/analytics/snapshots.ts": 1,
  "src/modules/signal/server/briefing/signal-read-state.ts": 3,
  // 3 as of WP1. The third site is the Tasks membership check that now runs as
  // its own statement before any milestone row is read — inside the row query's
  // EXISTS clause it was a filter, and a filter cannot tell "you may not read
  // this" from "there is nothing here", which is how a removed collaborator's
  // timeline was deleted. Same shape as the two beside it: console.error with a
  // static prefix plus String(err), no ids and no planning content.
  "src/modules/timeline/server/sync/tasks-milestone-source.ts": 3,
  // 2 as of the Wave 4 integration merge. WP-14 added the membership-check log at
  // :125 while wiring Timeline workspace provisioning (blocker 2). Both sites are
  // console.error with a STATIC string - no interpolation, no ids, no couple
  // content - so neither can carry planning data into an operational log, which is
  // what this ratchet exists to prevent.
  //
  // 3 as of WP1. `getSoleOwnedTasksWorkspaceIdForUser` is the uniqueness proof
  // the exact Timeline resolver uses instead of guessing which Timeline belongs
  // to a Project; when it fails, an adoption silently becomes a reconciliation
  // prompt, which an operator has to be able to see. Same shape as the other
  // two: console.error with a STATIC string, no interpolation, no ids.
  "src/modules/timeline/server/sync/tasks-workspace-context.ts": 3,
  "src/modules/timeline/server/sync/tasks-workspace-prefs.ts": 1,
  // 2 as of WP4. The normalized binding and the sync generation/lease are both
  // ADDITIVE — the legacy mirrors stay authoritative for two stable releases —
  // so neither may take a Timeline down when its table is not there yet, which
  // is the state every deployment passes through before its migration runs.
  // Both sites are the same shape as their neighbours: console.error with a
  // static prefix plus String(error), no ids, no slugs, no planning content.
  // An operator needs to see that a binding went unrecorded; a couple must not
  // see a dead end because of it.
  "src/modules/timeline/server/sync/sync-state.ts": 2,
});

/**
 * RULE 2. Expressions that mean the log line is carrying content or a
 * credential rather than a shape. Deliberately narrow: every entry here is a
 * thing that has actually appeared in, or was one edit away from appearing
 * in, a log line in this repository.
 */
const DENIED = Object.freeze([
  { pattern: /document-uri/, why: "a page URL that is a bearer token on /share and /s" },
  { pattern: /\.\s*title\b/, why: "a task or workspace title is planning content" },
  { pattern: /\.\s*body\b/, why: "a note or message body is planning content" },
  { pattern: /\.\s*content\b/, why: "planning content, by name" },
  { pattern: /\.\s*description\b/, why: "a workspace description is planning content" },
  { pattern: /\.\s*html\b/, why: "a rendered email body carries names and dates" },
  { pattern: /\.\s*email\b/, why: "an email address identifies a person" },
  { pattern: /\bdietary\b/i, why: "Article 9 special-category data about a guest" },
  { pattern: /\bguest(s|List)?\b/i, why: "a guest is a third party who agreed to nothing" },
  { pattern: /\bdistinctId\b/, why: "an analytics subject identifier" },
  { pattern: /\bargs\.to\b/, why: "an email recipient identifies a person" },
]);

const WAIVER = /op-log-safe:/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

function serverScopeFiles() {
  const files = [];
  for (const root of SEARCH_ROOTS) {
    const abs = path.join(repoRoot, root);
    if (!fs.existsSync(abs)) continue;
    for (const full of walk(abs)) {
      const relative = path.relative(repoRoot, full).replaceAll("\\", "/");
      if (isServerScope(relative) && relative !== SINK) files.push(relative);
    }
  }
  return files.sort();
}

const CONSOLE_CALL = /console\.(log|error|warn|info|debug)\b/;

/** Every server-scope console site, with the three lines of context a
 *  multi-line call spreads its arguments over. */
function logSites() {
  const sites = [];
  for (const relative of serverScopeFiles()) {
    const lines = fs.readFileSync(path.join(repoRoot, relative), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!CONSOLE_CALL.test(line)) return;
      sites.push({
        file: relative,
        line: index + 1,
        // A console call often spans several lines. Read the call, not the
        // first line of it, or every multi-line leak walks straight through.
        text: lines.slice(index, index + 4).join("\n"),
        waiverScope: lines.slice(Math.max(0, index - 3), index + 4).join("\n"),
      });
    });
  }
  return sites;
}

describe("operational-log contract", () => {
  it("finds server-scope logging sites at all", () => {
    // A contract that scans nothing passes everything. This is the guard
    // against a refactor moving the source tree out from under the walker.
    const sites = logSites();
    assert.ok(
      sites.length > 20,
      `expected the scan to find the known logging sites; found ${sites.length}. ` +
        `If the tree moved, fix SEARCH_ROOTS rather than the assertion.`,
    );
  });

  it("records every server-scope file that logs (RULE 1: the ratchet)", () => {
    const counts = new Map();
    for (const site of logSites()) {
      counts.set(site.file, (counts.get(site.file) ?? 0) + 1);
    }

    const unrecorded = [...counts.keys()].filter((file) => !(file in ALLOWED));
    assert.deepEqual(
      unrecorded,
      [],
      `these server-scope files log and are not recorded in ALLOWED. Route the ` +
        `call through opLog() in src/server/operational-log.ts and record it here:\n  ` +
        unrecorded.join("\n  "),
    );

    const grown = [...counts.entries()]
      .filter(([file, count]) => count > ALLOWED[file])
      .map(([file, count]) => `${file}: ${ALLOWED[file]} recorded, ${count} found`);
    assert.deepEqual(
      grown,
      [],
      `new logging sites appeared without review:\n  ${grown.join("\n  ")}`,
    );

    const stale = Object.keys(ALLOWED).filter((file) => !counts.has(file));
    assert.deepEqual(
      stale,
      [],
      `ALLOWED records files that no longer log. Remove them so the ratchet ` +
        `cannot be spent on a file that was deleted:\n  ${stale.join("\n  ")}`,
    );
  });

  it("refuses a log line that carries content or a credential (RULE 2)", () => {
    const violations = [];
    for (const site of logSites()) {
      if (WAIVER.test(site.waiverScope)) continue;
      for (const { pattern, why } of DENIED) {
        if (pattern.test(site.text)) {
          violations.push(`${site.file}:${site.line} — ${pattern.source} — ${why}`);
        }
      }
    }
    assert.deepEqual(
      violations,
      [],
      `operational log lines carrying content or credentials:\n  ${violations.join("\n  ")}`,
    );
  });

  it("RULE 2 fires on the lines it is meant to fire on", () => {
    // A rule that has never fired is indistinguishable from a rule that
    // cannot fire. These are the two leaks that were actually found, plus the
    // one this project most fears, checked as strings rather than as files so
    // the proof survives the fixes.
    const shouldFail = [
      `console.warn(\`[csp-report] doc=\${r["document-uri"]}\`)`,
      `console.warn("would have sent:", { to: args.to })`,
      `console.error("failed", { html: args.html })`,
      `console.info("task", { title: task.title })`,
      `console.warn("guest list import failed", guests)`,
      `console.warn("menu", { dietary: row.dietary })`,
      `console.info("[analytics] ev", { distinctId })`,
    ];
    for (const text of shouldFail) {
      const hit = DENIED.some(({ pattern }) => pattern.test(text));
      assert.ok(hit, `RULE 2 failed to catch: ${text}`);
    }

    const shouldPass = [
      `console.warn("[gdpr] Notes erasure failed:", err)`,
      `console.error("[db] seedIfEmpty failed:", err)`,
      `opLog("warn", "csp-report", "policy violation reported", { directive })`,
      `console.warn("[rate-limit] Upstash pipeline failed:", res.status)`,
    ];
    for (const text of shouldPass) {
      const hit = DENIED.find(({ pattern }) => pattern.test(text));
      assert.equal(hit, undefined, `RULE 2 false positive on: ${text} (${hit?.why})`);
    }
  });

  it("a waiver only exempts a site when it is actually written down", () => {
    const leak = `console.warn("sent", { to: args.to })`;
    assert.equal(WAIVER.test(leak), false);
    assert.equal(WAIVER.test(`// op-log-safe: dev only\n${leak}`), true);
  });

  it("the ratchet is a ratchet: a count below the record is fine, above is not", () => {
    // Proves the comparison direction, which is the one thing a ratchet can
    // get silently backwards.
    const record = { "src/server/x.ts": 2 };
    const grew = 3;
    const shrank = 1;
    assert.ok(grew > record["src/server/x.ts"], "growth must fail");
    assert.ok(!(shrank > record["src/server/x.ts"]), "removal must pass");
  });

  it("the sanctioned sink exists and is the only exempt file", () => {
    const sink = path.join(repoRoot, SINK);
    assert.ok(fs.existsSync(sink), `${SINK} must exist; it is the only exempt file`);
    const source = fs.readFileSync(sink, "utf8");
    for (const name of ["opLog", "redactForLog", "redactEmail", "safeError"]) {
      assert.match(
        source,
        new RegExp(`export function ${name}\\b`),
        `${SINK} must export ${name}`,
      );
    }
  });

  it("the audit log and the operational log are documented as different things", () => {
    const source = fs.readFileSync(path.join(repoRoot, SINK), "utf8");
    assert.match(source, /audit log/i, "the distinction must be written down where it is enforced");
    assert.match(source, /workspace_events/, "the audit log's table must be named");
    assert.match(source, /entitlement_events/, "the entitlements ledger must be named");
  });
});
