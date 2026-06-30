# Cycle queue - log later

Items deferred from review passes. Address opportunistically in later Cycles.

## From Cycle 1

- **TaskCard / MorphCard divergence.** `task-card.tsx` was edited with a `variant` prop nothing now uses; the morphing card lives inline in `demo-surface.tsx`. Either delete the variant prop on `TaskCard` (rollback plan keeps the file but the prop is dead), or reunify so the canonical card and the morph card are one. Cycle 2 candidate.
- **Stable ref callback in MorphCard.** Inline arrow creates new identity each render, so React calls ref with `null` and then a new node. Safe today because scenes only `getRect` between awaits, but a footgun. Wrap with `useCallback((el) => ..., [task.id])`.
- **Memoize `useMorphTransition` returns.** Hook returns fresh object literal each call; if anyone wraps `MorphCard` in `React.memo` it silently busts. Wrap return values in `useMemo(() => ..., [reduce])`.
- **Dead-code purge.** `list-view.tsx`, `timeline-view.tsx`, `board-view.tsx`, plus `BoardSurface` and `BoardCardWrapper` inside `cinematic-demo.tsx`. Kept this Cycle for rollback. Delete in Cycle 2 once morph proves stable.
- **`currentStateRef` stale by one paint.** Setting state then reading the ref in the same tick returns the prior commit. Today's guards always sit behind an `await wait(...)`, so safe; document the contract or drop the ref in favor of in-closure derivation.