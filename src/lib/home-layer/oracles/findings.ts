/**
 * Golden oracles · the findings register.
 *
 * WHAT A FINDING IS. A place where the independent oracle and the fixture
 * universe disagree, or where the contract does not decide something the
 * rendered page depends on. Each one is PINNED by an assertion in
 * `oracles.test.ts`: the suite fails if the divergence changes in either
 * direction, so nobody can quietly widen it and nobody can quietly close it
 * without deleting the entry.
 *
 * THIS IS NOT A BACKLOG AND NOT A WAIVER. It is the honest middle state
 * between "the oracle passes" and "the oracle is red for a reason nobody
 * wrote down". Every entry names the contract clause it is measured against
 * and who owns the decision.
 */

export type OracleFinding = Readonly<{
  id: string;
  severity: "defect" | "contract-gap";
  /** The clause the oracle was written from. */
  clause: string;
  what: string;
  /** The measured evidence, verbatim. Numbers, not adjectives. */
  measured: string;
  owner: "lead" | "wave-2" | "wave-5" | "wave-8";
}>;

export const ORACLE_FINDINGS: readonly OracleFinding[] = Object.freeze([
  Object.freeze({
    id: "OR-2",
    severity: "contract-gap",
    clause: "TODAY_RANKING.md §6 (withholding) against §9.2 Q4",
    what:
      "When the accounting is withheld, the fixture drops Q4 from `quiet.blockedBy` because it tests `accounting && accounting.cappedOut > 0`. Quiet is still refused — Q2 fires instead — but §9.2's stated purpose is that `blockedBy` lets the surface say WHY, and cappedOut > 0 is a true, separately nameable reason that disappears from the list. Closing OR-3 WIDENED this: partial_coverage now withholds too, so a third world drops a reason it could have named.",
    measured:
      "permission_changed: oracle Q1,Q3,Q4,Q5,Q6,Q7,Q8 · fixture Q1,Q2,Q3,Q5,Q6,Q7,Q8 (cappedOut = 2). provider_failure: oracle Q1,Q3,Q4,Q7,Q8 · fixture Q1,Q2,Q3,Q7,Q8 (cappedOut = 1). partial_coverage, since OR-3 closed: oracle Q1,Q3,Q4,Q5,Q7,Q8 · fixture Q1,Q2,Q3,Q5,Q7,Q8 (cappedOut = 2). Quiet language is refused in both readings, in every world.",
    owner: "wave-5",
  }),
  Object.freeze({
    id: "OR-5",
    severity: "defect",
    clause: "INBOX_EVENT.md §8.4 and §8.5 (disposition transitions and their causes)",
    what:
      "Every `cleared` row in the fifty-event scale set carries `dispositionReason: \"arrival\"`. §8.5's table gives `open → cleared` exactly one cause — `user` — and §8.4 makes clearing personal: it is the recipient's word, never the system's. The generator inherits the `state()` default instead of naming the cause, so the scale world renders eight rows that say the system cleared them on arrival. The badge is unaffected (cleared is excluded either way), but the row provenance is false on a surface whose whole premise is that provenance is real. The thirteen hand-written owner rows are all correct; only the generated set is wrong.",
    measured:
      "scale: 8 of 50 rows — home-evt-scale-0001, -0008, -0015, -0022, -0029, -0036, -0043, -0050 — are `cleared` with `dispositionReason: \"arrival\"`. Every other world returns zero illegal disposition rows. Fix is one argument in `HOME_INBOX_SCALE_STATES`: `{ dispositionAt: row.recordedAt, dispositionReason: index % 7 === 0 ? \"user\" : \"arrival\" }`.",
    owner: "wave-2",
  }),
  Object.freeze({
    id: "OR-7",
    severity: "defect",
    clause:
      "CHARTER rule 6 (one definition everywhere), MY_WORK_PROJECTION.md §6, TODAY_RANKING.md §3",
    what:
      "Found while closing OR-6, and NOT fixed by it. Four source records are read differently by Today and by My work: three carry a due date in one surface and not the other, and one is open in Today and done in My work. Now that Analytics reads the same records, the disagreement is visible in three places instead of two. Analytics resolves it by a stated rule — My work wins on `isDone` and on the due instant, because it resolves both through the Project's own column configuration — but a stated tie-break is not agreement, and the records themselves still contradict each other. Fixing it means editing either Today's ranking inputs or My work's grouping inputs, both of which are authored to exercise specific boundaries, so the lead picks which surface is wrong.",
    measured:
      "home-task-nc-marquee-lighting: due null in Today, 2026-07-19 in My work. home-task-at-ceremony-time: due null in Today, 2026-07-21 in My work. home-task-at-running-order: 2026-07-25 in Today, 2026-07-24 in My work. home-task-nc-favours: lane `next` in Today, `signed-off` (done) in My work. 16 of 37 Today candidate ids are also My work ids; 4 of those 16 disagree.",
    owner: "lead",
  }),
  Object.freeze({
    id: "OR-8",
    severity: "defect",
    clause: "TODAY_RANKING.md §2.1 (the candidate set is EVERY eligible object in Read Scope)",
    what:
      "Two worlds give Today a candidate set narrower than the scope the same world's other modes read, so Today's `read` under-counts its own world. `scale` is the loud one: My work holds sixty responsibilities across four Projects and Today is handed the twenty signature candidates instead, so Today says it examined 20 objects while Analytics counts 78 open in the same Projects at the same instant. Both numbers are now derived from real records, so this is a fixture-composition defect and no longer a two-populations one, but a reviewer switching modes still meets two different totals.",
    measured:
      "scale: Today read 20 · My work 60 rows · Analytics included 81, open 78. owner_signature: Today read 20 · Analytics included 21, open 19, the difference being three responsibilities My work lists that Today's candidate set omits (home-task-nc-venue-confirmation, home-task-mf-cars, home-task-sr-cars) and one child task Analytics excludes by rule.",
    owner: "lead",
  }),
  Object.freeze({
    id: "OR-9",
    severity: "defect",
    clause: "CHARTER rule 6 (one definition everywhere)",
    what:
      "One record still exists twice under two ids. Today's `home-task-dst-monday` and My work's `home-task-dst-week` are both the Ballyhoura walk-through in Nora & Cian, with different due dates, so Analytics counts two objects where the world holds one. The other two duplicate pairs in this world were merged while closing OR-6 because every field agreed; this pair cannot be merged without choosing a due date, and each date is load-bearing for the surface that authored it: My work needs T+7 to prove the inclusive edge of its window, Today needs T+2 to prove the near horizon across the clock change.",
    measured:
      "dst_boundary: home-task-dst-monday due 2026-10-26 (Today, T+2) and home-task-dst-week due 2026-10-31 (My work, T+7), same Project, same title `Ballyhoura walk-through`. Analytics population 8 rows for a world holding 7 records. Merged in this pass: home-task-dst-eve into home-task-dst-keys, home-task-dst-later into home-task-dst-late, both exact matches on Project, title and due instant.",
    owner: "lead",
  }),
]);

export function findingById(id: string): OracleFinding {
  const found = ORACLE_FINDINGS.find((entry) => entry.id === id);
  if (!found) throw new Error(`oracle findings: no such finding ${id}`);
  return found;
}
