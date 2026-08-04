import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Vocabulary contract (T·114).
 *
 * D-011 (2026-07-21) ratified "Projects = Tasks workspaces". `workspace` stays
 * the code name for the entity — renaming the table, the column and the four
 * modules that join on it would be a multi-cycle migration for no user-visible
 * gain. What must not happen again is a component authoring the *word*.
 *
 * The rule this enforces: when a code name and a brand name differ, the entity
 * has exactly one translation point. Here that point is
 * `src/lib/planning/context.ts` (CONTEXT_TERMINOLOGY), and it is the only file
 * allowed to contain the user-facing noun.
 *
 * The leak that prompted this was a single hardcoded `<span>Workspace</span>`
 * in the board brief, which rendered above a sidebar that already said
 * "Projects". It survived a ratified decision and a founder review because
 * nothing checked for it.
 */

// Resolved from cwd: the suite runs from the repo root via `pnpm test`.
// `import.meta.dirname` is not populated under the tsx CJS transform this
// repo's TS tests run through.
const REPO_ROOT = process.cwd();
const SRC = path.join(REPO_ROOT, "src");

/** The one file permitted to name the entity for a user. */
const TRANSLATION_POINT = path.join("src", "lib", "planning", "context.ts");

/**
 * Paths exempt from the contract, each for a stated reason. Keep this list
 * short and justified — every entry is a place the word can still reach a
 * user, so an addition should be argued, not assumed.
 */
const ALLOWLIST: ReadonlyArray<{ path: string; because: string }> = [
  {
    path: TRANSLATION_POINT,
    because: "the sole translation point; it defines the user-facing noun",
  },
  {
    path: path.join("src", "lib", "planning", "vocabulary.test.ts"),
    because: "this contract names the word in order to forbid it",
  },
  {
    path: path.join("src", "modules", "notes", "app", "CaptureEmailRow.tsx"),
    because:
      "'Workspace plan' is a billing plan name owned by pricing, not the project entity",
  },
  {
    path: path.join("src", "components", "showcase", "cinematic-demo.tsx"),
    because: "frozen marketing capture; re-recorded, not edited, when copy changes",
  },
];

/** Attributes whose values a user reads, directly or through assistive tech. */
const USER_FACING_ATTRIBUTES = [
  "aria-label",
  "title",
  "placeholder",
  "alt",
] as const;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.(tsx?|mdx?)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function isAllowed(relative: string): boolean {
  return ALLOWLIST.some((entry) => entry.path === relative);
}

test("no component authors the user-facing entity noun", () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const relative = path.relative(REPO_ROOT, file);
    if (isAllowed(relative)) continue;

    const source = fs.readFileSync(file, "utf8");
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      const at = `${relative}:${index + 1}`;

      // Comments describe the code, where `workspace` is the correct name for
      // the entity. Only text a user can read is in scope.
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        return;
      }

      for (const attribute of USER_FACING_ATTRIBUTES) {
        const match = new RegExp(
          `${attribute}=["'\`][^"'\`]*\\bworkspaces?\\b`,
          "i",
        );
        if (match.test(line)) {
          offenders.push(`${at} — ${attribute} contains the entity noun`);
        }
      }

      // JSX text: >…Workspace…< on one line. Deliberately narrow; this catches
      // the literal that started this and not identifiers or comments.
      if (/>[^<>{}]*\bworkspaces?\b[^<>{}]*</i.test(line)) {
        offenders.push(`${at} — JSX text contains the entity noun`);
      }
    });
  }

  assert.deepEqual(
    offenders,
    [],
    `The user-facing noun is "Project" (D-011). Route the word through ` +
      `CONTEXT_TERMINOLOGY in ${TRANSLATION_POINT} instead of writing it in a ` +
      `component:\n  ${offenders.join("\n  ")}`,
  );
});

test("the allowlist stays justified and real", () => {
  for (const entry of ALLOWLIST) {
    assert.ok(
      entry.because.length > 0,
      `${entry.path} is allowlisted without a reason`,
    );
    assert.ok(
      fs.existsSync(path.join(REPO_ROOT, entry.path)),
      `${entry.path} is allowlisted but does not exist — remove the entry`,
    );
  }
});
