/**
 * Golden oracle · the authorized Project set, and what revocation results in.
 *
 * WRITTEN FROM `contracts/PROJECT_SCOPE.md` §2.5, §5, §8.1, §8.3 and
 * `contracts/HOME_CONTEXT.md` §8 — deliberately NOT from
 * `src/lib/home-layer/fixtures/scenarios.ts`'s `homeFixtureWorld`, which is
 * the composition this oracle certifies.
 *
 * TWO SEPARATE CLAIMS, KEPT SEPARATE.
 *
 * The AUTHORIZED SET is the actor's live membership set (§5 rule 3). It is
 * never derived from a Planning Period, because a Planning Period is a
 * grouping and never a scope of authority (§2.5). This oracle proves that by
 * recomputing the planning-period worlds' sets from the Projects' own
 * `planningPeriod` field and comparing, and by proving the all-projects worlds
 * carry a Project the period does not.
 *
 * REVOCATION collapses missing, forbidden and deleted into ONE neutral
 * `unavailable` (§8.1). Distinguishing them client-side is an existence leak.
 * So the oracle asserts what SURVIVES the transition — exactly `{ kind:
 * "unavailable" }` — and, separately, that not one byte of metadata does.
 */

import type { FixtureProjectSummary } from "@/lib/project-truth-fixture";
import type { HomeProjectState } from "../fixtures/projects";

/**
 * `HOME_ROUTE_AND_RETURN_CONTEXT.md` §4.1 `CONTEXT_ID`. Transcribed rather
 * than imported: a shape rule that only the implementation knows is not a
 * rule, it is a behaviour.
 */
export const ORACLE_CONTEXT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;

export function oracleIsContextId(value: string): boolean {
  return ORACLE_CONTEXT_ID_PATTERN.test(value);
}

/**
 * §5 rule 3 + §8.1 — the readable set is the authorized set minus every
 * Project whose route state collapsed to `unavailable`. Partial authorization
 * is DISCLOSED (rule 4): the shortfall is returned, never absorbed.
 */
export function oracleReadableProjects(input: {
  authorized: readonly string[];
  states: readonly HomeProjectState[];
}): Readonly<{
  readable: readonly string[];
  unresolved: readonly string[];
  authorizedCount: number;
  shortfall: number;
}> {
  const unresolved = input.states
    .filter((state) => state.routeState === "unavailable")
    .map((state) => state.projectId as string);
  const readable = input.authorized.filter((id) => !unresolved.includes(id));
  return Object.freeze({
    readable: Object.freeze(readable),
    unresolved: Object.freeze([...unresolved].sort()),
    authorizedCount: input.authorized.length,
    shortfall: input.authorized.length - readable.length,
  });
}

/**
 * §2.5 — the Projects a Planning Period groups. This is a GROUPING: it is what
 * a period-scoped read may READ TOGETHER, and it grants nothing. Recomputed
 * from each Project's own `planningPeriod`, so a scenario that hand-listed its
 * set is caught.
 */
export function oracleProjectsInPeriod(
  projects: readonly FixtureProjectSummary[],
  planningPeriodId: string,
): readonly string[] {
  return Object.freeze(
    projects
      .filter((project) => project.planningPeriod?.id === planningPeriodId)
      .map((project) => project.id)
      .sort(),
  );
}

/**
 * §8.1 / `HOME_CONTEXT.md` §8 — everything a revoked Project is allowed to
 * carry to a client. One neutral state, no reason, no metadata.
 */
export const ORACLE_REVOKED_CLIENT_PAYLOAD = Object.freeze({
  kind: "unavailable",
});

/**
 * Every field name whose presence beside a revoked Project would be a leak.
 * Transcribed from `HomeProjectState` plus the Project summary: the point is
 * that the SERVER record carries all of these and the CLIENT payload carries
 * none of them.
 */
export const ORACLE_REVOKED_LEAK_FIELDS: readonly string[] = Object.freeze([
  "name",
  "slug",
  "role",
  "capabilities",
  "planningPeriod",
  "position",
  "revision",
  "activeRootTaskCount",
  "lastSuccessfulReadIso",
  "staleAfterMs",
  "issues",
  "serverOnlyReason",
  "sourceStatus",
]);

export type OracleRevocation = Readonly<{
  /** What a client is handed. Must equal the neutral payload, exactly. */
  clientPayload: Readonly<{ kind: string }>;
  /** Field names that leaked into the client payload. Must always be empty. */
  leaked: readonly string[];
  /** The reason, which must exist server-side and appear nowhere else. */
  serverOnlyReason: string | null;
  /** Strings that must not appear in any client-facing artifact afterwards. */
  forbiddenStrings: readonly string[];
}>;

/**
 * §8.1 — build the client payload for a revoked Project from its server
 * record, and record everything that failed to be dropped. The server record
 * keeps its reason; the client payload is `{ kind: "unavailable" }` and
 * nothing else, whether the cause was missing, forbidden, deleted or revoked.
 */
export function oracleRevoke(input: {
  state: HomeProjectState;
  summary: FixtureProjectSummary;
  /** The Project's distinct word — the string a wrong render would expose. */
  distinctWord: string;
}): OracleRevocation {
  const clientPayload: Record<string, unknown> = { kind: "unavailable" };
  const leaked = ORACLE_REVOKED_LEAK_FIELDS.filter(
    (field) => field in clientPayload,
  );
  return Object.freeze({
    clientPayload: Object.freeze(clientPayload as { kind: string }),
    leaked: Object.freeze(leaked),
    serverOnlyReason: input.state.serverOnlyReason,
    forbiddenStrings: Object.freeze([input.summary.name, input.distinctWord]),
  });
}

/**
 * The scan a revoked world must survive: no forbidden string may appear
 * anywhere in the serialised client artifact. Returns every hit, with a path
 * so a failure names the field rather than the haystack.
 */
export function oracleScanForStrings(
  artifact: unknown,
  forbidden: readonly string[],
  path = "$",
): readonly string[] {
  const hits: string[] = [];
  const walk = (node: unknown, at: string): void => {
    if (typeof node === "string") {
      for (const needle of forbidden) {
        if (needle.length > 0 && node.includes(needle)) {
          hits.push(`${at} contains "${needle}"`);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${at}[${index}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        for (const needle of forbidden) {
          if (needle.length > 0 && key.includes(needle)) {
            hits.push(`${at}.${key} (key) contains "${needle}"`);
          }
        }
        walk(value, `${at}.${key}`);
      }
    }
  };
  walk(artifact, path);
  return Object.freeze(hits);
}
