/**
 * Contract test — content ownership across the Home surfaces.
 * FAILING BY DESIGN (Wave 1).
 *
 * Sealed contract: docs/projects/home-operating-layer/CONTENT_OWNERSHIP.md
 * Assertion ids O1–O11 match §9 of that document one for one; the invariants
 * they enforce are I1–I5 in §6.
 *
 * Why this file lives beside the ranking test rather than next to the surfaces
 * it governs: `src/lib/home-layer/**` is created by this programme and owned by
 * it outright. PROJECT_SCOPE.md D-H13 deliberately deferred its own tests
 * because every natural home for them sat inside a live lane's working set, and
 * a colliding `*-contract.test.*` file reads as a boundary breach rather than a
 * scheduling artefact. That reasoning does not apply here.
 *
 * The registry these tests bind to — `./surface-ownership` — does not exist
 * yet. It is imported through a variable specifier so `tsc --noEmit` stays
 * green for the other lanes sharing this branch; see the ranking test's header
 * for the full reasoning.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/today/content-ownership-contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // src/lib/home-layer/today
const REPO = resolve(HERE, "../../../.."); // worktree root

/** Variable, not a literal — see the header note. */
const REGISTRY_SPECIFIER = "./surface-ownership";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Registry = any;

async function loadRegistry(): Promise<Registry> {
  return (await import(REGISTRY_SPECIFIER)) as Registry;
}

const SOURCE_KINDS = [
  "task",
  "note-extract",
  "milestone",
  "decision",
  "follow-up",
  "calendar-event",
  "notification",
  "activity",
] as const;

const ROLES = ["rank", "reason", "count", "state", "inventory"] as const;

function read(rel: string): string {
  const abs = resolve(REPO, rel);
  assert.ok(existsSync(abs), `expected ${rel} to exist at this base`);
  return readFileSync(abs, "utf8");
}

/** Repo-relative paths of every non-test TypeScript source file under src/. */
function walkSource(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const abs = resolve(dir, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test\.tsx?$/.test(entry)) continue;
      out.push(abs.slice(REPO.length + 1).split("\\").join("/"));
    }
  };
  walk(resolve(REPO, "src"));
  return out;
}

/**
 * Files that import `moduleFragment` AND reference `identifier`.
 *
 * The identifier matters. A file importing only the `Nudge` / `NudgeKind`
 * *types* is not a caller of the second engine — the renderer legitimately
 * keeps a shape to format. What CO-2 retires is the rule function.
 */
function callersOf(moduleFragment: string, identifier: string): string[] {
  return walkSource().filter((rel) => {
    if (rel.includes(moduleFragment)) return false;
    const body = readFileSync(resolve(REPO, rel), "utf8");
    return body.includes(moduleFragment) && body.includes(`${identifier}(`);
  });
}

// ────────────────────────────────────────────────────────────────────
// O1 · The registry exists and is complete
// ────────────────────────────────────────────────────────────────────

test("O1 · a declared ownership registry covers every SourceKind × role", async () => {
  const registry = await loadRegistry();
  const { OWNERSHIP } = registry;

  for (const kind of SOURCE_KINDS) {
    assert.ok(OWNERSHIP[kind], `no ownership declared for kind ${kind}`);
    for (const role of ROLES) {
      assert.ok(
        role in OWNERSHIP[kind],
        `${kind} × ${role} is undeclared. Zero owners is a gap, and a gap is how four definitions of "overdue" happened.`,
      );
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// O2 · I1 — exactly one primary owner per (kind × role)
// ────────────────────────────────────────────────────────────────────

test("O2 · exactly one section is primary for each (kind × role) — I1", async () => {
  const registry = await loadRegistry();
  const { SECTIONS } = registry;

  for (const kind of SOURCE_KINDS) {
    for (const role of ROLES) {
      const primaries = SECTIONS.filter(
        (s: { primaryFor: Array<{ kind: string; role: string }> }) =>
          s.primaryFor.some((p) => p.kind === kind && p.role === role),
      );
      // calendar-event has no producer at this base, so it legally has none.
      const expected = kind === "calendar-event" ? 0 : 1;
      assert.equal(
        primaries.length,
        expected,
        `${kind} × ${role} has ${primaries.length} primary owners (${primaries
          .map((s: { id: string }) => s.id)
          .join(", ")}). Two owners is a defect; zero is a gap.`,
      );
    }
  }
});

// ────────────────────────────────────────────────────────────────────
// O3 · I2 — one ranker, one prose author, and they are the same module
// ────────────────────────────────────────────────────────────────────

test("O3 · exactly one module assigns attention rank and authors attention prose — I2", () => {
  // Carved out on purpose: analytics observations are a different object class
  // ranked under their own versioned rule set (SIGNAL_RULE_VERSION,
  // src/modules/signal/lib/analytics/rules.ts:18).
  const CARVE_OUT = new Set(["src/modules/signal/lib/analytics/rules.ts"]);
  const EXPECTED = ["src/modules/signal/lib/briefing/build.ts"];

  const rankers = walkSource()
    .filter((rel) => !CARVE_OUT.has(rel))
    .filter((rel) => {
      const body = readFileSync(resolve(REPO, rel), "utf8");
      return body.includes("severity") && body.includes(".sort(");
    })
    .sort();

  assert.deepEqual(
    rankers,
    EXPECTED,
    "at this base three modules order the same Tasks rows on three different scales: build.ts (weights 100-1000 plus severity), generate-nudges.ts:260 (severity only, not a total order) and nudges-rail.tsx:66 (a display-time re-sort of an already-sorted list, which ST8 prohibits outright).",
  );
});

// ────────────────────────────────────────────────────────────────────
// O4 · I3 — every secondary appearance is declared
// ────────────────────────────────────────────────────────────────────

test("O4 · every secondary appearance declares a reason, one source route, and its completeness claim — I3", async () => {
  const registry = await loadRegistry();
  const { SECONDARY_APPEARANCES } = registry;

  assert.ok(
    Array.isArray(SECONDARY_APPEARANCES) && SECONDARY_APPEARANCES.length > 0,
    "the allowlist is exhaustive by design (CONTENT_OWNERSHIP.md §7); an empty one means undeclared appearances cannot be detected",
  );

  for (const entry of SECONDARY_APPEARANCES) {
    assert.ok(entry.reason && entry.reason.length > 0, `${entry.id} has no stated reason`);
    assert.equal(
      typeof entry.sourceRoute,
      "string",
      `${entry.id} must name exactly one route that owns the full view`,
    );
    assert.equal(
      typeof entry.impliesCompleteness,
      "boolean",
      `${entry.id} must declare its completeness claim rather than leave it to copy tone`,
    );
  }

  for (const id of ["S2", "S3"]) {
    const declared: { id: string; impliesCompleteness: boolean } | undefined =
      SECONDARY_APPEARANCES.find((e: { id: string }) => e.id === id);
    assert.ok(declared, `${id} (Today's capped view of a My work inventory) must be declared`);
    assert.equal(
      declared.impliesCompleteness,
      false,
      `${id} is a capped ranked view. Implying completeness is what made "Coming up" and "This week" read as the same broken section.`,
    );
  }
});

// ────────────────────────────────────────────────────────────────────
// O5 / O6 · I4 — one definition per shared word
// ────────────────────────────────────────────────────────────────────

test("O5 · exactly one overdue predicate exists — I4", async () => {
  // Four definitions at this base (CONTENT_OWNERSHIP.md DUP-7):
  //   roll-forward.ts:147        ne(tasks.lane,"done"), calendar day, server-local
  //   cross-workspace.ts:105     ne(tasks.lane,"done"), no archived/parent filter
  //   project-overview.ts:293    isTaskDone + real config, but INSTANT-based
  //   triggers.ts:87-118         engine lane, calendar day in the reader's timezone
  for (const rel of [
    "src/server/actions/roll-forward.ts",
    "src/server/actions/cross-workspace.ts",
  ]) {
    assert.ok(
      !read(rel).includes('ne(tasks.lane, "done")'),
      `${rel} still tests the lane literal. PROJECT_SCOPE.md §5 rule 5 requires isTaskDone(task, config) with the real per-Project config on every cross-Project read; a member can redefine Done for the whole Project (board.ts:282-301).`,
    );
  }

  assert.ok(
    !read("src/server/planning/queries.ts").includes("'done'"),
    "src/server/planning/queries.ts:100-107 hardcodes the done lane in four SQL expressions and skips archived_at",
  );

  const registry = await loadRegistry();
  assert.equal(
    typeof registry.isOverdue,
    "function",
    "one exported predicate, calendar-day based in the reader's timezone, filtering archived_at and parent_task_id",
  );
});

test("O6 · one idle-days threshold across the estate — I4", () => {
  assert.ok(
    !read("src/lib/tasks/selectors.ts").includes("ATTENTION_IDLE_DAYS"),
    'selectors.ts:109 defines idle as >= 4 days while the engine defines it as >= 3 (triggers.ts:60). One word, two thresholds, two surfaces — a user asking "why is this flagged here and not there" has no answer.',
  );
  assert.ok(
    !existsSync(resolve(REPO, "src/lib/nudges/generate-nudges.ts")),
    "generate-nudges.ts:141/:151 adds a third and fourth threshold (>= 7 and >= 4). CO-2 retires the module; its blocker-cleared and doing-empty rules are promoted into the one engine.",
  );
});

// ────────────────────────────────────────────────────────────────────
// O7 · The second engine has no callers
// ────────────────────────────────────────────────────────────────────

test("O7 · generateNudges has zero callers", () => {
  const callers = callersOf("nudges/generate-nudges", "generateNudges");
  assert.deepEqual(
    callers,
    [],
    "rendered identically on two routes today — src/app/app/inbox/page.tsx:9 (server, real column config) and src/components/app/my-week/my-week-app.tsx:8 (client, useColumnConfig). Same function, two clocks, two configs (DUP-3).",
  );
});

// ────────────────────────────────────────────────────────────────────
// O8 · I5 — an inventory declares its own coverage
// ────────────────────────────────────────────────────────────────────

test("O8 · every inventory owner emits a coverage statement — I5", async () => {
  const registry = await loadRegistry();
  const { SECTIONS } = registry;

  const inventories = SECTIONS.filter(
    (s: { primaryFor: Array<{ role: string }> }) =>
      s.primaryFor.some((p) => p.role === "inventory"),
  );
  assert.ok(inventories.length > 0, "no section owns inventory");

  for (const section of inventories) {
    assert.equal(
      section.emitsCoverage,
      true,
      `${section.id} owns an inventory and must state its own coverage. bucketMyWeek (selectors.ts:121-181) returns bare arrays today, under a label promising everything, while covering only tasks assigned to me on the one board the cookie selected. A silently narrow list is worse than an empty one: the rational response to it is to stop looking elsewhere.`,
    );
  }
});

// ────────────────────────────────────────────────────────────────────
// O9 · sourceKey is the only de-duplication key
// ────────────────────────────────────────────────────────────────────

test("O9 · sourceKey is the only de-duplication key reaching a Home surface", async () => {
  const registry = await loadRegistry();
  assert.equal(typeof registry.sourceKey, "function", "CONTENT_OWNERSHIP.md §1.1");
  assert.equal(
    registry.sourceKey({ product: "tasks", kind: "task", id: "t1", projectId: "p1" }),
    "tasks:task:t1",
  );
  assert.notEqual(
    registry.sourceKey({ product: "tasks", kind: "task", id: "x", projectId: null }),
    registry.sourceKey({ product: "notes", kind: "note-extract", id: "x", projectId: null }),
    "ids are unique inside a product, not across the estate; a bare-id de-duplication merges two unrelated rows invisibly",
  );

  assert.ok(
    !read("src/app/app/home/home-data.ts").includes("surfacedIds"),
    "home-data.ts:135 de-duplicates on a bare task id, in the view model rather than in the engine, so a new caller can skip it",
  );
});

// ────────────────────────────────────────────────────────────────────
// O10 · Only the Inbox counts events
// ────────────────────────────────────────────────────────────────────

test("O10 · no Home surface other than the Inbox renders an event or task count", () => {
  const inbox = read("src/components/app/inbox/inbox-app.tsx");
  assert.ok(
    !inbox.includes("overdueCount={"),
    "the Inbox greeting renders an overdue count and dueToday.length (inbox-app.tsx:104-110). Counts are claims about how complete the evidence is, and only Analytics has a coverage model to qualify one (CO-3).",
  );
  assert.ok(
    !inbox.includes("dueToday={digest.dueToday.length}"),
    "same banner — Charter rule 6/10: the Inbox is response-to-change, not a second task summary",
  );
});

// ────────────────────────────────────────────────────────────────────
// O11 · No section filters on an unreachable state
// ────────────────────────────────────────────────────────────────────

test("O11 · every state a Home section filters on is reachable from the production mapper", () => {
  const mapper = read("src/modules/signal/server/briefing/signal-build-for-user.ts");
  const homeData = read("src/app/app/home/home-data.ts");

  if (homeData.includes('lane === "review"')) {
    assert.ok(
      mapper.includes('return "review"'),
      'home-data.ts:161 filters on engine lane "review", which the production mapper cannot emit: Tasks lane "review" becomes Status "in-flight" (data/source.ts:112-117) and the mapper turns that back into Lane "in-flight" (signal-build-for-user.ts:313-318). The demo fixture DOES emit it (mock-source.ts:75), so every demo capture shows the section populated and every real reader sees it empty.',
    );
  }
});
