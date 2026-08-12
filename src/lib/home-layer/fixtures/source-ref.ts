/**
 * Home fixture universe · the shared source identity.
 *
 * Mirrors `CONTENT_OWNERSHIP.md` §1.1 field for field. Declared here, in the
 * fixture family, for the same reason `project-truth-fixture.ts` declares its
 * own types: the Wave 5 module that will own these
 * (`src/lib/home-layer/today/engine.ts`) does not exist yet, and a fixture
 * cannot import a module that has not landed. When it lands, this file is
 * RE-POINTED at it, never duplicated alongside it.
 */

export type SourceProduct = "tasks" | "notes" | "timeline";

export type SourceKind =
  | "task"
  | "note-extract"
  | "milestone"
  | "decision"
  | "follow-up"
  | "calendar-event"
  | "notification"
  | "activity";

export type SourceRef = Readonly<{
  /** The product whose database owns the row. Never the surface showing it. */
  product: SourceProduct;
  kind: SourceKind;
  /** The id in that product's own store. Never re-keyed, never hashed. */
  id: string;
  /** Canonical Project, or null for Unfiled / Unprojectable. A state, not a gap. */
  projectId: string | null;
}>;

/**
 * The ONLY key a Home surface may de-duplicate, dismiss or badge on. Unique
 * across the estate by construction, which is what makes the §4.3 comparator
 * a total order once a second product feeds Home.
 */
export function sourceKey(ref: SourceRef): string {
  return `${ref.product}:${ref.kind}:${ref.id}`;
}

/**
 * `CONTENT_OWNERSHIP.md` §1.1: ids are unique inside a product, not across
 * the estate. A Notes id and a Tasks id can be byte-identical. This universe
 * carries one such collision on purpose so a bare-id de-duplication is a
 * failing test rather than an invisible merge.
 */
export const COLLIDING_BARE_ID = "shared-id-0417";

export function taskRef(id: string, projectId: string | null): SourceRef {
  return Object.freeze({ product: "tasks", kind: "task", id, projectId });
}

export function milestoneRef(id: string, projectId: string | null): SourceRef {
  return Object.freeze({
    product: "timeline",
    kind: "milestone",
    id,
    projectId,
  });
}

export function extractRef(id: string, projectId: string | null): SourceRef {
  return Object.freeze({
    product: "notes",
    kind: "note-extract",
    id,
    projectId,
  });
}
