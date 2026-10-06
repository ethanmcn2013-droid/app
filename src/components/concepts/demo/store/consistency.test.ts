/**
 * Invariants for the demo's shared store. Run from the repo root:
 *   node --import tsx --test src/components/concepts/demo/store/consistency.test.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PEOPLE as WORLD_PEOPLE, PROJECTS as WORLD_PROJECTS, VIEWER as WORLD_VIEWER } from "../world";

import {
  ALL_BLOCKS,
  BLOCKS,
  CALENDAR_OWNER,
  CAPACITY,
  FILES,
  FIXED_EVENTS,
  ORLA_BLOCKS,
  INITIAL_STATE,
  PEOPLE,
  PROJECTS,
  SUPPLIERS,
  TASKS,
  TEAM,
  VIEWER,
  WORLD_SUPPLIER_NAMES,
  activeProjects,
  awaitingApproval,
  blocksOn,
  capacityFor,
  capacityOf,
  fixedOn,
  unscheduled,
  canonProjects,
  countsFor,
  daysLate,
  doneThisWeek,
  fileById,
  findTask,
  fmtDate,
  fmtDay,
  fmtRelative,
  forecast,
  lateTasks,
  milestonesFor,
  overCapacity,
  peopleLoad,
  personById,
  plannedMinutes,
  projectById,
  search,
  seriesOf,
  stuckTasks,
  supplierById,
  TODAY,
  WEEK_DAYS,
  addDays,
  boardOn,
  byStatus,
  cameIn,
  healthOn,
  historyFor,
  leadStuck,
  movedBetween,
  projectHistory,
  projectUpdates,
  stuckByUrgency,
  stuckSentence,
  statusOn,
  workspaceCounts,
} from "./index";

import { FILES as r2Files, activeProjects as r2Active, forecast as r2Forecast, paceStory, tasksFor as r2TasksFor } from "./index";
import {
  PROJECT_FILTERS,
  PROJECT_GROUP,
  lateAcrossVenue,
  needsALook,
  nextBigDay,
  projectFilterCounts,
  projectGlance,
  projectsFiltered,
  standingSummary,
  weekDone,
} from "./index";

const s = INITIAL_STATE;
const r2Projects = r2Active(INITIAL_STATE);
const ids = (list: { id: string }[]) => list.map((x) => x.id).sort();

describe("world", () => {
  test("today, viewer and calendar owner", () => {
    assert.equal(TODAY, "2026-09-25");
    assert.equal(VIEWER, WORLD_VIEWER);
    assert.ok(personById(VIEWER) && TEAM.includes(VIEWER));
    assert.ok(personById(CALENDAR_OWNER) && TEAM.includes(CALENDAR_OWNER));
  });

  test("the seven main projects match world.ts", () => {
    assert.deepEqual(
      canonProjects().map((p) => p.id),
      WORLD_PROJECTS.map((p) => p.id),
    );
    for (const w of WORLD_PROJECTS) {
      const p = projectById(w.id)!;
      assert.equal(p.name, w.name);
      assert.equal(p.short, w.short);
      assert.equal(p.hue, w.hue);
      assert.equal(p.date, w.date);
      assert.equal(p.health, w.health);
      assert.equal(p.lead, w.lead);
    }
  });

  test("people and suppliers match world.ts", () => {
    for (const w of WORLD_PEOPLE) {
      const p = personById(w.id)!;
      assert.ok(p, w.id);
      assert.equal(p.name, w.name);
      assert.equal(p.hue, w.hue);
    }
    for (const name of WORLD_SUPPLIER_NAMES) assert.ok(SUPPLIERS.some((x) => x.name === name), name);
  });

  test("no warning colours or pink in sample data", () => {
    for (const x of [...PROJECTS, ...PEOPLE]) assert.ok(![5, 6, 7, 8].includes(x.hue), `${x.id} uses hue ${x.hue}`);
  });

  test("ids are unique", () => {
    const lists: readonly (readonly { id: string }[])[] = [PROJECTS, PEOPLE, SUPPLIERS, TASKS, ALL_BLOCKS, FILES, FIXED_EVENTS];
    for (const list of lists) {
      assert.equal(new Set(list.map((x) => x.id)).size, list.length);
    }
  });
});

describe("tasks", () => {
  test("every task belongs to a real, active project and workstream", () => {
    for (const t of TASKS) {
      const p = projectById(t.project);
      assert.ok(p, `${t.id}: project ${t.project}`);
      assert.ok(!p.wrapped, `${t.id}: wrapped project`);
      assert.ok(t.id.startsWith(`${p.prefix}-`), `${t.id}: prefix`);
      assert.ok(p.workstreams.some((w) => w.id === t.workstream), `${t.id}: workstream ${t.workstream}`);
    }
  });

  test("owners are on the team; owners and helpers are on the project", () => {
    for (const t of TASKS) {
      const p = projectById(t.project)!;
      assert.ok(TEAM.includes(t.owner), `${t.id}: owner ${t.owner}`);
      for (const who of [t.owner, ...(t.helpers ?? [])]) {
        assert.ok(personById(who), `${t.id}: ${who}`);
        assert.ok(p.people.includes(who), `${t.id}: ${who} is not on ${p.id}`);
      }
    }
  });

  test("status and its fields agree", () => {
    for (const t of TASKS) {
      assert.equal(t.status === "done", !!t.doneOn, `${t.id}: doneOn`);
      assert.equal(t.status === "waiting", !!t.waitingOn, `${t.id}: waitingOn`);
      if (t.waitingOn) assert.ok(personById(t.waitingOn.who) || supplierById(t.waitingOn.who), `${t.id}: waits on ${t.waitingOn.who}`);
      if (t.supplier) assert.ok(supplierById(t.supplier), `${t.id}: supplier`);
      if (t.doneOn) assert.ok(t.doneOn <= TODAY, `${t.id}: done in the future`);
      assert.ok(t.created <= TODAY, `${t.id}: created in the future`);
      assert.ok(t.since <= TODAY && t.since >= t.created, `${t.id}: since ${t.since}`);
    }
  });

  test("nothing is due after its project's date unless it follows the day on purpose", () => {
    for (const t of TASKS) {
      if (!t.due) continue;
      const p = projectById(t.project)!;
      const last = p.end ?? p.date;
      if (t.afterEvent) assert.ok(t.due > p.date, `${t.id}: afterEvent but due before the day`);
      else assert.ok(t.due <= last, `${t.id}: due ${t.due} after ${p.id} on ${last}`);
    }
  });

  test("titles are unique within a project", () => {
    for (const p of activeProjects()) {
      const titles = TASKS.filter((t) => t.project === p.id).map((t) => t.title.toLowerCase());
      assert.equal(new Set(titles).size, titles.length, p.id);
    }
  });
});

describe("counts", () => {
  test("project counts add up to the workspace", () => {
    const ws = workspaceCounts(s);
    let total = 0;
    let late = 0;
    let done = 0;
    let stuck = 0;
    for (const p of activeProjects()) {
      const c = countsFor(s, p.id);
      assert.equal(c.total, TASKS.filter((t) => t.project === p.id).length);
      assert.equal(c.done + c.open, c.total);
      total += c.total;
      late += c.late;
      done += c.done;
      stuck += c.stuck;
    }
    assert.deepEqual([ws.total, ws.late, ws.done, ws.stuck], [total, late, done, stuck]);
    assert.equal(ws.late, lateTasks(s).length);
    assert.equal(ws.stuck, stuckTasks(s).length);
    assert.equal(ws.activeProjects, 15);
    assert.equal(ws.canonProjects, 7);
    assert.equal(ws.wrappedProjects, 4);
  });

  test("people's open work adds up to the workspace's", () => {
    const load = peopleLoad(s);
    assert.equal(
      load.reduce((n, p) => n + p.open, 0),
      workspaceCounts(s).open,
    );
    assert.equal(
      load.reduce((n, p) => n + p.late, 0),
      workspaceCounts(s).late,
    );
  });

  test("Mara & Finn: at risk, two late, about 44 tasks, a day to spare", () => {
    const c = countsFor(s, "mara-finn");
    assert.equal(projectById("mara-finn")!.health, "at_risk");
    assert.deepEqual(ids(lateTasks(s, { project: "mara-finn" })), ["mf-12", "mf-3"]);
    assert.equal(daysLate(findTask(s, "mf-3")!), 2);
    assert.equal(daysLate(findTask(s, "mf-12")!), 3);
    assert.ok(c.total >= 35 && c.total <= 46, `total ${c.total}`);
    const f = forecast(s, "mara-finn");
    assert.equal(f.spare, 1);
    assert.equal(f.verdict, "tight");
  });

  test("health and late work agree", () => {
    for (const id of ["barn-roof", "winter-launch"] as const) {
      assert.equal(projectById(id)!.health, "off_track");
      assert.ok(countsFor(s, id).late >= 3, id);
      assert.equal(forecast(s, id).verdict, "behind", id);
    }
    for (const p of canonProjects().filter((x) => x.health === "on_track")) {
      assert.equal(countsFor(s, p.id).late, 0, p.id);
      assert.ok(["ahead", "too_early"].includes(forecast(s, p.id).verdict), p.id);
    }
    assert.ok(projectById("ada-theo")!.tooEarly);
    for (const p of activeProjects().filter((x) => x.health !== "on_track")) assert.ok(p.healthReason, `${p.id} needs a reason`);
  });

  test("this week's finished work sits between Monday and today", () => {
    for (const t of doneThisWeek(s)) assert.ok(t.doneOn! >= "2026-09-21" && t.doneOn! <= TODAY);
  });
});

describe("resolved contradictions", () => {
  const one = (title: string) => {
    const hits = TASKS.filter((t) => t.title.toLowerCase().includes(title.toLowerCase()));
    assert.equal(hits.length, 1, `${title}: ${hits.map((t) => t.id).join(", ")}`);
    return hits[0];
  };

  test("seating plan: v4 drafted, with Mara; v3 approved on 21 Sep", () => {
    const draft = findTask(s, "Draft the seating plan")!;
    assert.equal(draft.status, "done");
    assert.equal(draft.doneOn, "2026-09-24");
    const approve = one("Approve the seating plan");
    assert.equal(approve.status, "waiting");
    assert.equal(approve.waitingOn?.who, "mara");
    assert.equal(approve.due, "2026-09-26");
    const seating = seriesOf("seating");
    assert.equal(seating.latest?.version, 4);
    assert.equal(seating.latest?.state, "awaiting");
    assert.equal(seating.latest?.awaiting, "mara");
    assert.equal(seating.latestApproved?.version, 3);
    assert.equal(seating.latestApproved?.approvedOn, "2026-09-21");
    assert.ok(milestonesFor("mara-finn").some((m) => m.title === "Seating plan approved" && m.date === "2026-09-26" && !m.done));
  });

  test("florist deposit: one task, waiting on Fern and Furrow for 7 days", () => {
    const t = one("florist deposit");
    assert.equal(t.status, "waiting");
    assert.equal(t.waitingOn?.who, "bloom");
    assert.equal(fmtRelative(t.waitingOn!.since), "7 days ago");
    assert.ok(stuckTasks(s).includes(t));
  });

  test("prosecco: Dev, Tue 29 Sep", () => {
    const t = one("prosecco");
    assert.equal(t.owner, "dev");
    assert.equal(t.due, "2026-09-29");
  });

  test("marquee sides: due Mon 28 Sep, urgent, worked on Fri 13:00", () => {
    const t = one("marquee sides");
    assert.equal(t.due, "2026-09-28");
    assert.equal(t.priority, "urgent");
    assert.ok(blocksOn(s, "2026-09-25").some((b) => b.taskId === t.id && b.start === "13:00"));
  });

  test("welcome sign, final numbers and the shuttle", () => {
    const sign = one("welcome sign");
    assert.deepEqual([sign.owner, sign.due, sign.status], ["dara", "2026-09-22", "todo"]);
    const numbers = TASKS.filter((t) => t.project === "mara-finn" && /final numbers|headcount/i.test(t.title));
    assert.equal(numbers.length, 1);
    assert.deepEqual([numbers[0].due, numbers[0].guests], ["2026-09-30", 118]);
    for (const t of TASKS.filter((x) => x.supplier === "harbour")) assert.equal(t.status, "done", t.title);
  });
});

describe("calendar", () => {
  test("blocks reference real tasks, in the week, on the owner's calendar", () => {
    for (const b of BLOCKS) {
      assert.ok(findTask(s, b.taskId), b.id);
      assert.ok(WEEK_DAYS.includes(b.day), b.id);
      assert.equal(b.person, CALENDAR_OWNER);
      const t = findTask(s, b.taskId)!;
      assert.ok(t.owner === CALENDAR_OWNER || (t.helpers ?? []).includes(CALENDAR_OWNER), `${b.id}: not Aoife's task`);
      if (t.status === "done") assert.equal(t.doneOn, b.day, `${b.id}: done on another day`);
    }
  });

  test("today runs one hour over; every other day fits", () => {
    for (const day of WEEK_DAYS) {
      const over = overCapacity(s, day);
      assert.equal(over, day === TODAY ? 60 : 0, day);
    }
    assert.equal(plannedMinutes(s, TODAY), 480);
    assert.equal(CAPACITY.find((c) => c.day === TODAY)?.minutes, 420);
  });

  test("the viewer has a week of her own, from her own tasks", () => {
    assert.notEqual(VIEWER, CALENDAR_OWNER);
    assert.deepEqual([...ALL_BLOCKS], [...BLOCKS, ...ORLA_BLOCKS]);
    assert.equal(s.blocks.length, ALL_BLOCKS.length);
    assert.equal(new Set(ALL_BLOCKS.map((b) => b.id)).size, ALL_BLOCKS.length);
    for (const b of ORLA_BLOCKS) {
      const t = findTask(s, b.taskId);
      assert.ok(t, b.id);
      assert.ok(WEEK_DAYS.includes(b.day), b.id);
      assert.equal(b.person, VIEWER);
      assert.ok(t.owner === VIEWER || (t.helpers ?? []).includes(VIEWER), `${b.id}: not Orla's task`);
      if (t.status === "done") assert.equal(t.doneOn, b.day, `${b.id}: done on another day`);
      else assert.ok(b.day >= TODAY, `${b.id}: open work planned in the past`);
    }
    // One block a task on each person's week.
    for (const person of [VIEWER, CALENDAR_OWNER]) {
      const mine = s.blocks.filter((b) => b.person === person).map((b) => b.taskId);
      assert.equal(new Set(mine).size, mine.length, person);
    }
  });

  test("the viewer's Friday runs one hour over too; her other days fit", () => {
    for (const day of WEEK_DAYS) assert.equal(overCapacity(s, day, VIEWER), day === TODAY ? 60 : 0, day);
    assert.equal(plannedMinutes(s, TODAY, VIEWER), 390);
    assert.equal(capacityFor(TODAY, VIEWER)?.minutes, 330);
    assert.equal(capacityFor(TODAY)?.minutes, 420);
    // The hour that moves has somewhere to go: Saturday morning is open and empty.
    const sat = addDays(TODAY, 1);
    assert.ok((capacityFor(sat, VIEWER)?.minutes ?? 0) >= 60);
    assert.equal(plannedMinutes(s, sat, VIEWER), 0);
  });

  test("every person has a week of hours, and no day's blocks or events overlap", () => {
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    for (const person of TEAM) {
      const week = capacityOf(person);
      assert.deepEqual(week.map((c) => c.day), [...WEEK_DAYS], person);
      for (const c of week) {
        assert.equal(c.window === null, c.minutes === 0, `${person} ${c.day}`);
        const spans = [
          ...blocksOn(s, c.day, person).map((b) => [toMin(b.start), toMin(b.start) + b.minutes, b.id] as const),
          ...fixedOn(c.day, person).map((e) => [toMin(e.start), toMin(e.start) + e.minutes, e.id] as const),
        ].sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] >= spans[i - 1][1], `${person}: ${spans[i - 1][2]} overlaps ${spans[i][2]}`);
        // Blocks sit inside the working window.
        for (const b of blocksOn(s, c.day, person)) {
          assert.ok(c.window, `${b.id}: planned on a day off`);
          assert.ok(toMin(b.start) >= toMin(c.window.start) && toMin(b.start) + b.minutes <= toMin(c.window.end), `${b.id}: outside working hours`);
        }
      }
    }
    for (const e of FIXED_EVENTS) assert.ok(e.person === "team" || TEAM.includes(e.person), e.id);
  });

  test("the tray is the person's open work with no time yet", () => {
    const tray = unscheduled(s, VIEWER);
    assert.ok(tray.length > 0);
    for (const t of tray) {
      assert.notEqual(t.status, "done");
      assert.ok(t.owner === VIEWER || (t.helpers ?? []).includes(VIEWER), t.id);
      assert.ok(!s.blocks.some((b) => b.person === VIEWER && b.taskId === t.id), t.id);
    }
    // A late task waits there, so the Late tab is not empty on the viewer's week.
    assert.ok(tray.some((t) => t.due && t.due < TODAY), "nothing late in the viewer's tray");
  });

  test("blocks on a day do not overlap each other or fixed events", () => {
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    for (const day of WEEK_DAYS) {
      const spans = [
        ...blocksOn(s, day).map((b) => [toMin(b.start), toMin(b.start) + b.minutes, b.id] as const),
        ...FIXED_EVENTS.filter((e) => e.day === day && (e.person === CALENDAR_OWNER || e.person === "team")).map(
          (e) => [toMin(e.start), toMin(e.start) + e.minutes, e.id] as const,
        ),
      ].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) assert.ok(spans[i][0] >= spans[i - 1][1], `${spans[i - 1][2]} overlaps ${spans[i][2]}`);
    }
  });
});

describe("files", () => {
  test("approvals agree with tasks", () => {
    for (const f of FILES) {
      assert.ok(projectById(f.project), f.id);
      if (f.taskId) {
        const t = findTask(s, f.taskId);
        assert.ok(t, `${f.id}: task ${f.taskId}`);
        assert.equal(t.project, f.project, f.id);
        if (f.state === "awaiting") assert.notEqual(t.status, "done", `${f.id}: awaiting but its task is done`);
      }
      if (f.state === "awaiting") assert.ok(f.awaiting && personById(f.awaiting), f.id);
      if (f.state === "approved") assert.ok(f.approvedBy && f.approvedOn && f.approvedOn <= TODAY, f.id);
    }
    assert.deepEqual(ids(awaitingApproval("orla")), ["f-brochure-2", "f-heating"]);
    assert.ok(fileById("f-prosecco")?.approvedBy === "mara");
  });
});

describe("helpers", () => {
  test("house date style", () => {
    assert.equal(fmtDay("2026-09-25"), "Fri 25 Sep");
    assert.equal(fmtDate("2026-10-03"), "3 Oct");
    assert.equal(fmtDate("2027-03-14"), "14 Mar 2027");
    assert.equal(fmtRelative("2026-10-03"), "in 8 days");
    assert.equal(fmtRelative("2026-10-12"), "in 17 days");
    assert.equal(fmtRelative("2026-09-26"), "tomorrow");
  });

  test("search finds each kind", () => {
    assert.equal(search(s, "mara & finn")[0]?.id, "mara-finn");
    assert.ok(search(s, "seating").some((h) => h.id === "f-seat-4"));
    assert.ok(search(s, "furrow").some((h) => h.kind === "supplier"));
    assert.ok(search(s, "aoife").some((h) => h.kind === "person"));
    assert.deepEqual(search(s, "   "), []);
  });
});

describe("client store", () => {
  test("mutations, undo and reset", async () => {
    const store = await import("./client");
    store.resetDemo();
    const before = workspaceCounts(store.getDemoState());

    store.updateTask("mf-12", { status: "done" });
    const sign = findTask(store.getDemoState(), "mf-12")!;
    assert.equal(sign.doneOn, TODAY);
    assert.equal(sign.since, TODAY);
    assert.equal(countsFor(store.getDemoState(), "mara-finn").late, 1);

    store.updateTask("mf-33", { status: "doing" });
    assert.equal(findTask(store.getDemoState(), "mf-33")!.waitingOn, undefined);

    const id = store.addTask({ title: "Collect the rings from Tolland & Sons", project: "mara-finn", due: "2026-09-29" });
    assert.equal(id, "mf-45");
    assert.equal(findTask(store.getDemoState(), id)!.owner, VIEWER);

    const [blockId] = store.scheduleBlock({ taskId: id, day: "2026-09-26", start: "10:00", minutes: 30 });
    assert.equal(plannedMinutes(store.getDemoState(), "2026-09-26"), 30);
    store.removeTask(id);
    assert.ok(!store.getDemoState().blocks.some((b) => b.id === blockId));

    assert.ok(store.undo());
    assert.ok(findTask(store.getDemoState(), id));
    while (store.undo());
    assert.deepEqual(workspaceCounts(store.getDemoState()), before);

    store.updateTask("mf-3", { owner: "niamh" });
    store.resetDemo();
    assert.equal(store.getDemoState(), INITIAL_STATE);
    assert.equal(store.undo(), false);
  });

  test("edits write history with today and the viewer", async () => {
    const store = await import("./client");
    store.resetDemo();
    store.updateTask("mf-33", { status: "doing" });
    store.updateTask("mf-3", { owner: "niamh", due: "2026-09-28", priority: "urgent" });
    const st = store.getDemoState();
    const florist = historyFor(st, "mf-33");
    const last = florist[florist.length - 1];
    assert.deepEqual([last.kind, last.from, last.to, last.on, last.by], ["status", "waiting", "doing", TODAY, VIEWER]);
    assert.deepEqual(
      historyFor(st, "mf-3").filter((e) => e.on === TODAY).map((e) => [e.kind, e.from, e.to]),
      [
        ["owner", "dev", "niamh"],
        ["due", "2026-09-23", "2026-09-28"],
        ["priority", "high", "urgent"],
      ],
    );
    assert.equal(statusOn(st, "mf-33", TODAY), "doing");
    assert.equal(statusOn(st, "mf-33", "2026-09-24"), "waiting");
    const id = store.addTask({ title: "Collect the rings from Tolland & Sons", project: "mara-finn" });
    assert.equal(historyFor(store.getDemoState(), id)[0].kind, "created");
    store.removeTask(id);
    assert.equal(historyFor(store.getDemoState(), id).at(-1)?.kind, "removed");
    store.nudgeTask("mf-21");
    assert.deepEqual(historyFor(store.getDemoState(), "mf-21").at(-1)?.to, "mara");
    while (store.undo());
    assert.equal(store.getDemoState().history, INITIAL_STATE.history);
    store.resetDemo();
  });
});

describe("task history", () => {
  test("every task's history replays to its current state", () => {
    for (const t of TASKS) {
      const events = historyFor(s, t.id);
      assert.ok(events.length >= 1, `${t.id}: no history`);
      assert.equal(events[0].kind, "created", `${t.id}: first event`);
      assert.equal(events[0].on, t.created, `${t.id}: created`);
      for (let i = 1; i < events.length; i++) assert.ok(events[i].on >= events[i - 1].on, `${t.id}: out of order`);
      for (const e of events) assert.ok(e.on <= TODAY && e.on >= t.created, `${t.id}: ${e.kind} on ${e.on}`);
      // Replays with the state, not the task's own fields.
      assert.equal(statusOn(s, t, TODAY), t.status, `${t.id}: status today`);
      assert.equal(statusOn(t, TODAY), t.status, `${t.id}: status today without a state`);
      assert.equal(statusOn(s, t, addDays(t.created, -1)), undefined, `${t.id}: exists before it was created`);
      const moves = events.filter((e) => e.kind === "created" || e.kind === "status");
      assert.equal(moves.at(-1)!.on, t.since, `${t.id}: since is not its last status event`);
      assert.equal(moves.at(-1)!.to, t.status, `${t.id}: last status event`);
      for (let i = 1; i < moves.length; i++) assert.equal(moves[i].from, moves[i - 1].to, `${t.id}: status chain breaks`);
      if (t.doneOn) assert.ok(events.some((e) => e.kind === "status" && e.to === "done" && e.on === t.doneOn), `${t.id}: done on doneOn`);
      if (t.waitingOn) assert.ok(events.some((e) => e.kind === "waiting" && e.to === t.waitingOn!.who && e.on === t.waitingOn!.since), `${t.id}: waiting`);
      for (const kind of ["due", "owner", "priority"] as const) {
        const last = events.filter((e) => e.kind === kind).at(-1);
        if (last) assert.equal(last.to, kind === "due" ? t.due : kind === "owner" ? t.owner : t.priority, `${t.id}: last ${kind}`);
      }
    }
  });

  test("the story's moves are in the log", () => {
    const marquee = historyFor("mf-13").filter((e) => e.kind === "due");
    assert.deepEqual(marquee.map((e) => [e.on, e.from, e.to]), [["2026-09-23", "2026-09-24", "2026-09-28"]]);
    const slates = historyFor("br-9").filter((e) => e.kind === "due");
    assert.deepEqual(slates.map((e) => [e.from, e.to]), [["2026-09-16", "2026-09-30"]]);
    assert.ok(historyFor("mf-33").some((e) => e.kind === "nudged" && e.to === "bloom"));
    for (const t of TASKS.filter((x) => x.status === "waiting")) assert.ok(historyFor(t.id).every((e) => e.kind !== "nudged" || e.on > t.waitingOn!.since));
  });

  test("the board today is the board, and replays look sane", () => {
    const now = boardOn(s, TODAY);
    const current = byStatus(s);
    for (const k of Object.keys(current) as (keyof typeof current)[]) assert.deepEqual(ids(now[k]), ids(current[k]), k);
    const monday = boardOn(s, "2026-09-21");
    assert.ok(monday.done.length < now.done.length);
    assert.ok(monday.done.every((t) => t.doneOn! <= "2026-09-21"));
    const week = movedBetween(s, "2026-09-21", TODAY);
    assert.ok(week.length > 0);
    assert.ok(week.every((m) => m.from !== m.to && m.on >= "2026-09-21" && m.on <= TODAY));
    assert.equal(week.filter((m) => m.to === "done").length, doneThisWeek(s).length);
    assert.ok(cameIn(s, "2026-09-21", TODAY).every((t) => t.created >= "2026-09-21"));
  });
});

describe("projects in the store", () => {
  test("every project's history starts with created and ends at its current health", () => {
    for (const p of PROJECTS) {
      const events = projectHistory(s, p.id);
      assert.equal(events[0]?.kind, "created", p.id);
      assert.equal(events[0].on, p.start, p.id);
      const health = events.filter((e) => e.kind === "health");
      if (health.length) {
        assert.equal(health.at(-1)!.to, p.health, `${p.id}: health`);
        assert.equal(health.at(-1)!.reason, p.healthReason, `${p.id}: reason`);
        for (let i = 1; i < health.length; i++) assert.equal(health[i].from, health[i - 1].to, `${p.id}: health chain`);
      } else assert.equal(p.health, "on_track", `${p.id}: off track with no history`);
      assert.equal(healthOn(s, p.id, TODAY), p.health, p.id);
      const leads = events.filter((e) => e.kind === "lead");
      if (leads.length) assert.equal(leads.at(-1)!.to, p.lead, `${p.id}: lead`);
      const dates = events.filter((e) => e.kind === "date");
      if (dates.length) assert.equal(dates.at(-1)!.to, p.date, `${p.id}: date`);
      if (p.wrapped) assert.ok(events.some((e) => e.kind === "wrapped" && e.on === p.wrapped!.on), `${p.id}: wrapped`);
    }
    const mf = projectHistory("mara-finn").find((e) => e.kind === "health");
    assert.deepEqual([mf?.on, mf?.from, mf?.to, mf?.reason], ["2026-09-18", "on_track", "at_risk", "Final numbers and the marquee sides are late"]);
    assert.equal(healthOn(s, "mara-finn", "2026-09-17"), "on_track");
    assert.equal(healthOn(s, "mara-finn", "2026-09-18"), "at_risk");
    assert.ok(projectUpdates(s, "mara-finn").length >= 2);
    const feed = projectUpdates("mara-finn");
    for (let i = 1; i < feed.length; i++) assert.ok(feed[i].on <= feed[i - 1].on, "updates newest first");
  });

  test("updateProject, milestones, updates, wrap and undo round-trip", async () => {
    const store = await import("./client");
    store.resetDemo();
    assert.equal(store.updateProject("harvest", { health: "at_risk" }), false, "at risk needs a reason");
    assert.equal(store.getDemoState(), INITIAL_STATE);
    assert.ok(store.updateProject("harvest", { health: "at_risk", healthReason: "Ticket sales are slow." }));
    let st = store.getDemoState();
    assert.equal(workspaceCounts(st).atRisk, workspaceCounts(s).atRisk + 1);
    assert.equal(projectHistory(st, "harvest").at(-1)?.to, "at_risk");
    assert.equal(projectUpdates(st, "harvest")[0].text, "Ticket sales are slow.");
    store.updateProject("harvest", { lead: "niamh", date: "2026-10-24" });
    store.setMilestone("harvest", projectById("harvest")!.milestones[2].id, true);
    const msId = store.addMilestone("harvest", { title: "Menus printed", date: "2026-10-14" });
    store.postUpdate("harvest", "Twelve seats sold in the first hour.");
    st = store.getDemoState();
    const h = st.projects.find((p) => p.id === "harvest")!;
    assert.deepEqual([h.lead, h.date, h.milestones[2].done], ["niamh", "2026-10-24", true]);
    assert.ok(milestonesFor("harvest", st).some((m) => m.id === msId));
    assert.equal(projectUpdates(st, "harvest")[0].text, "Twelve seats sold in the first hour.");
    store.updateProject("harvest", { health: "on_track" });
    assert.equal(store.getDemoState().projects.find((p) => p.id === "harvest")!.healthReason, undefined);

    store.wrapProject("kavanagh");
    st = store.getDemoState();
    assert.equal(workspaceCounts(st).activeProjects, 14);
    assert.equal(workspaceCounts(st).total, workspaceCounts(s).total - countsFor(s, "kavanagh").total);
    assert.deepEqual(countsFor(st, "kavanagh"), countsFor(s, "kavanagh"));
    store.unwrapProject("kavanagh");
    assert.equal(workspaceCounts(store.getDemoState()).activeProjects, 15);

    while (store.undo());
    assert.equal(store.getDemoState().projects, INITIAL_STATE.projects);
    assert.equal(store.getDemoState().projectEvents, INITIAL_STATE.projectEvents);
    assert.equal(store.getDemoState().updates, INITIAL_STATE.updates);
    store.resetDemo();
  });

  test("addProject seeds real starter tasks from each template", async () => {
    const store = await import("./client");
    const expect = { wedding: 12, party: 8, corporate: 8, works: 6, school: 6 } as const;
    for (const [template, n] of Object.entries(expect)) {
      store.resetDemo();
      const id = store.addProject({ name: `Test ${template}`, date: "2026-12-19", template, lead: "aoife" });
      const st = store.getDemoState();
      const p = st.projects.find((x) => x.id === id)!;
      assert.ok(p && !p.wrapped, template);
      const tasks = st.tasks.filter((t) => t.project === id);
      assert.equal(tasks.length, n, template);
      assert.equal(countsFor(st, id as typeof p.id).total, n);
      assert.equal(workspaceCounts(st).activeProjects, 16);
      for (const t of tasks) {
        assert.ok(t.id.startsWith(`${p.prefix}-`), t.id);
        assert.ok(TEAM.includes(t.owner) && p.people.includes(t.owner), `${t.id}: owner ${t.owner}`);
        assert.ok(p.workstreams.some((w) => w.id === t.workstream), `${t.id}: workstream`);
        assert.ok(t.due && t.due >= TODAY, `${t.id}: due ${t.due}`);
        assert.ok(t.afterEvent ? t.due! > p.date : t.due! <= p.date, `${t.id}: due vs date`);
        assert.ok(t.estimate && t.estimate > 0, `${t.id}: estimate`);
        assert.equal(statusOn(st, t, TODAY), "todo");
      }
      assert.equal(new Set(tasks.map((t) => t.title)).size, n, `${template}: titles unique`);
      assert.equal(projectHistory(st, id)[0]?.kind, "created");
      assert.ok(store.undo());
      assert.equal(store.getDemoState(), INITIAL_STATE);
    }
    // A project eight days out squeezes its lead time into the days left.
    store.resetDemo();
    const soon = store.addProject({ name: "Quick party", date: "2026-10-03", template: "tpl-party" });
    const quick = store.getDemoState().tasks.filter((t) => t.project === soon);
    assert.equal(quick.length, 8);
    assert.ok(quick.every((t) => t.due! >= TODAY && t.due! <= "2026-10-03"));
    store.resetDemo();
  });
});

describe("the lead stuck task", () => {
  test("across the workspace it is the florist deposit, not the oldest", () => {
    assert.equal(stuckTasks(s)[0].title, "Repoint the walled garden wall");
    assert.equal(leadStuck(s)?.title, "Chase florist deposit");
    assert.equal(stuckByUrgency(s).at(-1)?.title, "Repoint the walled garden wall");
    const line = stuckSentence(s)!;
    assert.equal(line.sentence, "Chase florist deposit has waited 7 days on Fern and Furrow.");
    assert.equal(line.actionLabel, "Nudge Fern and Furrow");
    assert.equal(line.waitingOn, "Fern and Furrow");
    assert.equal(line.days, 7);
    assert.equal(line.more, "3 more stuck");
    assert.equal(stuckSentence(s, { project: "harvest" }), undefined);
    for (const p of canonProjects()) {
      const lead = leadStuck(s, { project: p.id });
      if (lead) assert.equal(lead.project, p.id);
    }
  });
});

describe("small fields", () => {
  test("every open task has an estimate; rooms sit on event work", () => {
    for (const t of TASKS) if (t.status !== "done") assert.ok(t.estimate && t.estimate > 0, `${t.id}: estimate`);
    const rooms = TASKS.filter((t) => t.room);
    assert.ok(rooms.length >= 10);
    for (const t of rooms) assert.ok(["wedding", "event", "season", "marketing", "operations"].includes(projectById(t.project)!.kind), t.id);
    assert.equal(findTask(s, "mf-20")!.room, "Long barn");
  });
});

/* Round 2 (2 October 2026): the landing page's captures are read by sceptics. */
describe("round 2: one set of facts", () => {
  test("pace: one story", () => {
    const mf = paceStory(s, { project: "mara-finn" });
    const ws = paceStory(s);
    // "17 a week" is the last 7 days, the forecast's own window, wherever it is said.
    assert.equal(mf.last7, 17);
    assert.equal(mf.last7, r2Forecast(s, "mara-finn").doneRecently);
    assert.equal(Math.round(r2Forecast(s, "mara-finn").pacePerDay * 7), mf.last7);
    // The project home's "19 done and 18 added in 14 days, 17 of the done in the last 7".
    assert.equal(mf.last14, 19);
    assert.equal(mf.added14, 18);
    assert.ok(mf.last14 >= mf.last7);
    assert.equal(mf.last14 - mf.last7, 2);
    // Analytics: "Last week, 14 Sep: 9 tasks finished across all projects, most in Mara & Finn (4). This week so far: 35."
    assert.equal(ws.lastWeek, 9);
    assert.equal(mf.lastWeek, 4);
    assert.equal(ws.thisWeek, 35);
    assert.equal(ws.thisWeek, workspaceCounts(s).doneThisWeek);
    assert.equal(mf.thisWeek, 15);
    // The windows overlap the way the calendar says: this week (5 days) sits inside the last 7.
    assert.ok(mf.thisWeek <= mf.last7 && mf.last7 <= mf.thisWeek + mf.lastWeek);
    // No project finishes more in a week than the whole workspace did.
    for (const p of r2Projects) {
      const one = paceStory(s, { project: p.id });
      assert.ok(one.lastWeek <= ws.lastWeek && one.thisWeek <= ws.thisWeek && one.last7 <= ws.last7, p.id);
      assert.equal(one.last7, r2Forecast(s, p.id).doneRecently, p.id);
    }
    assert.equal(r2Projects.reduce((n, p) => n + paceStory(s, { project: p.id }).thisWeek, 0), ws.thisWeek);
  });

  test("guests are 118 everywhere", () => {
    const text = JSON.stringify([s.tasks, r2Projects, r2Files, s.updates, s.projectEvents]);
    assert.ok(!/\b120 guests\b/.test(text), "something still says 120 guests");
    assert.ok(/118 guests/.test(text));
    for (const t of r2TasksFor(s, "mara-finn")) if (t.guests != null && t.guests > 100) assert.equal(t.guests, 118, t.id);
  });

  test("the chased florist deposit carries no paid flag", () => {
    const t = findTask(s, "mf-33")!;
    assert.equal(t.status, "waiting");
    assert.equal(t.paid, undefined);
    assert.equal(t.cost, undefined);
  });

  test("words the landing page strikes out are not in the sample data", () => {
    const text = JSON.stringify([s.tasks, r2Projects, r2Files, s.updates, s.projectEvents, FIXED_EVENTS]).toLowerCase();
    for (const w of ["sprint", "epic", "backlog", "stakeholder", "kanban", "burndown", "velocity", "story points", "workflow", "dashboard", "swimlane", "deliverable", "resource allocation", "okr", "stand-up", "ticket", "roadmap", "scrum", "agile"])
      assert.ok(!new RegExp(`\b${w}s?\b`).test(text), w);
  });
});

describe("the projects console", () => {
  test("filter counts agree with the workspace", () => {
    const c = projectFilterCounts(s);
    const w = workspaceCounts(s);
    assert.equal(c.all, w.activeProjects);
    assert.equal(c.all, 15);
    assert.equal(c.attention, w.atRisk + w.offTrack);
    assert.equal(c.attention, 4);
    assert.equal(c.mine, 3);
    assert.equal(c.wrapped, w.wrappedProjects);
    // The kind groups never overlap, and with marketing they cover every active project.
    const marketing = r2Projects.filter((p) => PROJECT_GROUP[p.kind] === "marketing").length;
    assert.equal(c.events + c.works + marketing, c.all);
    for (const f of PROJECT_FILTERS) assert.equal(projectsFiltered(s, f).length, c[f], f);
  });

  test("needs a look is at risk, off track or past its date", () => {
    for (const p of r2Projects) assert.equal(needsALook(p), p.health !== "on_track" || (p.end ?? p.date) < TODAY, p.id);
    assert.deepEqual(ids(projectsFiltered(s, "attention")), ["barn-roof", "keane-legal", "mara-finn", "winter-launch"]);
  });

  test("standing: 2 off track, 2 at risk, the wedding first", () => {
    const st = standingSummary(s);
    assert.equal(st.offTrack.length + st.atRisk.length + st.onTrack.length + st.tooEarly.length, r2Projects.length);
    assert.equal(st.offTrack.length, 2);
    assert.equal(st.atRisk.length, 2);
    assert.deepEqual(ids(st.tooEarly), ["ada-theo"]);
    assert.equal(st.first?.id, "mara-finn");
  });

  test("the next big day is the wedding, 8 days out, 23 of 44 done", () => {
    const nb = nextBigDay(s)!;
    assert.equal(nb.project.id, "mara-finn");
    assert.equal(nb.days, 8);
    assert.equal(fmtDay(nb.project.date), "Sat 3 Oct");
    assert.deepEqual([nb.counts.done, nb.counts.total], [23, 44]);
  });

  test("late across the venue adds up to the workspace's late", () => {
    const l = lateAcrossVenue(s);
    assert.equal(l.total, workspaceCounts(s).late);
    assert.equal(l.total, 11);
    assert.equal(
      l.byProject.reduce((n, x) => n + x.late, 0),
      l.total,
    );
    assert.equal(l.byProject[0].project.id, "winter-launch");
    assert.equal(l.oldest?.title, "Agree the winter price list");
    assert.equal(daysLate(l.oldest!), 7);
  });

  test("this week tells the pace story", () => {
    const w = weekDone(s);
    assert.equal(w.days.length, 7);
    assert.equal(
      w.days.reduce((n, d) => n + d.done, 0),
      w.pace.thisWeek,
    );
    assert.equal(w.pace.thisWeek, 35);
    assert.equal(w.pace.lastWeek, 9);
    assert.equal(w.busiest?.project.id, "mara-finn");
    assert.equal(w.busiest?.done, 15);
  });

  test("a row's figures match the project's counts and forecast", () => {
    for (const p of r2Projects) {
      const g = projectGlance(s, p.id)!;
      assert.deepEqual(g.counts, countsFor(s, p.id), p.id);
      assert.equal(g.late.length, g.counts.late, p.id);
      assert.equal(g.waiting.length, g.counts.waiting, p.id);
      assert.equal(g.forecast.verdict, r2Forecast(s, p.id).verdict, p.id);
      if (g.nudge) assert.ok(g.nudge.task.status === "waiting" || g.nudge.task.owner !== VIEWER, p.id);
      assert.equal(g.nudgedToday, false, p.id);
    }
    const mf = projectGlance(s, "mara-finn")!;
    assert.equal(mf.forecast.finish, "2026-10-02");
    assert.equal(mf.forecast.spare, 1);
    assert.equal(mf.late[0].title, "Reprint the faded welcome sign");
    assert.equal(mf.nudge?.task.id, "mf-33");
    assert.equal(mf.nudge?.who, "Fern and Furrow");
    assert.equal(mf.waiting[0].id, "mf-33");
    // Nobody is asked to nudge themselves: the winter launch's oldest late task is Orla's own.
    const wl = projectGlance(s, "winter-launch")!;
    assert.notEqual(wl.nudge?.task.owner, VIEWER);
  });
});
