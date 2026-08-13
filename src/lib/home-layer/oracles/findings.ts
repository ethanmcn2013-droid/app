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
    id: "OR-10",
    severity: "defect",
    clause:
      "TODAY_RANKING.md §7 (`unavailable`: render no rows from it, and say so) against PROJECT_SCOPE.md §8.1 and MY_WORK_PROJECTION.md §10",
    what:
      "Found by the assertion that closed OR-8, and not fixable without a decision the lead owns. `provider_failure` fails one Project's SOURCE read while its ROUTE resolves normally. Today honours that and reads nothing from Nora & Cian. Nothing downstream of Today knows: `unresolved` is derived from `routeState` alone, so My work still renders three Nora & Cian responsibilities and reports reading 3 of 3 Projects, the Project ledger renders Nora & Cian as `ready` with a live count, and A1 counts its rows with `permission: complete`. Three modes disagree about whether the Project was read at all, in the one world whose entire purpose is to show a Project that could not be. Closing it means folding source failure into the unreadable set, and that forces a rendering decision this fixture may not take on its own: the `unresolved` ledger row deliberately carries NO name, because it was written for revocation, where the name is an existence leak. A Project that is authorized, visible and merely unreadable should almost certainly still be named beside the reason. Same state, two correct renderings, and only the lead can pick.",
    measured:
      "provider_failure: Today reads 15 records, 0 of them in Nora & Cian. My work renders 11 rows, 3 of them in Nora & Cian (home-task-nc-marquee-lighting, home-task-nc-musicians, home-task-nc-venue-confirmation), with coverage `projectsRead: 3, projectsAuthorized: 3, projectsUnresolved: 0`. Ledger: Nora & Cian `state: ready, openWork: 3, overdue: 1`. Claim A1: 16 open, `permission: { kind: complete, projects: 3 }`. The world does declare the failure once, on `providerStatuses`, which is why Q1 fires and the accounting is withheld. Every other world reads one population in every mode.",
    owner: "lead",
  }),
]);

export function findingById(id: string): OracleFinding {
  const found = ORACLE_FINDINGS.find((entry) => entry.id === id);
  if (!found) throw new Error(`oracle findings: no such finding ${id}`);
  return found;
}
