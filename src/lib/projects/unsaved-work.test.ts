import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createUnsavedWorkStore,
  refuseForUnsavedWork,
  type UnsavedWorkClaim,
} from "@/lib/projects/unsaved-work";

/**
 * The unsaved-work signal, driven directly (WP6 lane C).
 *
 * The React glue around this store is deliberately thin — a context that
 * carries the instance, and effects in the owning surfaces that republish
 * from their own state — so the properties that make the seam safe are all
 * here: registration is an idempotent upsert, snapshots are stable and
 * frozen, and the hold rule refuses while any claim stands and stands aside
 * the moment none does. The provider's ordering (consult before the
 * one-selection ref is claimed) is pinned by
 * `src/server/projects/active-project-contract.test.mjs`; the reducer's
 * handling of the refusal by `active-project-machine.test.ts`.
 */

const draft: UnsavedWorkClaim = {
  source: "notes-draft",
  description: "A note you started in Notes hasn’t been saved.",
};

test("registering a claim makes it visible; clearing it removes it", () => {
  const store = createUnsavedWorkStore();
  assert.deepEqual(store.claims(), []);

  store.publish(draft);
  assert.deepEqual(store.claims(), [draft]);

  store.clear("notes-draft");
  assert.deepEqual(store.claims(), []);
});

test("publish is an upsert by source, and keeps registration order", () => {
  const store = createUnsavedWorkStore();
  store.publish(draft);
  store.publish({ source: "notes-capture", description: "Notes are still saving." });
  // The draft's copy changes; its position and cardinality must not.
  store.publish({ source: "notes-draft", description: "Two notes haven’t been saved." });

  assert.equal(store.claims().length, 2);
  assert.equal(store.claims()[0]?.source, "notes-draft");
  assert.equal(store.claims()[0]?.description, "Two notes haven’t been saved.");
  assert.equal(store.claims()[1]?.source, "notes-capture");
});

test("republishing an identical claim notifies nobody — publishers run in effects", () => {
  const store = createUnsavedWorkStore();
  let notified = 0;
  store.subscribe(() => {
    notified += 1;
  });

  store.publish(draft);
  const snapshot = store.claims();
  assert.equal(notified, 1);

  // The owning surface re-runs its effect on every keystroke-adjacent state
  // change; an unconditional notify would re-render every subscriber each time.
  store.publish({ ...draft });
  assert.equal(notified, 1);
  assert.equal(store.claims(), snapshot, "the snapshot identity is unchanged");

  // Clearing what is absent is equally silent.
  store.clear("task-editor");
  assert.equal(notified, 1);

  store.clear("notes-draft");
  assert.equal(notified, 2);
});

test("snapshots are stable between changes, frozen, and detached from later writes", () => {
  const store = createUnsavedWorkStore();
  store.publish(draft);

  const before = store.claims();
  assert.equal(store.claims(), before, "same reference until something changes");
  assert.ok(Object.isFrozen(before));

  // A refusal holds the snapshot as the record of why the switch was held;
  // clearing afterwards must not rewrite that record.
  store.clear("notes-draft");
  assert.deepEqual(before, [draft]);
  assert.deepEqual(store.claims(), []);
});

test("unsubscribe stops notifications", () => {
  const store = createUnsavedWorkStore();
  let notified = 0;
  const unsubscribe = store.subscribe(() => {
    notified += 1;
  });
  store.publish(draft);
  unsubscribe();
  store.clear("notes-draft");
  assert.equal(notified, 1);
});

test("the hold rule: dirty state present → a structured refusal carrying the claims", () => {
  assert.equal(refuseForUnsavedWork([]), null, "nothing registered → no objection");

  const refusal = refuseForUnsavedWork([draft]);
  assert.ok(refusal);
  assert.equal(refusal.kind, "unsaved-work");
  assert.deepEqual(refusal.claims, [draft]);
});

/**
 * The seam's whole journey, as the provider drives it: refuse while dirty,
 * proceed after the owning surface saves or discards. `selectProject` is this
 * sequence plus React glue — consult the live snapshot, return the refusal
 * without claiming the one-selection ref, start the switch when the consult
 * comes back clean.
 */
test("a switch is held while a claim stands and proceeds once it clears", () => {
  const store = createUnsavedWorkStore();

  // Notes publishes from its dirty state.
  store.publish(draft);

  // First attempt: held. The refusal carries the copy a stranger surface renders.
  const held = refuseForUnsavedWork(store.claims());
  assert.ok(held);
  assert.equal(held.claims[0]?.description, draft.description);

  // The founder saves (or discards) in Notes; the surface clears its claim.
  store.clear("notes-draft");

  // Second attempt: nothing objects, the guarded transition may start.
  assert.equal(refuseForUnsavedWork(store.claims()), null);
});
