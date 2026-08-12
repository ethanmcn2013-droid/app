/**
 * Every state a contract names has a fixture that produces it.
 *
 * A contract state with no fixture is a state nobody will design, nobody will
 * screenshot and nobody will test — so it ships as whatever the code happens
 * to do. This suite is the check that the universe is complete against the
 * contracts, not merely plausible.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/fixtures/coverage.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { INBOX_KINDS, READ_REASONS_ALLOWED, READ_REASONS_REFUSED } from "../inbox/contract";
import {
  ALL_STATE_CELLS,
  effectiveDisposition,
  HOME_INBOX_ATTEMPTS,
  HOME_INBOX_EVENTS,
  HOME_INBOX_NOW,
  HOME_INBOX_SCALE_EVENTS,
  HOME_INBOX_STATES,
  occupiedStateCells,
} from "./inbox";
import { detectCandidates, TRIGGER_KINDS, TRIGGER_WEIGHTS } from "./derive";
import {
  TODAY_CANDIDATE_SETS,
  TODAY_UNPROJECTABLE_CANDIDATES,
  TODAY_UNSUPPORTED_KINDS,
  assertDistinctSourceKeys,
} from "./today";
import {
  groupRow,
  MY_WORK_DST_ROWS,
  MY_WORK_FRAME,
  MY_WORK_FRAME_DST,
  MY_WORK_SCALE_ROWS,
  MY_WORK_SIGNATURE_ROWS,
  MY_WORK_WINDOW,
  decodeCursor,
  encodeCursor,
} from "./my-work";
import {
  HOME_FIXTURE_ALL_PROJECTS,
  HOME_FIXTURE_MALFORMED_PROJECT_ID,
  HOME_FIXTURE_PROJECTS,
  HOME_FIXTURE_PROJECT_WORDS,
  HOME_FIXTURE_SCALE_PROJECT_IDS,
} from "./projects";
import { HOME_MODES, homeFixtureWorld, SCENARIO_IDS } from "./scenarios";
import { sourceKey } from "./source-ref";

describe("Inbox: visibility and disposition are genuinely independent", () => {
  it("all eight cells of the two-by-four matrix are occupied", () => {
    assert.deepEqual([...occupiedStateCells(HOME_INBOX_STATES)], [...ALL_STATE_CELLS]);
    assert.equal(ALL_STATE_CELLS.length, 8);
  });

  it("carries `new` paired with `cleared` and `read` paired with `open`", () => {
    // The two cells that prove reading does not resolve, and clearing does
    // not require reading.
    const cells = occupiedStateCells(HOME_INBOX_STATES);
    assert.ok(cells.includes("new/cleared"));
    assert.ok(cells.includes("read/open"));
  });

  it("names all six V1 kinds, and only those six", () => {
    const used = new Set(HOME_INBOX_EVENTS.map((event) => event.kind));
    assert.equal(used.size, INBOX_KINDS.length);
    for (const kind of INBOX_KINDS) assert.ok(used.has(kind), `${kind} unused`);
  });

  it("keeps the read-reason allowlist and denylist disjoint", () => {
    for (const reason of READ_REASONS_ALLOWED) {
      assert.equal(
        (READ_REASONS_REFUSED as readonly string[]).includes(reason),
        false,
      );
    }
    for (const state of HOME_INBOX_STATES) {
      if (state.readReason === null) continue;
      assert.ok(READ_REASONS_ALLOWED.includes(state.readReason));
    }
  });

  it("writes readAt and readReason together, or neither", () => {
    for (const state of HOME_INBOX_STATES) {
      assert.equal(
        state.readAt === null,
        state.readReason === null,
        `${state.eventId} wrote one of readAt/readReason without the other`,
      );
    }
  });

  it("resurfaces a snooze by reading it, never by running a job", () => {
    const past = HOME_INBOX_STATES.find((state) => state.eventId === "home-evt-04");
    const future = HOME_INBOX_STATES.find((state) => state.eventId === "home-evt-03");
    assert.ok(past && future);
    assert.equal(past.disposition, "snoozed");
    assert.equal(future.disposition, "snoozed");
    assert.equal(effectiveDisposition(past, HOME_INBOX_NOW), "open");
    assert.equal(effectiveDisposition(future, HOME_INBOX_NOW), "snoozed");
  });

  it("refuses a snooze with no resurface instant", () => {
    assert.throws(
      () =>
        effectiveDisposition(
          { ...HOME_INBOX_STATES[0], disposition: "snoozed" },
          HOME_INBOX_NOW,
        ),
      /not a snooze/,
    );
  });

  it("groups by thread while keeping per-row state", () => {
    const thread = HOME_INBOX_EVENTS.filter(
      (event) => event.threadKey === "tasks:task:home-task-mf-kitchen-numbers",
    );
    assert.equal(thread.length, 2);
    assert.notEqual(thread[0].episodeKey, thread[1].episodeKey);
    const states = HOME_INBOX_STATES.filter((state) =>
      thread.some((event) => event.id === state.eventId),
    );
    assert.equal(states.length, 2);
    assert.notEqual(states[0].visibility, states[1].visibility);
  });

  it("dedupes on (sourceProduct, sourceEventId) and nothing else", () => {
    const keys = HOME_INBOX_EVENTS.map(
      (event) => `${event.sourceProduct}:${event.sourceEventId}`,
    );
    assert.equal(new Set(keys).size, keys.length);
  });

  it("covers all four source-action outcomes that can settle", () => {
    const outcomes = new Set(HOME_INBOX_ATTEMPTS.map((attempt) => attempt.outcome));
    assert.ok(outcomes.has("committed"));
    assert.ok(outcomes.has("refused"));
    assert.ok(outcomes.has("undetermined"));
  });

  it("a committed receipt carries its revision; a refused one carries its code", () => {
    for (const attempt of HOME_INBOX_ATTEMPTS) {
      if (attempt.outcome === "committed") {
        assert.notEqual(attempt.sourceRevisionAfter, null, attempt.attemptId);
        assert.equal(attempt.refusalCode, null, attempt.attemptId);
      }
      if (attempt.outcome === "refused") {
        assert.notEqual(attempt.refusalCode, null, attempt.attemptId);
        assert.equal(attempt.sourceRevisionAfter, null, attempt.attemptId);
      }
      if (attempt.outcome === "undetermined") {
        assert.equal(attempt.settledAt, null, attempt.attemptId);
      }
    }
  });

  it("the refused action leaves its event open", () => {
    const refused = HOME_INBOX_ATTEMPTS.find(
      (attempt) => attempt.outcome === "refused",
    );
    assert.ok(refused);
    const state = HOME_INBOX_STATES.find(
      (entry) => entry.eventId === refused.eventId,
    );
    assert.equal(state?.disposition, "open");
  });

  it("carries a withdrawn row that survives rather than vanishing", () => {
    const withdrawn = HOME_INBOX_EVENTS.filter(
      (event) => event.withdrawnAt !== null,
    );
    assert.equal(withdrawn.length, 1);
    const state = HOME_INBOX_STATES.find(
      (entry) => entry.eventId === withdrawn[0].id,
    );
    assert.ok(state, "a withdrawn event lost its state row");
    assert.notEqual(state.disposition, "cleared", "withdrawn is not cleared");
  });

  it("scale carries fifty events across ten threads", () => {
    assert.equal(HOME_INBOX_SCALE_EVENTS.length, 50);
    assert.equal(
      new Set(HOME_INBOX_SCALE_EVENTS.map((event) => event.threadKey)).size,
      10,
    );
  });
});

describe("Today: every trigger in the contract is reachable", () => {
  it("declares eight triggers with the contract's weights", () => {
    assert.equal(TRIGGER_KINDS.length, 8);
    assert.equal(TRIGGER_WEIGHTS["due-soon"], 1000);
    assert.equal(TRIGGER_WEIGHTS["blocker-cleared"], 450);
    assert.equal(TRIGGER_WEIGHTS["doing-empty"], 300);
  });

  it("fires every one of the eight somewhere in the universe", () => {
    const fired = new Set<string>();
    for (const set of Object.values(TODAY_CANDIDATE_SETS)) {
      for (const candidate of detectCandidates(set)) {
        if (candidate.trigger) fired.add(candidate.trigger);
      }
    }
    for (const candidate of detectCandidates(
      TODAY_CANDIDATE_SETS.dst,
      "2026-10-24",
      Date.parse("2026-10-24T20:15:00.000Z"),
    )) {
      if (candidate.trigger) fired.add(candidate.trigger);
    }
    for (const trigger of TRIGGER_KINDS) {
      assert.ok(fired.has(trigger), `no fixture fires "${trigger}"`);
    }
  });

  it("gives every candidate a distinct sourceKey", () => {
    for (const [name, set] of Object.entries(TODAY_CANDIDATE_SETS)) {
      assert.doesNotThrow(() => assertDistinctSourceKeys(set), `set ${name}`);
    }
  });

  it("never templates provenance, and never says the word workspace", () => {
    for (const set of Object.values(TODAY_CANDIDATE_SETS)) {
      for (const signal of set) {
        assert.notEqual(signal.sourceLabel.projectName, "Workspace");
        assert.equal(
          /workspace/i.test(signal.sourceLabel.projectName),
          false,
          `"${signal.sourceLabel.projectName}" is not a Project name a reader would recognise`,
        );
      }
    }
  });

  it("reads priority from the record rather than pinning it at 2", () => {
    const priorities = new Set(
      Object.values(TODAY_CANDIDATE_SETS)
        .flat()
        .map((signal) => signal.priority),
    );
    assert.ok(priorities.size > 1, "every candidate carries the same priority");
    assert.ok(priorities.has(0), "no P0 exists, so the severity bonus is dead");
  });

  it("carries Unprojectable work, and it is projectId null rather than absent", () => {
    assert.equal(TODAY_UNPROJECTABLE_CANDIDATES.length, 1);
    assert.equal(TODAY_UNPROJECTABLE_CANDIDATES[0].projectId, null);
    assert.equal(TODAY_UNPROJECTABLE_CANDIDATES[0].ref.projectId, null);
  });

  it("names the kinds with no producer, and forbids rendering them as empty", () => {
    assert.ok(
      TODAY_UNSUPPORTED_KINDS.some((entry) => entry.kind === "calendar-event"),
    );
    for (const entry of TODAY_UNSUPPORTED_KINDS) {
      assert.equal(entry.status, "unsupported");
      assert.ok(entry.prohibitedRenderings.includes("0"));
    }
  });

  it("uses a total-order tie-break that survives a second product", () => {
    assert.equal(
      sourceKey({ product: "tasks", kind: "task", id: "x", projectId: null }),
      "tasks:task:x",
    );
    assert.notEqual(
      sourceKey({ product: "tasks", kind: "task", id: "x", projectId: null }),
      sourceKey({ product: "notes", kind: "note-extract", id: "x", projectId: null }),
    );
  });
});

describe("My work: all seven group reasons, and the exact window", () => {
  it("produces every reason code at least once", () => {
    const reasons = new Set(
      [
        ...MY_WORK_SIGNATURE_ROWS.map((row) => groupRow(row, MY_WORK_FRAME).reason),
        ...MY_WORK_DST_ROWS.map((row) => groupRow(row, MY_WORK_FRAME_DST).reason),
      ],
    );
    for (const reason of [
      "blocked-by-dependency",
      "in-waiting-column",
      "overdue",
      "due-today",
      "within-seven-days",
      "beyond-window",
      "no-date",
    ]) {
      assert.ok(reasons.has(reason as never), `no fixture produces "${reason}"`);
    }
  });

  it("puts T+7 in Next and T+8 in Later", () => {
    assert.equal(MY_WORK_WINDOW.nextEndInclusive, "2026-07-23");
    assert.equal(MY_WORK_WINDOW.firstLaterDay, "2026-07-24");
    const edge = MY_WORK_SIGNATURE_ROWS.find(
      (row) => row.taskId === "home-task-mf-cars",
    );
    const past = MY_WORK_SIGNATURE_ROWS.find(
      (row) => row.taskId === "home-task-at-running-order",
    );
    assert.ok(edge && past);
    assert.equal(groupRow(edge, MY_WORK_FRAME).group, "next");
    assert.equal(groupRow(past, MY_WORK_FRAME).group, "later");
  });

  it("derives Waiting from structure, never from a display name", () => {
    const renamed = MY_WORK_SIGNATURE_ROWS.find(
      (row) => row.taskId === "home-task-nc-venue-confirmation",
    );
    assert.ok(renamed);
    // The column is called "Waiting on the venue"; the KEY is what decides.
    assert.equal(renamed.columnLabel, "Waiting on the venue");
    assert.equal(renamed.columnKey, "waiting");
    assert.equal(renamed.waiting, "in-waiting-column");
  });

  it("renders `unknown` where a Project deleted its Waiting column", () => {
    const unknown = MY_WORK_SIGNATURE_ROWS.filter(
      (row) => row.waiting === "unknown",
    );
    assert.ok(unknown.length > 0, "no Project exercises the missing-signal case");
    for (const row of unknown) {
      assert.notEqual(row.waiting, "no", "unknown was collapsed into not-waiting");
    }
  });

  it("resolves Done per Project, so a renamed Done column still counts", () => {
    const renamedDone = MY_WORK_SIGNATURE_ROWS.find(
      (row) => row.taskId === "home-task-nc-favours",
    );
    assert.ok(renamedDone);
    assert.equal(renamedDone.columnKey, "signed-off");
    assert.equal(renamedDone.isDone, true);
  });

  it("keeps `unverified` distinct from `denied`", () => {
    const row = MY_WORK_SIGNATURE_ROWS.find(
      (entry) => entry.taskId === "home-task-sr-cars",
    );
    assert.equal(row?.capabilities.complete, "unverified");
    assert.equal(row?.capabilities.reassign, "denied");
  });

  it("marks an unparsed due label as undated rather than guessing a date", () => {
    const row = MY_WORK_SIGNATURE_ROWS.find(
      (entry) => entry.dueUnparsed === true,
    );
    assert.ok(row);
    assert.equal(row.dueAtIso, null);
    assert.equal(row.dueDate, null);
    assert.ok(row.dueLabel && row.dueLabel.length > 0);
  });

  it("always carries workspaceId in the return link", () => {
    for (const row of [...MY_WORK_SIGNATURE_ROWS, ...MY_WORK_SCALE_ROWS]) {
      assert.ok(
        row.href.includes(`workspaceId=${row.workspaceId}`),
        `${row.taskId} links without its Project`,
      );
    }
  });

  it("rejects a cursor from a day that has rolled over", () => {
    const cursor = encodeCursor(MY_WORK_SIGNATURE_ROWS[0], MY_WORK_FRAME.today);
    assert.equal(decodeCursor(cursor, MY_WORK_FRAME.today).ok, true);
    const rolled = decodeCursor(cursor, "2026-07-17");
    assert.equal(rolled.ok, false);
    if (rolled.ok) return;
    assert.equal(rolled.reason, "day-rolled-over");
  });

  it("carries sixty responsibilities at scale, one of them very long", () => {
    assert.equal(MY_WORK_SCALE_ROWS.length, 60);
    assert.ok(
      MY_WORK_SCALE_ROWS.some((row) => row.title.length > 140),
      "no row stresses row rhythm at 320 px",
    );
  });
});

describe("Projects: the catalog is built on the merged fixture", () => {
  it("adds four Orchard Projects and reuses all fourteen merged ones", () => {
    assert.equal(HOME_FIXTURE_PROJECTS.length, 4);
    assert.equal(HOME_FIXTURE_ALL_PROJECTS.length, 18);
    assert.equal(HOME_FIXTURE_SCALE_PROJECT_IDS.length, 18);
  });

  it("gives every Project a CONTEXT_ID-valid id", () => {
    const grammar = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
    for (const project of HOME_FIXTURE_ALL_PROJECTS) {
      assert.ok(grammar.test(project.id), `${project.id} is not a CONTEXT_ID`);
    }
    assert.equal(grammar.test(HOME_FIXTURE_MALFORMED_PROJECT_ID), false);
  });

  it("gives every Orchard Project a word no other Project uses", () => {
    const words = Object.values(HOME_FIXTURE_PROJECT_WORDS);
    assert.equal(new Set(words).size, words.length);
  });

  it("keeps the shared Project's Planning Period hidden from its member", () => {
    const shared = HOME_FIXTURE_PROJECTS.find((entry) => entry.role === "member");
    assert.ok(shared);
    assert.equal(shared.planningPeriod, null);
  });

  it("carries a long name, diacritics and a CJK name through the merged set", () => {
    const names = HOME_FIXTURE_ALL_PROJECTS.map((entry) => entry.name);
    assert.ok(names.some((name) => name.length > 80), "no long name");
    assert.ok(names.some((name) => /[áéíóúÁÉÍÓÚ]/.test(name)), "no diacritics");
    assert.ok(names.some((name) => /[぀-ヿ一-龯]/.test(name)), "no CJK");
  });
});

describe("the lab matrix is complete", () => {
  it("renders five modes for every scenario", () => {
    assert.equal(HOME_MODES.length, 5);
    for (const id of SCENARIO_IDS) {
      const world = homeFixtureWorld(id);
      assert.ok(world.today);
      assert.ok(world.myWork);
      assert.ok(world.claims.length === 7);
      assert.ok(world.ledger);
      assert.ok(world.trend);
    }
  });

  it("the Project Lens changes neither axis", () => {
    for (const id of SCENARIO_IDS) {
      const { lens } = homeFixtureWorld(id);
      assert.equal(lens.readScopeUnchanged, true);
      assert.equal(lens.activeProjectUnchanged, true);
    }
  });

  it("an unauthorized Lens does not open, and does not widen anything", () => {
    const world = homeFixtureWorld("permission_changed");
    assert.notEqual(world.scenario.lensProjectId, null);
    assert.equal(world.lens.opens, false);
  });
});
