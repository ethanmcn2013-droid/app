/**
 * The unsaved-work signal — WP6 lane C, the part the surface map says must be
 * invented (`docs/wave/WP6_SURFACE_MAP.md` §6).
 *
 * Production has a guarded one-at-a-time Project transition, but no way for a
 * surface to tell it "switching now loses work". The only real dirty tracking
 * today is local to the Notes workspace behind a same-tab `beforeunload` — and
 * `beforeunload` does not fire on a client-side navigation, so a Project
 * switch loses a Notes draft silently where a tab close would have warned.
 * This module is the host signal that closes that gap.
 *
 * The shape, and why:
 *
 *  - A surface REGISTERS a claim: one per `source`, republished idempotently
 *    from the surface's own state. The claim carries state and copy — a
 *    plain-English `description` a stranger surface can render — and never
 *    behaviour. Save / retry / stay / discard semantics stay with the owning
 *    surface; a chrome control that knows nothing about Notes can still say
 *    honestly what is holding the switch.
 *
 *  - The guarded transition CONSULTS the registry synchronously, in the event
 *    handler, before it claims its one-selection ref. That is why this is a
 *    plain mutable registry and not React state: the provider's selection
 *    guard runs ahead of any React batch (see the `pendingRef` note in
 *    `active-project-provider.tsx`), and a value read through a hook would be
 *    one render stale.
 *
 *  - Sources are vocabulary, not imports. `"notes-draft"` here is a string a
 *    renderer may switch on; nothing in this module or its consumers reaches
 *    into `src/modules/notes/**`.
 *
 * Pure module: no React, no I/O — testable the same way `route-snapshot.ts`
 * is, and importable by it for the refusal type.
 */

import type { ProjectId } from "@/lib/projects/project-ref";

/**
 * Where a claim comes from. `notes-*` are wired now (the three dirty truths
 * the Notes `beforeunload` guard already reads); `task-editor` is reserved for
 * the Tasks editors the map names as the next publisher, so the union is the
 * seam's whole vocabulary rather than one product's.
 */
export type UnsavedWorkSource =
  | "notes-draft"
  | "notes-edit"
  | "notes-capture"
  | "task-editor";

export type UnsavedWorkClaim = Readonly<{
  source: UnsavedWorkSource;
  /**
   * Plain-English, surface-authored, renderable by a surface that has never
   * heard of the publisher: "A note you started hasn't been saved."
   */
  description: string;
  /**
   * The Project the work will file to, when the surface knows it. Notes
   * drafts are personal and carry none; a Tasks editor would carry the board
   * it is editing. Copy only — the guard never branches on it, because a
   * client-side switch loses tab-local work whatever the destination.
   */
  filedToProjectId?: ProjectId | null;
}>;

export type UnsavedWorkStore = Readonly<{
  /**
   * The current claims, as a frozen snapshot. Stable between changes, so it
   * is safe as a `useSyncExternalStore` snapshot and safe to hold inside a
   * refusal as the record of why the switch was held.
   */
  claims: () => readonly UnsavedWorkClaim[];
  /** Upsert by `source`. Republishing an identical claim notifies nobody. */
  publish: (claim: UnsavedWorkClaim) => void;
  /** Remove one source's claim. Clearing what is absent notifies nobody. */
  clear: (source: UnsavedWorkSource) => void;
  subscribe: (listener: () => void) => () => void;
}>;

export function createUnsavedWorkStore(): UnsavedWorkStore {
  const bySource = new Map<UnsavedWorkSource, UnsavedWorkClaim>();
  const listeners = new Set<() => void>();
  let snapshot: readonly UnsavedWorkClaim[] = Object.freeze([]);

  const notify = () => {
    snapshot = Object.freeze([...bySource.values()]);
    // Copy before iterating: a listener may unsubscribe itself.
    for (const listener of [...listeners]) listener();
  };

  return {
    claims: () => snapshot,
    publish(claim) {
      const existing = bySource.get(claim.source);
      // Idempotence is load-bearing, not a nicety: publishers re-run from
      // effects on every state change of theirs, and an unconditional notify
      // would re-render every subscriber per keystroke.
      if (
        existing &&
        existing.description === claim.description &&
        (existing.filedToProjectId ?? null) === (claim.filedToProjectId ?? null)
      ) {
        return;
      }
      bySource.set(claim.source, claim);
      notify();
    },
    clear(source) {
      if (!bySource.delete(source)) return;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * What `selectProject` answers, in place of the old bare boolean.
 *
 * A refusal is structured because the caller has to RENDER it: "false" cannot
 * say what is unsaved or whose copy to show. `switch-pending` keeps the lab's
 * semantics — a second pick while one is in flight is refused outright, not
 * queued — and `unsaved-work` is the held switch, carrying the claims that
 * held it.
 */
export type SelectProjectRefusal =
  | Readonly<{ kind: "switch-pending" }>
  | Readonly<{ kind: "unsaved-work"; claims: readonly UnsavedWorkClaim[] }>;

export type SelectProjectResult =
  | Readonly<{ kind: "started" }>
  | SelectProjectRefusal;

/**
 * The hold rule, separated so it can be proved without React: dirty state
 * present → the switch is held and the refusal carries the claims; nothing
 * registered → no objection. The provider consults this before claiming its
 * one-selection ref, so a held switch never starts and leaves nothing
 * pending.
 */
export function refuseForUnsavedWork(
  claims: readonly UnsavedWorkClaim[],
): Extract<SelectProjectRefusal, { kind: "unsaved-work" }> | null {
  if (claims.length === 0) return null;
  return { kind: "unsaved-work", claims };
}
