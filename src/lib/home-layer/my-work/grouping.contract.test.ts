/**
 * MY_WORK_PROJECTION.md §7 — grouping. Assertions M1 to M6.
 *
 * Every test here fails at base `78021c5` because `./grouping.ts` does not
 * exist. That is the point of a contract wave: the specification is executable
 * before the implementation, and the red is the record.
 *
 * The two facts these tests exist to nail down, because both are silent when
 * they go wrong:
 *
 *   - Precedence. Waiting outranks an overdue date. A task held by somebody
 *     else's reply is not "late", and grouping it under Now turns a queue of
 *     things the reader cannot act on into a queue of things they think they
 *     failed at.
 *   - Calendar arithmetic. The seven-day window is seven LOCAL CALENDAR DAYS,
 *     not 604,800,000 milliseconds. Across a DST transition those differ by an
 *     hour, which moves rows between Next and Later on two days a year, in one
 *     direction, invisibly.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/my-work/grouping.contract.test.ts
 */

import { strict as assert } from "node:assert";
import test from "node:test";
import { requireContractModule, requireExports } from "./contract-support";

const MODULE = "src/lib/home-layer/my-work/grouping.ts";

/** The minimum a row must carry for grouping. Mirrors MyWorkRow, §6. */
type GroupInput = {
  dueDate: string | null;
  waiting: "blocked-by-dependency" | "in-waiting-column" | "no" | "unknown";
};

type GroupFn = (
  row: GroupInput,
  ctx: { today: string; timeZone: string },
) => { group: string; groupReason: string };

async function loadGrouping(): Promise<{
  groupMyWorkRow: GroupFn;
  MY_WORK_GROUP_ORDER: readonly string[];
}> {
  const mod = await requireContractModule(MODULE, "§7");
  requireExports(mod, ["groupMyWorkRow", "MY_WORK_GROUP_ORDER"], MODULE);
  return mod as unknown as {
    groupMyWorkRow: GroupFn;
    MY_WORK_GROUP_ORDER: readonly string[];
  };
}

const DUBLIN = "Europe/Dublin";

// ── M1 · the four groups exist, in the sealed order ─────────────────────────

test("M1 · the grouping module declares exactly four groups in precedence order", async () => {
  const { MY_WORK_GROUP_ORDER } = await loadGrouping();
  assert.deepEqual(
    [...MY_WORK_GROUP_ORDER],
    ["waiting", "now", "next", "later"],
    "§7.1 seals the precedence Waiting > Now > Next > Later / No date",
  );
});

// ── M2 · Waiting outranks a date, including an overdue one ──────────────────

test("M2 · a blocked task that is three weeks overdue groups as Waiting, not Now", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: "2026-07-22", waiting: "blocked-by-dependency" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "waiting");
  assert.equal(result.groupReason, "blocked-by-dependency");
});

test("M2 · a task in the Waiting column that is due today groups as Waiting", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: "2026-08-12", waiting: "in-waiting-column" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "waiting");
  assert.equal(result.groupReason, "in-waiting-column");
});

test("M2 · waiting:\"unknown\" is NOT waiting and is NOT silently treated as \"no\"", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  // §7.3: a Project that deleted its Waiting column has no waiting signal.
  // Its rows are grouped by date, and the shortfall is disclosed by coverage —
  // never by pretending the answer is "not waiting".
  const result = groupMyWorkRow(
    { dueDate: "2026-08-14", waiting: "unknown" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "next");
  assert.equal(
    result.groupReason,
    "within-seven-days",
    "an unknown waiting signal falls through to the date rules, and coverage reports it",
  );
});

// ── M3 · the window is exactly seven local calendar days ────────────────────

test("M3 · yesterday is Now with reason overdue", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: "2026-08-11", waiting: "no" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "now");
  assert.equal(result.groupReason, "overdue");
});

test("M3 · today is Now with reason due-today", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: "2026-08-12", waiting: "no" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "now");
  assert.equal(result.groupReason, "due-today");
});

test("M3 · T+1 and T+7 are both Next", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const ctx = { today: "2026-08-12", timeZone: DUBLIN };
  for (const dueDate of ["2026-08-13", "2026-08-19"]) {
    const result = groupMyWorkRow({ dueDate, waiting: "no" }, ctx);
    assert.equal(result.group, "next", `${dueDate} must be Next`);
    assert.equal(result.groupReason, "within-seven-days");
  }
});

test("M3 · T+8 is Later, so the window boundary is closed and exact", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: "2026-08-20", waiting: "no" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "later");
  assert.equal(result.groupReason, "beyond-window");
});

// ── M4 · one responsibility, exactly one group ──────────────────────────────

test("M4 · every input lands in exactly one of the four groups", async () => {
  const { groupMyWorkRow, MY_WORK_GROUP_ORDER } = await loadGrouping();
  const ctx = { today: "2026-08-12", timeZone: DUBLIN };
  const waitings: GroupInput["waiting"][] = [
    "blocked-by-dependency",
    "in-waiting-column",
    "no",
    "unknown",
  ];
  const dates = [
    null,
    "2026-07-01",
    "2026-08-11",
    "2026-08-12",
    "2026-08-13",
    "2026-08-19",
    "2026-08-20",
    "2027-01-01",
  ];
  for (const waiting of waitings) {
    for (const dueDate of dates) {
      const result = groupMyWorkRow({ dueDate, waiting }, ctx);
      assert.ok(
        MY_WORK_GROUP_ORDER.includes(result.group),
        `waiting=${waiting} dueDate=${dueDate} produced an unknown group ${result.group}`,
      );
      assert.ok(
        typeof result.groupReason === "string" && result.groupReason.length > 0,
        "§6 requires the single rule that placed the row to be reported",
      );
    }
  }
});

// ── M5 · DST. Calendar arithmetic, never millisecond arithmetic ─────────────

test("M5 · the seven-day window is still seven days across the autumn DST change", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  // Europe/Dublin leaves summer time on 2026-10-25. The week containing it is
  // 169 hours long. A window computed as `now + 7 * 24 * 60 * 60 * 1000` would
  // land an hour short and drop 2026-10-28 out of Next.
  const ctx = { today: "2026-10-21", timeZone: DUBLIN };
  assert.equal(
    groupMyWorkRow({ dueDate: "2026-10-28", waiting: "no" }, ctx).group,
    "next",
    "T+7 across a fall-back transition must stay in Next",
  );
  assert.equal(
    groupMyWorkRow({ dueDate: "2026-10-29", waiting: "no" }, ctx).group,
    "later",
  );
});

test("M5 · the seven-day window is still seven days across the spring DST change", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  // Dublin enters summer time on 2026-03-29; that week is 167 hours long, so
  // millisecond arithmetic would pull an extra day INTO Next.
  const ctx = { today: "2026-03-25", timeZone: DUBLIN };
  assert.equal(
    groupMyWorkRow({ dueDate: "2026-04-01", waiting: "no" }, ctx).group,
    "next",
  );
  assert.equal(
    groupMyWorkRow({ dueDate: "2026-04-02", waiting: "no" }, ctx).group,
    "later",
    "T+8 across a spring-forward transition must stay in Later",
  );
});

// ── M6 · undated work is Later, never Now ───────────────────────────────────

test("M6 · a task with no date groups as Later with reason no-date", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: null, waiting: "no" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(
    result.group,
    "later",
    "§7.4: work with no date is not urgent and is never rendered as overdue",
  );
  assert.equal(result.groupReason, "no-date");
});

test("M6 · an undated task that is blocked is still Waiting", async () => {
  const { groupMyWorkRow } = await loadGrouping();
  const result = groupMyWorkRow(
    { dueDate: null, waiting: "blocked-by-dependency" },
    { today: "2026-08-12", timeZone: DUBLIN },
  );
  assert.equal(result.group, "waiting");
});
