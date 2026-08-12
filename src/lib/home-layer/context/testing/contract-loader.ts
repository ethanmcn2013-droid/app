/**
 * Loads a Home-context module that does not exist yet, and fails usefully when
 * it does not.
 *
 * Wave 1 is a contract wave: documents and failing tests only, no production
 * route, component, provider or migration. The context modules specified in
 * `docs/projects/home-operating-layer/contracts/HOME_CONTEXT.md` §11.1 are
 * therefore absent by design, and every test that imports one is red on
 * purpose. That red is the deliverable.
 *
 * ── Why the specifier is built at runtime ──────────────────────────────────
 *
 * `import("./policy")` with a *literal* specifier is resolved by TypeScript at
 * compile time, so a missing module fails `pnpm typecheck` for the whole
 * repository. Five other sessions share that gate. Breaking it to say something
 * these tests already say out loud, in words, would be a poor trade — so the
 * specifier is assembled from a variable, which TypeScript types as `any` and
 * does not resolve. The failure then lands where it belongs: at test time, with
 * a message that names the contract section requiring the module.
 *
 * The consequence is deliberate and worth stating: these tests are **not**
 * type-checked against the seam until the seam lands. They are executable
 * specification, not a type proof. `HOME_CONTEXT.md` §11.3 carries the type
 * obligations that a compiler will enforce once there is something to check.
 */

/** Repo-relative directory every module below lives in. */
export const CONTEXT_DIR = "src/lib/home-layer/context";

/** The contract that specifies all of them. */
export const CONTRACT_DOC =
  "docs/projects/home-operating-layer/contracts/HOME_CONTEXT.md";

export const PRIVACY_DOC =
  "docs/projects/home-operating-layer/contracts/SECURITY_AND_PRIVACY.md";

/** Modules specified in HOME_CONTEXT.md §11.1, in the order that section lists them. */
export const CONTRACTED_MODULES = [
  "policy",
  "receipt",
  "authorize-home-context",
  "cache-partition",
  "telemetry",
  "sentinel",
] as const;

export type ContractedModule = (typeof CONTRACTED_MODULES)[number];

/** Anything a contracted module exports. Untyped until the module lands. */
export type LoadedModule = Record<string, unknown>;

/**
 * Reads a named export, asserting it exists. A module that lands without one of
 * its contracted exports fails here, one step later than a missing file and
 * with a different message — which is the distinction the lead needs when
 * checking landed work against §11.1.
 */
export function exported(mod: LoadedModule, name: string): unknown {
  if (!(name in mod)) {
    throw new Error(
      `contracted export "${name}" is missing. ${CONTRACT_DOC} §11.1 requires it.`,
    );
  }
  return mod[name];
}

/** Reads a named export and asserts it is callable. */
export function fn(
  mod: LoadedModule,
  name: string,
): (...args: unknown[]) => unknown {
  const value = exported(mod, name);
  if (typeof value !== "function") {
    throw new Error(
      `contracted export "${name}" must be a function, got ${typeof value}.`,
    );
  }
  return value as (...args: unknown[]) => unknown;
}

/** Calls a contracted export and hands back a shape the tests can read. */
export async function call(
  mod: LoadedModule,
  name: string,
  ...args: unknown[]
): Promise<Record<string, unknown>> {
  return (await fn(mod, name)(...args)) as Record<string, unknown>;
}

/** Asserts a call throws, and hands back the error for inspection. */
export function throws(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error("expected a refusal, got a value");
}

/**
 * Imports a contracted module, or throws a message that explains the red.
 *
 * @param name       one of CONTRACTED_MODULES
 * @param requiredBy the assertion id and one line of what it specifies, e.g.
 *                   "H2 — the nine pipeline steps are in the sealed order"
 */
export async function loadContextModule(
  name: ContractedModule,
  requiredBy: string,
): Promise<LoadedModule> {
  const specifier = `../${name}.ts`;
  try {
    return (await import(specifier)) as LoadedModule;
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        ``,
        `  ${CONTEXT_DIR}/${name}.ts does not exist.`,
        ``,
        `  This is the expected Wave 1 result, not a broken test. The Home context`,
        `  seam is specified but deliberately not implemented in a contract wave.`,
        ``,
        `  Required by : ${requiredBy}`,
        `  Specified in: ${CONTRACT_DOC} §11.1`,
        `  Turns green : when the module lands and satisfies the assertion below.`,
        ``,
        `  Resolution error: ${cause}`,
        ``,
      ].join("\n"),
    );
  }
}

/**
 * A resolver set for `authorizeHomeContext`, built so a test can state one fact
 * and inherit sane defaults for the rest. Every field mirrors a pipeline step
 * in HOME_CONTEXT.md §1.2, and the defaults describe the ordinary case: a real
 * production session, a resolved identity, three authorized Projects, complete
 * coverage.
 *
 * `calls` records the order in which the pipeline asked for things. H2 and H3
 * assert against it — the ordering is the contract, so it has to be observable.
 */
export function stubResolvers(overrides: Record<string, unknown> = {}): {
  calls: string[];
  resolvers: Record<string, unknown>;
} {
  const calls: string[] = [];
  const record = <T>(step: string, value: T) => () => {
    calls.push(step);
    return value;
  };

  const resolvers: Record<string, unknown> = {
    accessPosture: record("access-posture", "production"),
    session: record("authenticate", { clerkId: "user_real" }),
    internalUser: record("resolve-internal-user", {
      id: "u_real",
      provisional: false,
    }),
    memberships: record("resolve-memberships", {
      projects: [
        { id: "ws_a", name: "Alpha", slug: "alpha", archivedAt: null, planningPeriodId: "pp_1", role: "member" },
        { id: "ws_b", name: "Bravo", slug: "bravo", archivedAt: null, planningPeriodId: "pp_1", role: "owner" },
        { id: "ws_c", name: "Charlie", slug: "charlie", archivedAt: null, planningPeriodId: null, role: "member" },
      ],
      unresolvedCount: 0,
      coverage: "complete",
    }),
    capabilities: record("resolve-capabilities", {
      ws_a: ["read"],
      ws_b: ["read", "administer"],
      ws_c: ["read"],
    }),
    ownedPlanningPeriodIds: record("validate-grouping", ["pp_1"]),
    activeProject: record("resolve-active-project", {
      kind: "ready",
      project: { id: "ws_a", name: "Alpha", slug: "alpha", archivedAt: null, planningPeriodId: "pp_1", role: "member" },
      source: "url",
    }),
    ...overrides,
  };

  return { calls, resolvers };
}

/** The default Home request: no explicit Project, no explicit grouping. */
export function contextRequest(
  searchParams: Record<string, string> = {},
  mode = "today",
): Record<string, unknown> {
  return { mode, searchParams };
}
