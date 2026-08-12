/**
 * Home fixture universe · people, Planning Period and Projects.
 *
 * BUILT ON `src/lib/project-truth-fixture.ts`, NOT BESIDE IT. That file is
 * merged and owns fourteen Projects, three Planning Periods, the capability
 * table and the clock. This module imports all of it and adds exactly what
 * the Home canonical review story needs and the merged fixture does not
 * carry: The Orchard 2026 season, and the three couples as REAL Projects with
 * distinct canonical Tasks workspace ids.
 *
 * THE COLLISION, RECORDED RATHER THAN QUIETLY RESOLVED.
 * `src/lib/review-suite-fixture.ts` models "Mara & Finn", "Nora & Cian" and
 * "Aisling & Tom" as three Timeline-local children of ONE workspace
 * (`demo-ws` / `the-orchard`). The Home master brief requires them to be
 * three Projects, "each with a distinct canonical Tasks workspace id", and
 * The Orchard to be a Planning Period. Those two shapes are incompatible and
 * only one of them can be true under ADR 0001 (`Project = workspaces.id`,
 * a Planning Period is a grouping and never a scope of authority —
 * PROJECT_SCOPE §2.5).
 *
 * This module implements the brief's shape and leaves the review-suite
 * fixture untouched, exactly as `project-truth-fixture.ts` did before it.
 * Neither file is edited; the divergence is named here and reported to the
 * lead rather than reconciled by an implementation agent.
 */

import {
  fixtureCapabilitiesFor,
  PROJECT_TRUTH_ACTOR,
  PROJECT_TRUTH_IDS,
  PROJECT_TRUTH_INACCESSIBLE_ID,
  PROJECT_TRUTH_MALFORMED_ID,
  PROJECT_TRUTH_PROJECTS,
  type FixturePlanningPeriod,
  type FixtureProjectId,
  type FixtureProjectSummary,
} from "@/lib/project-truth-fixture";

// ── People ──────────────────────────────────────────────────────────────────

export type FixturePerson = Readonly<{
  id: string;
  name: string;
  /** How this person's own reading of Home is scoped. */
  seat: "owner" | "collaborator" | "guest";
}>;

/** The actor. The same actor the merged fixture tells its story from. */
export const HOME_FIXTURE_OWNER: FixturePerson = Object.freeze({
  id: PROJECT_TRUTH_ACTOR.id,
  name: PROJECT_TRUTH_ACTOR.name,
  seat: "owner",
});

/** A member of one Project. Narrower actions, and no cross-Project view. */
export const HOME_FIXTURE_COLLABORATOR: FixturePerson = Object.freeze({
  id: "collab-user-eabha",
  name: "Éabha",
  seat: "collaborator",
});

/**
 * A limited seat. Names, counts, evidence and mutations are all restricted,
 * and the restriction is disclosed rather than rendered as absence.
 */
export const HOME_FIXTURE_GUEST: FixturePerson = Object.freeze({
  id: "guest-user-dara",
  name: "Dara",
  seat: "guest",
});

/** A person the actor shares work with but may not name cross-Project. */
export const HOME_FIXTURE_OTHER_MEMBER: FixturePerson = Object.freeze({
  id: "collab-user-niamh",
  name: "Niamh",
  seat: "collaborator",
});

export const HOME_FIXTURE_PEOPLE: readonly FixturePerson[] = Object.freeze([
  HOME_FIXTURE_OWNER,
  HOME_FIXTURE_COLLABORATOR,
  HOME_FIXTURE_GUEST,
  HOME_FIXTURE_OTHER_MEMBER,
]);

// ── The Planning Period ─────────────────────────────────────────────────────

/**
 * The Orchard, 2026 season. A GROUPING, never a scope of authority
 * (PROJECT_SCOPE §2.5): it may widen Home Read Scope and it never grants
 * anything. Its span contains `HOME_FIXTURE_TODAY`, so it is the current one.
 *
 * NAME, verbatim from the master brief's canonical review story. The em dash
 * is the brief's, not this module's; `studio/BRAND.md` bans em dashes in
 * front-facing copy and this string renders in the lab. Flagged for the lead
 * rather than silently rewritten.
 */
export const HOME_FIXTURE_PERIOD_ORCHARD: FixturePlanningPeriod = Object.freeze({
  id: "home-period-orchard-2026",
  name: "The Orchard, 2026 season",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  contextType: "wedding_season",
});

// ── Project ids ─────────────────────────────────────────────────────────────

/** Every id satisfies HOME_ROUTE_AND_RETURN_CONTEXT §4.1 `CONTEXT_ID`. */
export const HOME_FIXTURE_PROJECT_IDS = {
  /** The Active Project the canonical review story is told from. */
  maraFinn: "home-ws-mara-finn",
  noraCian: "home-ws-nora-cian",
  aislingTom: "home-ws-aisling-tom",
  /** Shared with the actor. The seat `permission_changed` revokes. */
  sineadRuairi: "home-ws-sinead-ruairi",
} as const;

/** Reachable through no membership. Must resolve to neutral `unavailable`. */
export const HOME_FIXTURE_INACCESSIBLE_PROJECT_ID = PROJECT_TRUTH_INACCESSIBLE_ID;
/** Not even shape-valid. Rejected earlier, collapses to the same client state. */
export const HOME_FIXTURE_MALFORMED_PROJECT_ID = PROJECT_TRUTH_MALFORMED_ID;

// ── The four Orchard Projects ───────────────────────────────────────────────

export const HOME_FIXTURE_PROJECTS: readonly FixtureProjectSummary[] =
  Object.freeze([
    {
      id: HOME_FIXTURE_PROJECT_IDS.maraFinn,
      slug: "mara-finn",
      name: "Mara & Finn",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: HOME_FIXTURE_PERIOD_ORCHARD,
      position: 1,
      revision: 12,
      archivedAt: null,
      activeRootTaskCount: 11,
      disambiguator: null,
    },
    {
      id: HOME_FIXTURE_PROJECT_IDS.noraCian,
      slug: "nora-cian",
      name: "Nora & Cian",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: HOME_FIXTURE_PERIOD_ORCHARD,
      position: 2,
      revision: 5,
      archivedAt: null,
      // Deliberately a different count from Mara & Finn: a wrong-Project
      // render shows a wrong number as well as wrong words.
      activeRootTaskCount: 6,
      disambiguator: null,
    },
    {
      id: HOME_FIXTURE_PROJECT_IDS.aislingTom,
      slug: "aisling-tom",
      name: "Aisling & Tom",
      role: "primary-owner",
      capabilities: fixtureCapabilitiesFor("primary-owner"),
      planningPeriod: HOME_FIXTURE_PERIOD_ORCHARD,
      position: 3,
      revision: 2,
      archivedAt: null,
      activeRootTaskCount: 3,
      disambiguator: null,
    },
    {
      id: HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
      slug: "sinead-ruairi",
      name: "Sinéad & Ruairí",
      // The actor is a member here, not an owner. Shared Projects carry no
      // Planning Period: never expose another owner's period to a member.
      role: "member",
      capabilities: fixtureCapabilitiesFor("member"),
      planningPeriod: null,
      position: 1,
      revision: 4,
      archivedAt: null,
      activeRootTaskCount: 4,
      disambiguator: null,
    },
  ]);

/**
 * The distinct word per Project, in the merged fixture's own discipline: it
 * appears in this Project's copy and in no other's, so a wrong-Project render
 * is a failed string assertion rather than a judgement call.
 */
export const HOME_FIXTURE_PROJECT_WORDS: Readonly<Record<string, string>> =
  Object.freeze({
    [HOME_FIXTURE_PROJECT_IDS.maraFinn]: "Orchard",
    [HOME_FIXTURE_PROJECT_IDS.noraCian]: "Ballyhoura",
    [HOME_FIXTURE_PROJECT_IDS.aislingTom]: "Adare",
    [HOME_FIXTURE_PROJECT_IDS.sineadRuairi]: "Dromoland",
  });

// ── Per-Project route and source state ──────────────────────────────────────

/**
 * PROJECT_SCOPE §8. `archived` is its own state and never collapses into
 * `unavailable` or `empty`. Missing, forbidden and deleted all collapse into
 * ONE `unavailable` — distinguishing them to the client is an existence leak.
 */
export type HomeProjectRouteState = "ready" | "empty" | "archived" | "unavailable";

/**
 * Per-Project source status. Degradation is PER PROJECT (TODAY_RANKING §7 F5,
 * PROJECT_SCOPE §5 rule 7): one unavailable Project does not make the
 * aggregate unavailable, and does not make it complete either.
 */
export type HomeProjectSourceStatus =
  | "ready"
  | "partial"
  | "stale"
  | "unavailable"
  | "unsupported";

export type HomeProjectState = Readonly<{
  projectId: FixtureProjectId;
  routeState: HomeProjectRouteState;
  sourceStatus: HomeProjectSourceStatus;
  /**
   * SERVER-ONLY. Why the Project is unavailable. HOME_CONTEXT §8: the reason
   * lives in the server log keyed by receipt id and NOWHERE else — not in the
   * payload, not in a status, not in a header, not in a message string. It is
   * held here so a test can assert it never crosses to a client artifact.
   */
  serverOnlyReason: "missing" | "forbidden" | "deleted" | "revoked" | null;
  /** When the source was last read successfully, or null if never. */
  lastSuccessfulReadIso: string | null;
  /** Freshness threshold set BY the provider, never by Home. */
  staleAfterMs: number;
  /** Coverage issue codes, in the estate's existing vocabulary. */
  issues: readonly string[];
}>;

function readyState(
  projectId: FixtureProjectId,
  lastReadIso: string,
): HomeProjectState {
  return Object.freeze({
    projectId,
    routeState: "ready",
    sourceStatus: "ready",
    serverOnlyReason: null,
    lastSuccessfulReadIso: lastReadIso,
    staleAfterMs: 15 * 60_000,
    issues: Object.freeze([]),
  });
}

// ── The composed catalogs ───────────────────────────────────────────────────

/** The three Orchard Projects the canonical review story is told over. */
export const HOME_FIXTURE_ORCHARD_PROJECT_IDS: readonly FixtureProjectId[] =
  Object.freeze([
    HOME_FIXTURE_PROJECT_IDS.maraFinn,
    HOME_FIXTURE_PROJECT_IDS.noraCian,
    HOME_FIXTURE_PROJECT_IDS.aislingTom,
  ]);

/** The actor's full authorized set in the ordinary owner scenarios. */
export const HOME_FIXTURE_OWNER_PROJECT_IDS: readonly FixtureProjectId[] =
  Object.freeze([
    ...HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
  ]);

/**
 * The `scale` world: the four Orchard Projects plus every merged Project.
 * 4 + 14 = 18, which meets the brief's ">= 18 Projects" without inventing a
 * second population — the long name, the diacritics, the CJK name, the
 * duplicate names and the archived Project all come from the merged fixture,
 * already reviewed, already pinned by its own drift test.
 */
export const HOME_FIXTURE_SCALE_PROJECT_IDS: readonly FixtureProjectId[] =
  Object.freeze([
    ...HOME_FIXTURE_OWNER_PROJECT_IDS,
    ...PROJECT_TRUTH_PROJECTS.map((project) => project.id),
  ]);

/** Every Project summary this universe can resolve, Home's first. */
export const HOME_FIXTURE_ALL_PROJECTS: readonly FixtureProjectSummary[] =
  Object.freeze([...HOME_FIXTURE_PROJECTS, ...PROJECT_TRUTH_PROJECTS]);

export function homeFixtureProject(id: FixtureProjectId): FixtureProjectSummary {
  const found = HOME_FIXTURE_ALL_PROJECTS.find((project) => project.id === id);
  if (!found) throw new Error(`home-fixtures/projects: unknown Project ${id}`);
  return found;
}

/** The Active Project of the canonical review story. */
export const HOME_FIXTURE_ACTIVE_PROJECT = homeFixtureProject(
  HOME_FIXTURE_PROJECT_IDS.maraFinn,
);

// ── Named per-scenario Project states ───────────────────────────────────────

const READ_AT = "2026-07-16T07:38:00.000Z";

/** Everything answered. The signature world. */
export const HOME_PROJECT_STATES_HEALTHY: readonly HomeProjectState[] =
  Object.freeze(
    HOME_FIXTURE_OWNER_PROJECT_IDS.map((id) => readyState(id, READ_AT)),
  );

/**
 * `partial_coverage`. Aisling & Tom answered for part of its scope only.
 * Nothing here is zero, and nothing here is reassuring.
 */
export const HOME_PROJECT_STATES_PARTIAL: readonly HomeProjectState[] =
  Object.freeze([
    readyState(HOME_FIXTURE_PROJECT_IDS.maraFinn, READ_AT),
    readyState(HOME_FIXTURE_PROJECT_IDS.noraCian, READ_AT),
    Object.freeze({
      projectId: HOME_FIXTURE_PROJECT_IDS.aislingTom,
      routeState: "ready" as const,
      sourceStatus: "partial" as const,
      serverOnlyReason: null,
      lastSuccessfulReadIso: READ_AT,
      staleAfterMs: 15 * 60_000,
      issues: Object.freeze(["tasks_record_limit_reached"]),
    }),
    readyState(HOME_FIXTURE_PROJECT_IDS.sineadRuairi, READ_AT),
  ]);

/**
 * `stale_data`. Read succeeded, and it is past `staleAfter`. The surface
 * renders the age in words and says when the last successful read was. It
 * never describes the data as current.
 */
export const HOME_PROJECT_STATES_STALE: readonly HomeProjectState[] =
  Object.freeze(
    HOME_FIXTURE_OWNER_PROJECT_IDS.map((id) =>
      Object.freeze({
        projectId: id,
        routeState: "ready" as const,
        sourceStatus: "stale" as const,
        serverOnlyReason: null,
        // 2 h 55 min before the pinned asOf, against a 15-minute threshold.
        lastSuccessfulReadIso: "2026-07-16T04:45:00.000Z",
        staleAfterMs: 15 * 60_000,
        issues: Object.freeze(["read_older_than_stale_after"]),
      }),
    ),
  );

/**
 * `provider_failure`. Nora & Cian could not be read at all; the other three
 * stay truthful. Never zero, never all clear, and never a global outage.
 */
export const HOME_PROJECT_STATES_PROVIDER_FAILURE: readonly HomeProjectState[] =
  Object.freeze([
    readyState(HOME_FIXTURE_PROJECT_IDS.maraFinn, READ_AT),
    Object.freeze({
      projectId: HOME_FIXTURE_PROJECT_IDS.noraCian,
      routeState: "ready" as const,
      sourceStatus: "unavailable" as const,
      serverOnlyReason: null,
      lastSuccessfulReadIso: "2026-07-15T18:02:00.000Z",
      staleAfterMs: 15 * 60_000,
      issues: Object.freeze(["source_read_failed"]),
    }),
    readyState(HOME_FIXTURE_PROJECT_IDS.aislingTom, READ_AT),
    readyState(HOME_FIXTURE_PROJECT_IDS.sineadRuairi, READ_AT),
  ]);

/**
 * `permission_changed`. Sinéad & Ruairí was visible in the list and is
 * revoked before the detail read. The client sees ONE neutral `unavailable`;
 * the reason stays server-side and no metadata survives — not the name, not
 * the count, not the last-read time.
 */
export const HOME_PROJECT_STATES_REVOKED: readonly HomeProjectState[] =
  Object.freeze([
    readyState(HOME_FIXTURE_PROJECT_IDS.maraFinn, READ_AT),
    readyState(HOME_FIXTURE_PROJECT_IDS.noraCian, READ_AT),
    readyState(HOME_FIXTURE_PROJECT_IDS.aislingTom, READ_AT),
    Object.freeze({
      projectId: HOME_FIXTURE_PROJECT_IDS.sineadRuairi,
      routeState: "unavailable" as const,
      sourceStatus: "unavailable" as const,
      serverOnlyReason: "revoked" as const,
      lastSuccessfulReadIso: null,
      staleAfterMs: 15 * 60_000,
      issues: Object.freeze([]),
    }),
  ]);

/**
 * What a revoked Project is allowed to carry to the client. Everything else
 * on `HomeProjectState` is server-only. HOME_CONTEXT §8, SECURITY §6.
 */
export const REVOKED_CLIENT_PAYLOAD = Object.freeze({ kind: "unavailable" });

/** Every field name that must NOT appear beside a revoked Project client-side. */
export const REVOKED_LEAK_FIELDS: readonly string[] = Object.freeze([
  "name",
  "slug",
  "activeRootTaskCount",
  "lastSuccessfulReadIso",
  "serverOnlyReason",
  "planningPeriod",
  "role",
]);

export { PROJECT_TRUTH_IDS as MERGED_PROJECT_IDS };
