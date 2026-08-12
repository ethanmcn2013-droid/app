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
    id: "OR-1",
    severity: "defect",
    clause: "ANALYTICS_CLAIM.md §5 (window and timezone are named) and §9 (times)",
    what:
      "Analytics claims are pinned to the module-level July constants and ignore the world's own asOf. In dst_boundary — the one world that reads on a different day — Analytics renders a claim whose stated window is 2026-07-16 beside a Today and a My work computed for 2026-10-24. The lab renders Analytics in every scenario, so this reaches the screen.",
    measured:
      "dst_boundary: scenario asOfIso 2026-10-24T20:15:00.000Z; claim window.asOf and times.renderedAt both 2026-07-16T07:40:00.000Z. Oracle recomputed against the world's own day: open_overdue 7 (claim says 3), work_completed 0 (claim says 4), open_work_age 140 days (claim says 40), stalled_work 14 (claim says 3). open_work agrees at 14 because it has no time term.",
    owner: "lead",
  }),
  Object.freeze({
    id: "OR-2",
    severity: "contract-gap",
    clause: "TODAY_RANKING.md §6 (withholding) against §9.2 Q4",
    what:
      "When the accounting is withheld, the fixture drops Q4 from `quiet.blockedBy` because it tests `accounting && accounting.cappedOut > 0`. Quiet is still refused — Q2 fires instead — but §9.2's stated purpose is that `blockedBy` lets the surface say WHY, and cappedOut > 0 is a true, separately nameable reason that disappears from the list.",
    measured:
      "permission_changed: oracle Q1,Q3,Q4,Q5,Q6,Q7,Q8 · fixture Q1,Q2,Q3,Q5,Q6,Q7,Q8 (cappedOut = 2). provider_failure: oracle Q1,Q3,Q4,Q7,Q8 · fixture Q1,Q2,Q3,Q7,Q8 (cappedOut = 1). Quiet language is refused in both readings, in every world.",
    owner: "wave-5",
  }),
  Object.freeze({
    id: "OR-3",
    severity: "contract-gap",
    clause: "TODAY_RANKING.md §6, last paragraph",
    what:
      "§6 says the accounting is withheld when a provider is `unavailable`, `partial` OR `unsupported`. The fixture withholds only on `unavailable`, so partial_coverage renders a full read accounting over a scope one of whose Projects answered for part of itself. Either the fixture is narrower than the contract or the contract's list is wider than it means; only the lead can seal which.",
    measured:
      "partial_coverage: provider statuses ready,ready,partial,ready; accounting rendered as read 20 = shown 7 + cappedOut 2 + dismissed 1 + cleared 10, and the identity balances. Contract-literal reading would withhold it. Q1 fires either way, so no world claims all clear.",
    owner: "lead",
  }),
  Object.freeze({
    id: "OR-4",
    severity: "contract-gap",
    clause: "TODAY_RANKING.md §5 (Disjointness)",
    what:
      "§5 seals that the four sections are mutually exclusive by sourceKey but never states which section wins a contested key. Three keys in the signature world are eligible for both Today's signal and Needs review; the rendered page differs depending on which pool is taken first. Both the fixture and this oracle happen to take Today's signal first — the fixture by code order, the oracle by the order §5's own table lists — so they agree, on an unstated rule.",
    measured:
      "owner_signature contested keys: tasks:task:home-task-mf-final-invoice, tasks:task:home-task-nc-marquee-lighting, tasks:task:home-task-nc-supplier-contract — each wanted by todaysSignal + needsReview. No key is ever contested between Coming up and any other section, because Coming up excludes flagged keys by construction.",
    owner: "lead",
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
    id: "OR-6",
    severity: "defect",
    clause:
      "CHARTER rule 6 (one definition everywhere), TODAY_RANKING.md §6 (`read` is objects examined in scope), ANALYTICS_CLAIM.md §6 (`included`)",
    what:
      "Home's three counting surfaces are built over two disjoint populations. Today and My work share source ids, so a reviewer can trace a row from one to the other. Analytics shares NONE — `ANALYTICS_ROWS` is a separate `an-*` population that no Today candidate and no My work row appears in. The consequence shows on screen: in owner_quiet, Today reports it examined 4 objects across the three Orchard Projects while Analytics reports 14 open items in the same three Projects at the same instant. A reviewer switching modes is looking at two different worlds, and the harness cannot prove either one wrong.",
    measured:
      "35 distinct Today candidate ids, 76 My work ids, 24 Analytics ids. Today ∩ My work = 13. Today ∩ Analytics = 0. My work ∩ Analytics = 0. owner_quiet: Today read 4 · Analytics included 18, open 14. owner_signature: Today read 20 · Analytics included 18, open 14. Analytics is also invariant across every world except by Project scope, so owner_quiet and owner_signature publish identical Analytics.",
    owner: "lead",
  }),
]);

export function findingById(id: string): OracleFinding {
  const found = ORACLE_FINDINGS.find((entry) => entry.id === id);
  if (!found) throw new Error(`oracle findings: no such finding ${id}`);
  return found;
}
