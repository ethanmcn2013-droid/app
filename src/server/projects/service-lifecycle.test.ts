/**
 * The consolidated Project lifecycle service, executed against a real libSQL
 * scratch database — WP6 lane D.
 *
 * ── What this file proves, and how ─────────────────────────────────────────
 *
 * `src/server/planning-security-contract.test.mjs` and
 * `src/server/published-surface-revalidation.test.mjs` pin the WIRING by
 * source inspection: one delete path, capability proofs before writes,
 * receipts on every mutation. This file is the runtime half. Every operation
 * of `src/server/projects/service.ts` runs for real, three ways each:
 *
 *   1. the authorized happy path, asserted on the rows it wrote;
 *   2. the capability-refused path — a plain member, a non-member, and (for
 *      delete) a co-owner, each thrown out with the adapter's refusal copy
 *      and the rows untouched;
 *   3. the receipt path: the Project vanishes between the capability proof
 *      and the write, and the operation must throw rather than report ok.
 *
 * The vanish is staged without touching production code: the modules read
 * `db` off `@/server/db` at every use (live-binding property access), so the
 * test serves an ACCESS PLAN — first N accesses see the full database, later
 * accesses see a copy with the workspace row missing. The proof passes on the
 * full db, the write lands on the empty one, and the `.returning()` receipt
 * is the only thing standing between that and a silent "ok". The refusal
 * strings differ per stage (`REFUSAL` for the proof, "Workspace not found."
 * for the receipt), so each test can tell exactly which guard fired.
 *
 * The last section drives the two real entry points — planning.ts's
 * `deleteProjectAction` (sidebar) and settings.ts's `deleteWorkspaceAction`
 * (Settings) — end to end, and asserts the E06.12 `/p/{slug}` revalidation
 * is recorded from BOTH. That is the incident this consolidation exists to
 * make unrepeatable: before WP6 only the Settings path had the fix.
 *
 * Collaborator stand-ins follow the house pattern
 * (`src/server/actions/preferences-theme-allow-list.test.ts`): seeded into
 * `require.cache` before the modules under test are first required, so the
 * real action and service bodies run unmodified.
 *
 * Run:
 *   node --import tsx --import ./src/test/register-server-only.mjs --test \
 *     src/server/projects/service-lifecycle.test.ts
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";

/**
 * File-backed scratch databases, one per test, in the shape of
 * `src/modules/timeline/server/db/binding-write-gates.test.ts`. NOT
 * `freshMemoryDb`: the service wraps its multi-statement writes in
 * `db.transaction`, and the libSQL local client opens a transaction on a
 * separate connection — against `:memory:` that connection is a different,
 * empty database. A file URL gives every connection the same database.
 * Schema comes from the same content-addressed runtime baseline the memory
 * helper applies (drizzle files >= 0014; 0000–0013 are adoption evidence,
 * never a bootstrap path), with foreign keys OFF so the explicit cascade
 * predicates are what these tests prove.
 */
const SCRATCH_DIR = mkdtempSync(path.join(tmpdir(), "wp6-service-"));
const RUNTIME_BASELINE = readdirSync(path.join(process.cwd(), "drizzle"))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file >= "0014_")
  .sort()
  .map((file) =>
    readFileSync(path.join(process.cwd(), "drizzle", file), "utf8"),
  );

const openClients: Client[] = [];
let scratchSeq = 0;

type ScratchDb = { client: Client; db: ReturnType<typeof drizzle<typeof schema>> };

async function freshFileDb(): Promise<ScratchDb> {
  const url = pathToFileURL(
    path.join(SCRATCH_DIR, `scratch-${scratchSeq++}.db`),
  ).href;
  const client = createClient({ url });
  openClients.push(client);
  await client.execute("PRAGMA foreign_keys = OFF");
  for (const migration of RUNTIME_BASELINE) {
    await client.executeMultiple(migration);
  }
  return { client, db: drizzle(client, { schema }) };
}

after(() => {
  for (const client of openClients) client.close();
  try {
    rmSync(SCRATCH_DIR, { recursive: true, force: true });
  } catch {
    // Scratch space in tmpdir; a lingering handle on Windows is not worth
    // failing the suite over.
  }
});

const req = createRequire(__filename);

// ── Recorders ───────────────────────────────────────────────────────────────

let revalidated: string[] = [];
let emitted: Array<Record<string, unknown>> = [];
const cookieJar = new Map<string, string>();

/** The actor the stubbed auth resolves. Set per test. */
let currentActor = "user-primary";
/** The stubbed fail-closed ambient Project. Set per test. */
let currentAmbient: string | null = null;

/**
 * The database access plan. Every module under test reads `db` off
 * `@/server/db` per statement; each read consumes the next entry, and the
 * last entry is sticky. `[full]` is normal operation; `[full, missing]`
 * stages "the Project vanished between the proof and the write".
 */
let dbPlan: Array<ScratchDb["db"]> = [];
function planDb(...dbs: Array<ScratchDb["db"]>) {
  dbPlan = dbs;
}

function seed(specifier: string, exports: Record<string, unknown>) {
  const filename = req.resolve(specifier);
  req.cache[filename] = {
    id: filename,
    filename,
    path: path.dirname(filename),
    loaded: true,
    exports,
    children: [],
    paths: [],
  } as never;
}

// Seeded at module scope: none of the modules under test may have been
// required yet.
seed("@/server/db", {
  get db() {
    if (dbPlan.length === 0) throw new Error("test forgot to plan a db");
    return dbPlan.length > 1 ? (dbPlan.shift() as ScratchDb["db"]) : dbPlan[0];
  },
});
seed("next/cache", {
  revalidatePath: (p: string) => {
    revalidated.push(p);
  },
});
seed("next/headers", {
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
});
seed("@/server/auth", {
  ACTIVE_WORKSPACE_COOKIE_NAME: "tasks_active_ws",
  getCurrentUser: async () => currentActor,
  getActiveWorkspaceOrNull: async () => currentAmbient,
});
seed("@/server/events", {
  emitTasksChanged: (opts: Record<string, unknown> = {}) => {
    emitted.push(opts);
  },
});
seed("@/lib/analytics/posthog", {
  captureServerEvent: async () => {},
});
seed("@sentry/nextjs", {
  captureException: () => {},
});
seed("@clerk/nextjs/server", {
  currentUser: async () => null,
});
seed("@/server/email", {
  sendEmail: async () => ({ ok: true }),
  inviteEmailHtml: () => "",
});
seed("@/server/actions/seed", {
  seedDomainAction: async () => ({ ok: true }),
});

// ── Fixture cast ────────────────────────────────────────────────────────────

/** Primary owner: `workspaces.owner_user_id` AND an owner membership row. */
const PRIMARY = "user-primary";
/** Co-owner: an owner membership row, but not the workspace's primary owner. */
const CO_OWNER = "user-co-owner";
/** Plain member. */
const MEMBER = "user-member";
/** No membership at all. */
const OUTSIDER = "user-outsider";

const WS = "ws-alpha";
const SLUG = "alpha-slug";

/** A refusal string no production adapter uses, so a proof refusal and a
 *  write receipt ("Workspace not found.") are distinguishable in every
 *  assertion below. */
const REFUSAL = "refused-by-capability-proof";

async function seedFixture(
  client: ScratchDb["client"],
  options: {
    published?: boolean;
    archived?: boolean;
    workspacePeriod?: string | null;
    contextType?: string;
  } = {},
): Promise<void> {
  const published = options.published ? 1_700_000_000 : null;
  const archived = options.archived ? 1_700_000_000 : null;
  const period = options.workspacePeriod ?? null;
  const contextType = options.contextType ?? "project";
  await client.execute({
    sql: `INSERT INTO workspaces
            (id, slug, name, owner_user_id, planning_period_id, context_type,
             position, revision, published_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, 1000, 1, ?, ?)`,
    args: [WS, SLUG, "Alpha", PRIMARY, period, contextType, published, archived],
  });
  await client.executeMultiple(`
    INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
      ('${WS}', '${PRIMARY}', 'owner'),
      ('${WS}', '${CO_OWNER}', 'owner'),
      ('${WS}', '${MEMBER}', 'member');
  `);
}

async function seedPeriod(
  client: ScratchDb["client"],
  id: string,
  owner: string,
  options: { contextType?: string; archived?: boolean } = {},
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO planning_periods (id, owner_user_id, name, context_type, archived_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      id,
      owner,
      `Period ${id}`,
      options.contextType ?? "general",
      options.archived ? 1_700_000_000 : null,
    ],
  });
}

async function workspaceRow(client: ScratchDb["client"], id = WS) {
  const rows = await client.execute({
    sql: `SELECT id, name, position, revision, archived_at, planning_period_id
          FROM workspaces WHERE id = ?`,
    args: [id],
  });
  return rows.rows[0] ?? null;
}

async function count(client: ScratchDb["client"], sqlText: string) {
  const rows = await client.execute(sqlText);
  return Number(rows.rows[0]?.n ?? 0);
}

// ── The modules under test, imported after the stand-ins are seeded ─────────

let service: typeof import("@/server/projects/service");
let planning: typeof import("@/server/actions/planning");
let settings: typeof import("@/server/actions/settings");

let full: ScratchDb;

before(async () => {
  service = await import("@/server/projects/service");
  planning = await import("@/server/actions/planning");
  settings = await import("@/server/actions/settings");
});

beforeEach(async () => {
  revalidated = [];
  emitted = [];
  cookieJar.clear();
  currentActor = PRIMARY;
  currentAmbient = null;
  full = await freshFileDb();
  planDb(full.db);
});

/** A second scratch db whose workspaces table has no rows at all — the
 *  "vanished mid-flight" stage for receipt tests. */
async function missingDb(): Promise<ScratchDb["db"]> {
  const scratch = await freshFileDb();
  return scratch.db;
}

// ── createProject ───────────────────────────────────────────────────────────

describe("createProject", () => {
  it("creates a periodless project with an owner membership row", async () => {
    const created = await service.createProject({
      actorUserId: PRIMARY,
      name: "New thing",
      planningPeriodId: null,
    });
    assert.match(created.id, /^ws-/);
    assert.match(created.slug, /^new-thing-/);
    assert.equal(created.periodContext, "general");
    assert.equal(created.contextType, "project");
    const row = await workspaceRow(full.client, created.id);
    assert.ok(row, "the workspace row must exist");
    const members = await full.client.execute({
      sql: `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?`,
      args: [created.id, PRIMARY],
    });
    assert.equal(members.rows[0]?.role, "owner");
    assert.ok(revalidated.includes("/app"));
  });

  it("files into an owned period and inherits its context", async () => {
    await seedPeriod(full.client, "pp-mine", PRIMARY, {
      contextType: "school_year",
    });
    const created = await service.createProject({
      actorUserId: PRIMARY,
      name: "5th class",
      planningPeriodId: "pp-mine",
    });
    assert.equal(created.periodContext, "school_year");
    assert.equal(created.contextType, "class");
    const row = await workspaceRow(full.client, created.id);
    assert.equal(row?.planning_period_id, "pp-mine");
  });

  it("refuses someone else's period, and an archived one", async () => {
    await seedPeriod(full.client, "pp-theirs", OUTSIDER);
    await assert.rejects(
      service.createProject({
        actorUserId: PRIMARY,
        name: "X",
        planningPeriodId: "pp-theirs",
      }),
      /Planning period not found\./,
    );
    await seedPeriod(full.client, "pp-archived", PRIMARY, { archived: true });
    await assert.rejects(
      service.createProject({
        actorUserId: PRIMARY,
        name: "X",
        planningPeriodId: "pp-archived",
      }),
      /Restore this planning period first\./,
    );
  });
});

// ── renameProject ───────────────────────────────────────────────────────────

describe("renameProject", () => {
  it("renames for an owner and bumps the revision", async () => {
    await seedFixture(full.client);
    const renamed = await service.renameProject({
      actorUserId: PRIMARY,
      projectId: WS,
      name: "  Renamed  ",
      refusal: REFUSAL,
    });
    assert.equal(renamed.id, WS);
    const row = await workspaceRow(full.client);
    assert.equal(row?.name, "Renamed");
    assert.equal(Number(row?.revision), 2);
    assert.ok(revalidated.includes("/app"));
  });

  it("refuses a plain member and a non-member with the same message", async () => {
    await seedFixture(full.client);
    for (const actor of [MEMBER, OUTSIDER]) {
      await assert.rejects(
        service.renameProject({
          actorUserId: actor,
          projectId: WS,
          name: "Taken over",
          refusal: REFUSAL,
        }),
        new RegExp(REFUSAL),
      );
    }
    assert.equal((await workspaceRow(full.client))?.name, "Alpha");
  });

  it("refuses an empty name", async () => {
    await seedFixture(full.client);
    await assert.rejects(
      service.renameProject({
        actorUserId: PRIMARY,
        projectId: WS,
        name: "   ",
        refusal: REFUSAL,
      }),
      /Workspace name can’t be empty\./,
    );
  });

  it("throws the receipt when the row vanishes between proof and write", async () => {
    await seedFixture(full.client);
    planDb(full.db, await missingDb());
    await assert.rejects(
      service.renameProject({
        actorUserId: PRIMARY,
        projectId: WS,
        name: "Ghost",
        refusal: REFUSAL,
      }),
      /Workspace not found\./,
      "the proof passed (a refusal would say so); only the .returning() receipt can throw here",
    );
    assert.equal((await workspaceRow(full.client))?.name, "Alpha");
  });
});

// ── reorderProject ──────────────────────────────────────────────────────────

describe("reorderProject", () => {
  it("moves the position for an owner", async () => {
    await seedFixture(full.client);
    await service.reorderProject({
      actorUserId: CO_OWNER,
      projectId: WS,
      position: 4200,
      refusal: REFUSAL,
    });
    const row = await workspaceRow(full.client);
    assert.equal(Number(row?.position), 4200);
    assert.equal(Number(row?.revision), 2);
  });

  it("refuses a plain member", async () => {
    await seedFixture(full.client);
    await assert.rejects(
      service.reorderProject({
        actorUserId: MEMBER,
        projectId: WS,
        position: 1,
        refusal: REFUSAL,
      }),
      new RegExp(REFUSAL),
    );
  });

  it("throws the receipt when the row vanishes between proof and write", async () => {
    await seedFixture(full.client);
    planDb(full.db, await missingDb());
    await assert.rejects(
      service.reorderProject({
        actorUserId: PRIMARY,
        projectId: WS,
        position: 9,
        refusal: REFUSAL,
      }),
      /Workspace not found\./,
    );
  });
});

// ── setProjectArchived ──────────────────────────────────────────────────────

describe("setProjectArchived", () => {
  it("archives, and restore stays reachable on the archived Project", async () => {
    await seedFixture(full.client);
    await service.setProjectArchived({
      actorUserId: PRIMARY,
      projectId: WS,
      archived: true,
      refusal: REFUSAL,
    });
    let row = await workspaceRow(full.client);
    assert.ok(row?.archived_at, "archivedAt must be set");
    assert.equal(Number(row?.revision), 2);
    // The Project is ARCHIVED now; restore must still be granted (the
    // archived branch of the capability matrix keeps manageProject).
    const restored = await service.setProjectArchived({
      actorUserId: CO_OWNER,
      projectId: WS,
      archived: false,
      refusal: REFUSAL,
    });
    assert.equal(restored.contextType, "project");
    row = await workspaceRow(full.client);
    assert.equal(row?.archived_at, null);
    assert.equal(Number(row?.revision), 3);
  });

  it("refuses a plain member and a non-member", async () => {
    await seedFixture(full.client);
    for (const actor of [MEMBER, OUTSIDER]) {
      await assert.rejects(
        service.setProjectArchived({
          actorUserId: actor,
          projectId: WS,
          archived: true,
          refusal: REFUSAL,
        }),
        new RegExp(REFUSAL),
      );
    }
    assert.equal((await workspaceRow(full.client))?.archived_at, null);
  });

  it("throws the receipt when the row vanishes between proof and write", async () => {
    await seedFixture(full.client);
    planDb(full.db, await missingDb());
    await assert.rejects(
      service.setProjectArchived({
        actorUserId: PRIMARY,
        projectId: WS,
        archived: true,
        refusal: REFUSAL,
      }),
      /Workspace not found\./,
    );
  });
});

// ── moveProjectToPeriod ─────────────────────────────────────────────────────

describe("moveProjectToPeriod", () => {
  it("moves for the primary owner into an owned period", async () => {
    await seedPeriod(full.client, "pp-a", PRIMARY);
    await seedPeriod(full.client, "pp-b", PRIMARY);
    await seedFixture(full.client, { workspacePeriod: "pp-a" });
    const moved = await service.moveProjectToPeriod({
      actorUserId: PRIMARY,
      projectId: WS,
      targetPlanningPeriodId: "pp-b",
      position: 500,
      refusal: REFUSAL,
    });
    assert.equal(moved.targetContextType, "general");
    const row = await workspaceRow(full.client);
    assert.equal(row?.planning_period_id, "pp-b");
    assert.equal(Number(row?.position), 500);
  });

  it("REFUSES a co-owner who owns the target but not the current period — the WP6 tightening, pinned deliberately", async () => {
    // Path A allowed this: any owner-role member who owned the TARGET period
    // could move. The capability model admits a co-owner only when they own
    // the Project's CURRENT period (capabilities.ts:100), and the
    // consolidation keeps the stricter set. This test exists so that
    // behaviour change stays a decision, not an accident.
    await seedPeriod(full.client, "pp-co", CO_OWNER);
    await seedFixture(full.client, { workspacePeriod: null });
    await assert.rejects(
      service.moveProjectToPeriod({
        actorUserId: CO_OWNER,
        projectId: WS,
        targetPlanningPeriodId: "pp-co",
        refusal: REFUSAL,
      }),
      new RegExp(REFUSAL),
    );
    assert.equal((await workspaceRow(full.client))?.planning_period_id, null);
  });

  it("refuses a foreign target period, an archived one, and an incompatible context", async () => {
    await seedPeriod(full.client, "pp-foreign", OUTSIDER);
    await seedPeriod(full.client, "pp-archived", PRIMARY, { archived: true });
    await seedPeriod(full.client, "pp-school", PRIMARY, {
      contextType: "school_year",
    });
    await seedFixture(full.client);
    await assert.rejects(
      service.moveProjectToPeriod({
        actorUserId: PRIMARY,
        projectId: WS,
        targetPlanningPeriodId: "pp-foreign",
        refusal: REFUSAL,
      }),
      /Planning period not found\./,
    );
    await assert.rejects(
      service.moveProjectToPeriod({
        actorUserId: PRIMARY,
        projectId: WS,
        targetPlanningPeriodId: "pp-archived",
        refusal: REFUSAL,
      }),
      /Restore the target period first\./,
    );
    await assert.rejects(
      service.moveProjectToPeriod({
        actorUserId: PRIMARY,
        projectId: WS,
        targetPlanningPeriodId: "pp-school",
        refusal: REFUSAL,
      }),
      /This workspace type does not match the target period\./,
    );
  });

  it("throws the receipt when the row vanishes before the write", async () => {
    await seedPeriod(full.client, "pp-b", PRIMARY);
    await seedFixture(full.client);
    // Accesses: 1 capability proof, 2 target period read, then the context
    // read and the UPDATE land on the vanished copy.
    planDb(full.db, full.db, await missingDb());
    await assert.rejects(
      service.moveProjectToPeriod({
        actorUserId: PRIMARY,
        projectId: WS,
        targetPlanningPeriodId: "pp-b",
        refusal: REFUSAL,
      }),
      /Workspace not found\./,
    );
    assert.equal((await workspaceRow(full.client))?.planning_period_id, null);
  });
});

// ── duplicateProject ────────────────────────────────────────────────────────

describe("duplicateProject", () => {
  async function seedSourceTasks(client: ScratchDb["client"]) {
    await client.executeMultiple(`
      INSERT INTO tasks (id, workspace_id, seq, title, description, lane, priority, assignees, is_milestone, archived_at, created_at, updated_at)
      VALUES
        ('t-1', '${WS}', 1, 'Copy me', '', 'todo', 'normal', '[]', 0, 0, 0, 0),
        ('t-2', '${WS}', 2, 'Me too', '', 'doing', 'normal', '[]', 0, 0, 0, 0);
    `);
  }

  it("copies the workspace, chosen members and tasks; the copy is never published", async () => {
    await seedPeriod(full.client, "pp-target", PRIMARY);
    await seedFixture(full.client, { published: true });
    await seedSourceTasks(full.client);
    const copy = await service.duplicateProject({
      actorUserId: PRIMARY,
      sourceProjectId: WS,
      targetPlanningPeriodId: "pp-target",
      name: "Alpha again",
      choices: {
        copyReusableTasks: true,
        copyTimelineStructure: false,
        copyCollaborators: true,
        copyTemplate: false,
      },
      refusal: REFUSAL,
    });
    assert.match(copy.id, /^ws-/);
    assert.notEqual(copy.id, WS);
    const row = await full.client.execute({
      sql: `SELECT published_at, planning_period_id, owner_user_id FROM workspaces WHERE id = ?`,
      args: [copy.id],
    });
    assert.equal(row.rows[0]?.published_at, null, "a copy is never born published");
    assert.equal(row.rows[0]?.planning_period_id, "pp-target");
    assert.equal(row.rows[0]?.owner_user_id, PRIMARY);
    const copiedTasks = await full.client.execute({
      sql: `SELECT COUNT(*) AS n FROM tasks WHERE workspace_id = ?`,
      args: [copy.id],
    });
    assert.equal(Number(copiedTasks.rows[0]?.n), 2);
    const copiedMembers = await full.client.execute({
      sql: `SELECT user_id, role FROM workspace_members WHERE workspace_id = ? ORDER BY user_id`,
      args: [copy.id],
    });
    // The actor as owner, the source's plain member copied as member. The
    // other co-OWNER row is deliberately not copied (members only).
    assert.deepEqual(
      copiedMembers.rows.map((r) => [r.user_id, r.role]),
      [
        [MEMBER, "member"],
        [PRIMARY, "owner"],
      ],
    );
  });

  it("refuses a plain member on the source", async () => {
    await seedPeriod(full.client, "pp-target", MEMBER);
    await seedFixture(full.client);
    await assert.rejects(
      service.duplicateProject({
        actorUserId: MEMBER,
        sourceProjectId: WS,
        targetPlanningPeriodId: "pp-target",
        name: "Sneaky copy",
        choices: {
          copyReusableTasks: true,
          copyTimelineStructure: true,
          copyCollaborators: true,
          copyTemplate: true,
        },
        refusal: REFUSAL,
      }),
      new RegExp(REFUSAL),
    );
  });

  it("re-proves inside the transaction: a source vanishing mid-flight copies nothing", async () => {
    await seedPeriod(full.client, "pp-target", PRIMARY);
    await seedFixture(full.client);
    // Accesses: 1 outer proof (full), 2 target period read (full), 3 the
    // transaction — on the vanished copy, where the in-tx re-proof refuses.
    planDb(full.db, full.db, await missingDb());
    await assert.rejects(
      service.duplicateProject({
        actorUserId: PRIMARY,
        sourceProjectId: WS,
        targetPlanningPeriodId: "pp-target",
        name: "Ghost copy",
        choices: {
          copyReusableTasks: true,
          copyTimelineStructure: false,
          copyCollaborators: false,
          copyTemplate: false,
        },
        refusal: REFUSAL,
      }),
      new RegExp(REFUSAL),
    );
    assert.equal(
      await count(full.client, `SELECT COUNT(*) AS n FROM workspaces`),
      1,
      "no copy may exist in the real database",
    );
  });

  it("refuses an archived target period", async () => {
    await seedPeriod(full.client, "pp-cold", PRIMARY, { archived: true });
    await seedFixture(full.client);
    await assert.rejects(
      service.duplicateProject({
        actorUserId: PRIMARY,
        sourceProjectId: WS,
        targetPlanningPeriodId: "pp-cold",
        name: "Into the freezer",
        choices: {
          copyReusableTasks: false,
          copyTimelineStructure: false,
          copyCollaborators: false,
          copyTemplate: false,
        },
        refusal: REFUSAL,
      }),
      /Restore the target period first\./,
    );
  });
});

// ── deleteProject ───────────────────────────────────────────────────────────

describe("deleteProject", () => {
  async function seedDeletable(client: ScratchDb["client"]) {
    await seedFixture(client, { published: true });
    await client.executeMultiple(`
      INSERT INTO tasks (id, workspace_id, seq, title, description, lane, priority, assignees, is_milestone, archived_at, created_at, updated_at)
      VALUES ('t-del', '${WS}', 1, 'Doomed', '', 'todo', 'normal', '[]', 0, 0, 0, 0);
      INSERT INTO share_links (token, workspace_id, view) VALUES ('sl-1', '${WS}', 'board');
      INSERT INTO share_link_visits (id, token) VALUES ('v-1', 'sl-1');
    `);
  }

  it("cascades, revalidates /p/{slug}, and emits — for the primary owner", async () => {
    await seedDeletable(full.client);
    const removed = await service.deleteProject({
      actorUserId: PRIMARY,
      projectId: WS,
      refusal: REFUSAL,
    });
    assert.equal(removed.slug, SLUG);
    assert.equal(removed.wasPublished, true);
    assert.equal(await workspaceRow(full.client), null);
    assert.equal(await count(full.client, `SELECT COUNT(*) AS n FROM tasks`), 0);
    assert.equal(await count(full.client, `SELECT COUNT(*) AS n FROM share_links`), 0);
    assert.equal(await count(full.client, `SELECT COUNT(*) AS n FROM share_link_visits`), 0);
    assert.ok(
      revalidated.includes(`/p/${SLUG}`),
      "the ISR page must be dropped (E06.12)",
    );
    assert.ok(revalidated.includes("/app"));
    assert.equal(emitted.length, 1);
  });

  it("REFUSES a co-owner: permanent delete stays primary-owner only, now on every path", async () => {
    await seedDeletable(full.client);
    await assert.rejects(
      service.deleteProject({
        actorUserId: CO_OWNER,
        projectId: WS,
        refusal: REFUSAL,
      }),
      new RegExp(REFUSAL),
    );
    assert.ok(await workspaceRow(full.client), "the workspace must survive");
  });

  it("refuses a member, a non-member, and a missing candidate alike", async () => {
    await seedDeletable(full.client);
    for (const actor of [MEMBER, OUTSIDER]) {
      await assert.rejects(
        service.deleteProject({ actorUserId: actor, projectId: WS, refusal: REFUSAL }),
        new RegExp(REFUSAL),
      );
    }
    await assert.rejects(
      service.deleteProject({ actorUserId: PRIMARY, projectId: null, refusal: REFUSAL }),
      new RegExp(REFUSAL),
    );
    assert.ok(await workspaceRow(full.client));
  });

  it("throws the receipt when the row vanishes between proof and cascade", async () => {
    await seedDeletable(full.client);
    planDb(full.db, await missingDb());
    await assert.rejects(
      service.deleteProject({
        actorUserId: PRIMARY,
        projectId: WS,
        refusal: REFUSAL,
      }),
      /Workspace not found\./,
    );
    assert.ok(await workspaceRow(full.client), "the real row must be untouched");
  });
});

// ── The two real entry points (E06.12 from BOTH doors) ──────────────────────

describe("the delete entry points", () => {
  async function seedPublished(client: ScratchDb["client"]) {
    await seedFixture(client, { published: true });
    await client.executeMultiple(`
      INSERT INTO tasks (id, workspace_id, seq, title, description, lane, priority, assignees, is_milestone, archived_at, created_at, updated_at)
      VALUES ('t-pub', '${WS}', 1, 'Guests list', '', 'todo', 'normal', '[]', 0, 0, 0, 0);
    `);
  }

  it("planning.deleteProjectAction (sidebar) revalidates the published page and clears the cookie", async () => {
    await seedPublished(full.client);
    currentActor = PRIMARY;
    cookieJar.set("tasks_active_ws", WS);
    const result = await planning.deleteProjectAction(WS);
    assert.deepEqual(result, { ok: true });
    assert.ok(
      revalidated.includes(`/p/${SLUG}`),
      "the sidebar delete must drop the ISR page — the exact E06.12 gap WP6 closes",
    );
    assert.equal(await workspaceRow(full.client), null);
    assert.equal(cookieJar.has("tasks_active_ws"), false);
    assert.equal(emitted.length, 1);
  });

  it("settings.deleteWorkspaceAction revalidates the published page — explicit id", async () => {
    await seedPublished(full.client);
    currentActor = PRIMARY;
    cookieJar.set("tasks_active_ws", WS);
    const result = await settings.deleteWorkspaceAction(WS);
    assert.deepEqual(result, { ok: true });
    assert.ok(revalidated.includes(`/p/${SLUG}`));
    assert.equal(await workspaceRow(full.client), null);
    assert.equal(cookieJar.has("tasks_active_ws"), false);
  });

  it("settings.deleteWorkspaceAction resolves the fail-closed ambient value when no id is passed", async () => {
    await seedPublished(full.client);
    currentActor = PRIMARY;
    currentAmbient = WS;
    await settings.deleteWorkspaceAction();
    assert.ok(revalidated.includes(`/p/${SLUG}`));
    assert.equal(await workspaceRow(full.client), null);
  });

  it("the sidebar refuses a co-owner now, matching Settings", async () => {
    await seedPublished(full.client);
    currentActor = CO_OWNER;
    await assert.rejects(
      planning.deleteProjectAction(WS),
      /Workspace not found\./,
    );
    assert.ok(await workspaceRow(full.client), "the workspace must survive");
    assert.equal(revalidated.includes(`/p/${SLUG}`), false);
  });

  it("the settings rename entry point lands on the service (receipted rename)", async () => {
    await seedFixture(full.client);
    currentActor = PRIMARY;
    await settings.updateWorkspaceAction({ name: "Via settings", projectId: WS });
    const row = await workspaceRow(full.client);
    assert.equal(row?.name, "Via settings");
    assert.equal(Number(row?.revision), 2, "the service rename bumps the revision");
  });

  it("the sidebar archive entry point lands on the service", async () => {
    await seedFixture(full.client);
    currentActor = CO_OWNER;
    await planning.archiveProjectAction(WS);
    const row = await workspaceRow(full.client);
    assert.ok(row?.archived_at);
    assert.equal(Number(row?.revision), 2, "the sidebar archive now carries the revision bump");
  });
});
