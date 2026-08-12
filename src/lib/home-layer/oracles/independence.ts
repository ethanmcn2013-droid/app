/**
 * Golden oracles · the independence guard.
 *
 * AN ORACLE THAT IMPORTS THE THING IT CHECKS IS NOT AN ORACLE. It is a
 * tautology with a test name on it, and it goes green on a wrong answer. The
 * discipline is easy to state and easy to lose in a refactor two waves from
 * now — "just import `rankToday`, it already does that" — so it is enforced
 * mechanically here rather than left to a comment.
 *
 * WHAT THIS DOES. It reads the oracle sources as TEXT and inspects their
 * import statements. Each guarded file may import raw record modules and
 * pinned constants; it may not import any module or binding that computes an
 * answer. The comparison layer (`oracles.test.ts`) is deliberately exempt —
 * comparing the two independent computations is the entire point, and it is
 * the only file allowed to hold both.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export const ORACLE_DIR = join(process.cwd(), "src/lib/home-layer/oracles");

/** Every file the guard applies to. The test file is not one of them. */
export const GUARDED_FILES: readonly string[] = Object.freeze([
  "oracle-clock.ts",
  "today.oracle.ts",
  "inbox.oracle.ts",
  "my-work.oracle.ts",
  "analytics.oracle.ts",
  "scope.oracle.ts",
  "scenario-inputs.ts",
]);

/**
 * Module specifiers no oracle may import. `derive.ts` is the reference ranking
 * implementation; `fixtures/index` is the barrel that re-exports it; the
 * estate's date helpers are what `oracle-clock.ts` exists to be independent of.
 */
export const FORBIDDEN_MODULES: readonly string[] = Object.freeze([
  "../fixtures/derive",
  "./derive",
  "../fixtures/index",
  "@/lib/planning/dates",
  "@/lib/home-layer/fixtures/derive",
]);

/**
 * Bindings no oracle may import under any specifier. Every one of these
 * computes an answer the oracles are supposed to produce independently.
 */
export const FORBIDDEN_BINDINGS: readonly string[] = Object.freeze([
  // Today
  "rankToday",
  "detectCandidates",
  "compareCandidates",
  "accountingBalances",
  "focusWeight",
  "SECTION_LIMITS",
  "TRIGGER_WEIGHTS",
  "TRIGGER_KINDS",
  "COMING_UP_HORIZON_DAYS",
  // Inbox
  "deriveBadge",
  "badgeDisplay",
  "effectiveDisposition",
  "occupiedStateCells",
  "ALL_STATE_CELLS",
  "visibilityResolver",
  // My work
  "projectMyWork",
  "groupRow",
  "compareMyWorkRows",
  "projectHasWaitingSignal",
  "encodeCursor",
  "decodeCursor",
  "MY_WORK_WINDOW",
  // Analytics
  "deriveClaims",
  "deriveExceptions",
  "deriveLedger",
  "deriveTrend",
  "receiptFor",
  "replayOpenWork",
  "resolveLens",
  "TREND_MINIMUM_SNAPSHOTS",
  // Composition
  "homeFixtureWorld",
  "labMatrix",
  // Clock derivations — constants are fine, arithmetic is not
  "addCalendarDays",
  "fixtureCalendarDate",
  "daysFromFixtureToday",
  "fixtureInstantAt",
  "calendarDateInTimeZone",
  "calendarDaysBetween",
  "seededHash",
  "seededAvatar",
  "localWallHour",
  "localWallMinute",
]);

export type ImportRecord = Readonly<{
  file: string;
  specifier: string;
  bindings: readonly string[];
  /** True for `import type { ... }`, which cannot carry a computation. */
  typeOnly: boolean;
}>;

const IMPORT_PATTERN =
  /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gu;

export function readOracleImports(file: string): readonly ImportRecord[] {
  const source = readFileSync(join(ORACLE_DIR, file), "utf8");
  const records: ImportRecord[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const clause = match[2];
    const bindings = [...clause.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/gu)]
      .map((entry) => entry[0])
      .filter((name) => name !== "type" && name !== "as");
    records.push(
      Object.freeze({
        file,
        specifier: match[3],
        bindings: Object.freeze(bindings),
        typeOnly: Boolean(match[1]),
      }),
    );
  }
  return Object.freeze(records);
}

export type IndependenceViolation = Readonly<{
  file: string;
  specifier: string;
  reason: string;
}>;

/**
 * Every violation, with the file and the exact reason. An empty result is the
 * only acceptable one, and a non-empty one names what to remove rather than
 * saying the suite is unhappy.
 */
export function checkOracleIndependence(): readonly IndependenceViolation[] {
  const violations: IndependenceViolation[] = [];
  for (const file of GUARDED_FILES) {
    for (const record of readOracleImports(file)) {
      if (FORBIDDEN_MODULES.includes(record.specifier)) {
        violations.push(
          Object.freeze({
            file,
            specifier: record.specifier,
            reason: `forbidden module: an oracle may not import ${record.specifier}`,
          }),
        );
        continue;
      }
      // A `import type` clause carries no runtime computation, so a shape
      // named after a derivation is not a violation — the value is.
      if (record.typeOnly) continue;
      for (const binding of record.bindings) {
        if (FORBIDDEN_BINDINGS.includes(binding)) {
          violations.push(
            Object.freeze({
              file,
              specifier: record.specifier,
              reason: `forbidden binding: ${binding} computes an answer this oracle must derive itself`,
            }),
          );
        }
      }
    }
  }
  return Object.freeze(violations);
}
