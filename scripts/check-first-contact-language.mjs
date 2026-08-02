#!/usr/bin/env node
// First-contact language check — north star priority 3 (AGENTS.md §North star).
//
// The bar: someone who has never used a project-management tool can pick this
// up unaided. Two things lock such a person out — vocabulary that assumes the
// discipline (backlog, sprint, WIP) and vocabulary that assumes the stack
// (payload, endpoint, boolean). This fails on either, in text a user can read.
//
// Scope is rendered copy only: JSX text nodes and the string props that reach
// the screen or assistive technology. Identifiers and types are not copy —
// `assigneeId` is fine; "Assignee" on a button is the thing being tested.
// Comments are stripped before scanning for the same reason.
//
// Known debt may only shrink, matching the rule the quality operating system
// already uses. BASELINE records what existed when the north star was set.
// A new occurrence fails. A baselined occurrence that disappears also fails,
// so the list cannot silently drift back up.

import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { relative } from "node:path";

// Words that assume the discipline. A first-timer has no referent for these.
const DISCIPLINE = [
  "backlog", "sprint", "kanban", "epic", "swimlane", "standup", "stand-up",
  "velocity", "burndown", "burn-down", "story point", "scrum",
  "retrospective", "triage", "wip", "work in progress", "throughput",
  "cycle time", "lead time", "iteration", "blocker", "blocked by",
];

// Words that assume the stack. The operator's phrasing: users must not be
// locked out from a technical sense.
const TECHNICAL = [
  "payload", "endpoint", "webhook", "boolean", "null", "undefined",
  "schema", "query string", "config", "deprecated", "serialize",
  "mutation", "idempotent", "4xx", "5xx", "stack trace", "nan",
];

const TERMS = [...DISCIPLINE, ...TECHNICAL];

// JSX lives only in .tsx. Showcase is a closed cinematic system with its own
// register; tests and type declarations are not shipped copy.
const SOURCE_GLOB = "src/**/*.tsx";
const EXCLUDE = /(\.test\.|\.spec\.|[/\\]showcase[/\\]|\.d\.ts$|[/\\]__)/;

// JSX text between tags. The `>` must not be the tail of `=>`, `->` or `>=`;
// the text itself must read as prose — no code punctuation at all.
const PROSE = "A-Za-z0-9 ,.'’‘“”!?:;%–—\\-…";
const JSX_TEXT = new RegExp(`(?<![=\\->])>([${PROSE}]*[A-Za-z]{2}[${PROSE}]*)<`, "g");

// Quoted string literals and the static segments of template literals. Copy
// reaches the screen through more than plain props: `aria-label={\`Blocked by
// ${n} tasks\`}` and `{cleared ? "Was blocked by" : "Blocked by"}` are both
// user-visible, and neither is a simple prop-equals-string.
const QUOTED = /"([^"\n\\]{2,})"|'([^'\n\\]{2,})'/g;
const TEMPLATE = /`([^`]*)`/g;

// Never copy: styling, routes, module specifiers, test ids, URLs.
const CLASS_ATTR = /\b(?:className|class)\s*=\s*(?:"[^"]*"|'[^']*'|\{[^{}]*\})/g;
const NOT_COPY =
  /^(?:https?:|mailto:|\/|\.\/|\.\.\/|@\/|#|data-|aria-[a-z]+$|[a-z]+(?:-[a-z0-9]+)+$|[A-Z_]+$)/;

/**
 * Copy reads like a sentence. Tailwind reads like tokens. The discriminator is
 * how many whitespace-separated pieces are plain alphabetic words:
 * "Blocked by 3 tasks" has three, "flex flex-col gap-0.5" has one.
 *
 * This can be generous — a candidate is only ever reported when it also
 * contains a listed term, so admitting a non-copy string costs nothing unless
 * that string also happens to say "backlog".
 */
function looksLikeProse(value) {
  if (NOT_COPY.test(value)) return false;
  if (value.includes("\n")) return false;
  const tokens = value.split(/\s+/).filter(Boolean);
  const alphaTokens = tokens.filter((t) => /^[A-Za-z][A-Za-z'’]*$/.test(t));
  if (alphaTokens.length >= 2) return true;
  return tokens.length === 1 && /^(?:[A-Z][a-z]{3,}|[A-Z]{2,})$/.test(tokens[0]);
}

/**
 * Baseline recorded 2026-08-01, the day the north star was set. Each entry is
 * `file :: term`. This is recorded debt, not permission — it may only shrink.
 *
 * Two classes, and they are not the same thing.
 */
const BASELINE = new Set([
  // CORRECT AS WRITTEN — the refusal renders as a strikethrough list
  // (`const STRIKES`), so the word is on screen precisely to be crossed out.
  // Sentence-level negation cannot see markup, hence the entry.
  "src/components/marketing/about-manifesto.tsx :: sprint",
  "src/components/marketing/about-manifesto.tsx :: epic",
  "src/components/marketing/about-manifesto.tsx :: triage",
  "src/components/marketing/about-manifesto.tsx :: burndown",
  "src/components/marketing/about-manifesto.tsx :: backlog",
  "src/app/social/x-banner/opengraph-image.tsx :: sprint",
  "src/app/social/x-banner/opengraph-image.tsx :: epic",
  "src/app/social/x-banner/opengraph-image.tsx :: triage",
  "src/app/social/x-banner/opengraph-image.tsx :: burndown",
  "src/app/social/x-banner/opengraph-image.tsx :: backlog",

  // REAL DEBT — used straight, awaiting an operator ruling on the plainer
  // word. Recorded rather than rewritten because picking product vocabulary
  // is a taste call, and this script measures, it does not decide.
  //
  //   "list for triage" — three marketing pages describe a view this way.
  //   "Blocked by" / "Was blocked by" — the code concept stays `blocker`;
  //   only the label is in question, and "Waiting on" would match the
  //   Waiting column the board already ships.
  "src/components/marketing/features.tsx :: triage",
  "src/components/marketing/for-freelancers.tsx :: triage",
  "src/components/marketing/for-students.tsx :: triage",
  "src/components/app/blockers/blocker-badge.tsx :: blocked by",
  "src/components/lab/task-detail/task-detail.tsx :: blocked by",
]);

/** Remove block and line comments without eating the `//` inside a URL. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, "$1");
}

// Naming a word in order to refuse it is the brand voice working, not a
// lock-out: "Nothing here says sprint or stakeholder" and "No story points,
// velocity, burndown" both teach a first-timer that they are safe here. The
// refusal scopes to its sentence, because these are usually lists.
const REFUSAL =
  /(?:^|[^a-z])(?:no|not|nothing|none|never|without|isn['’]?t|aren['’]?t|won['’]?t|don['’]?t|doesn['’]?t|didn['’]?t|free of|instead of|unlike|rather than|skip|forget|refuse|banned|neither|nor)(?:[^a-z]|$)/;

function sentencesOf(text) {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function termsIn(text) {
  const hits = [];
  for (const term of TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Word-boundary match so "wip" does not fire inside "wipe" and "null"
    // does not fire inside "annulled".
    const re = new RegExp(`(?:^|[^a-z0-9-])${escaped}(?:[^a-z0-9-]|$)`);
    const carrying = sentencesOf(text.toLowerCase()).filter((s) => re.test(s));
    if (carrying.length === 0) continue;
    // Report only if at least one sentence uses the term straight.
    if (carrying.some((s) => !REFUSAL.test(s))) hits.push(term);
  }
  return hits;
}

function copyStringsFrom(source) {
  const candidates = [];

  for (const m of source.matchAll(JSX_TEXT)) candidates.push(m[1]);

  // Styling never carries copy, and its values are the main source of
  // sentence-shaped noise. Drop them before reading string literals.
  const withoutClasses = source.replace(CLASS_ATTR, " ");

  for (const m of withoutClasses.matchAll(QUOTED)) {
    candidates.push(m[1] ?? m[2] ?? "");
  }
  for (const m of withoutClasses.matchAll(TEMPLATE)) {
    // Static segments only: an interpolation is a value, not copy.
    for (const segment of m[1].split(/\$\{[^}]*\}/)) candidates.push(segment);
  }

  return candidates.map((c) => c.trim()).filter((c) => c && looksLikeProse(c));
}

const files = globSync(SOURCE_GLOB).filter((f) => !EXCLUDE.test(f));
const unique = new Map();

for (const file of files) {
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");
  let source;
  try {
    source = stripComments(readFileSync(file, "utf8"));
  } catch {
    continue;
  }
  for (const copy of copyStringsFrom(source)) {
    for (const term of termsIn(copy)) {
      const key = `${rel} :: ${term}`;
      if (!unique.has(key)) unique.set(key, { key, file: rel, term, copy });
    }
  }
}

const introduced = [...unique.values()].filter((h) => !BASELINE.has(h.key));
const fixed = [...BASELINE].filter((key) => !unique.has(key));

if (introduced.length === 0 && fixed.length === 0) {
  console.log(
    `first-contact:language: clean — ${files.length} files scanned, ${BASELINE.size} baselined occurrence(s) unchanged.`,
  );
  process.exit(0);
}

if (introduced.length > 0) {
  console.error(
    `first-contact:language: ${introduced.length} occurrence(s) of locked-out vocabulary in user-facing copy.\n`,
  );
  console.error("The bar (AGENTS.md §North star, priority 3): someone who has never used a");
  console.error("project-management tool must understand this unaided. Rewrite the copy, or");
  console.error("if the word is genuinely the plainest option, add it to BASELINE.\n");
  for (const hit of introduced) {
    const shown = hit.copy.length > 96 ? `${hit.copy.slice(0, 96)}…` : hit.copy;
    console.error(`  ${hit.file}`);
    console.error(`    "${shown}"`);
    console.error(`    -> "${hit.term}"\n`);
  }
}

if (fixed.length > 0) {
  console.error(`first-contact:language: ${fixed.length} baselined occurrence(s) no longer present.\n`);
  console.error("Good — the debt shrank. Remove these from BASELINE so it cannot creep back:\n");
  for (const key of fixed) console.error(`  ${key}`);
  console.error("");
}

process.exit(1);
