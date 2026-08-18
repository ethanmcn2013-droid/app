import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectSummary } from "@/lib/projects/project-ref";
import { assertProjectId } from "@/lib/projects/project-ref";
import {
  chromeFor,
  initialActiveProjectState,
  reduceActiveProject,
  routeKey,
  stampSnapshotEpoch,
  type ActiveProjectState,
} from "@/lib/projects/route-snapshot";

/**
 * Behavioural tests for the provider's state machine.
 *
 * Every other epoch test in this repo hands `decideSnapshotCommit` its inputs
 * directly, which is exactly why a mount-time epoch stamp survived review: the
 * rule was right and the thing that fed it was wrong. These drive the real
 * reducer with the real stamping function, in the order a browser drives them
 * — the route sync renders and publishes, the URL bridge dispatches its route
 * from an effect afterwards — so a defect in the wiring fails here.
 *
 * `render()` and `commitEffects()` model React's two phases: the sync computes
 * its stamp during render, from whatever the provider state was at that
 * moment, and publishes in an effect afterwards.
 */

function project(id: string, revision = 1): ProjectSummary {
  return {
    id: assertProjectId(id),
    slug: id,
    name: id.toUpperCase(),
    role: "primary-owner",
    capabilities: {
      open: true,
      viewPrivateTimeline: true,
      createOrEditTasks: true,
      manageProject: true,
      moveIntoPlanningPeriod: true,
      curatePrimaryTimeline: true,
      publishTimeline: true,
      revokeTimeline: true,
      deleteOrTransferOwnership: true,
    },
    planningPeriod: null,
    position: 1000,
    revision,
    archivedAt: null,
    activeRootTaskCount: 0,
    disambiguator: null,
  };
}

/** A minimal driver for the provider + bridge + route-sync trio. */
class Harness {
  state: ActiveProjectState = initialActiveProjectState();

  /** The URL bridge's effect: publish the live route. */
  navigate(pathname: string, workspaceId: string | null) {
    this.state = reduceActiveProject(this.state, {
      type: "route",
      routeKey: routeKey(pathname, workspaceId),
    });
  }

  /**
   * One render + effect pass of `ActiveProjectRouteSync`: derive the stamp
   * from the state visible during render, then publish it.
   */
  publish(pathname: string, summary: ProjectSummary, suppliedEpoch?: number) {
    const key = routeKey(pathname, summary.id);
    const epoch = stampSnapshotEpoch({
      suppliedEpoch,
      payloadRouteKey: key,
      live: this.state.live,
    });
    this.state = reduceActiveProject(this.state, {
      type: "snapshot",
      snapshot: { routeKey: key, epoch, project: summary },
    });
  }

  chrome(bootstrap: string | null = null) {
    return chromeFor(this.state, bootstrap);
  }
}

/**
 * The killer case. Tasks A → Tasks B is a search-param-only navigation, so
 * Next does not remount the route segment. A stamp captured once at mount
 * stayed at A's epoch while the bridge drove the live epoch to 2, and B's
 * correct snapshot was refused as `stale-epoch` for ever.
 */
test("a same-path A -> B switch commits B and paints B", () => {
  const harness = new Harness();
  const a = project("ws-a");
  const b = project("ws-b");

  // Cold entry on A.
  harness.publish("/app/tasks", a);
  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", a);
  assert.equal(harness.chrome().kind, "verified");

  // The switch: same pathname, different search param. No remount.
  harness.navigate("/app/tasks", "ws-b");
  assert.equal(
    harness.chrome().kind,
    "pending",
    "A stays on screen, inert, until B verifies",
  );

  harness.publish("/app/tasks", b);
  const chrome = harness.chrome();
  assert.equal(chrome.kind, "verified");
  assert(chrome.kind === "verified");
  assert.equal(chrome.project.id, "ws-b");
});

/**
 * Cold entry is a race: the sync renders before the bridge's effect has told
 * the provider what the live route is. The first publish is legitimately
 * refused; what matters is that the second one — after the bridge lands — is
 * not, and that the chrome does not sit in a skeleton for ever.
 */
test("cold entry commits once the bridge has published the live route", () => {
  const harness = new Harness();
  const a = project("ws-a");

  // Render before the bridge effect: the provider still holds the empty route.
  harness.publish("/app/tasks", a);
  assert.equal(harness.state.committed, null, "nothing to match against yet");
  assert.equal(harness.chrome("ws-a").kind, "skeleton");

  // Bridge effect, then the sync's effect re-runs because the stamp changed.
  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", a);

  const chrome = harness.chrome("ws-a");
  assert.equal(chrome.kind, "verified");
  assert(chrome.kind === "verified");
  assert.equal(chrome.project.id, "ws-a");
});

test("a cold direct URL for B never paints cookie-fallback A on the way", () => {
  const harness = new Harness();
  const b = project("ws-b");

  assert.equal(harness.chrome("ws-a").kind, "skeleton");
  harness.publish("/app/tasks", b);
  assert.equal(harness.chrome("ws-a").kind, "skeleton");
  harness.navigate("/app/tasks", "ws-b");
  assert.equal(harness.chrome("ws-a").kind, "skeleton", "still unverified");
  harness.publish("/app/tasks", b);

  const chrome = harness.chrome("ws-a");
  assert(chrome.kind === "verified");
  assert.equal(chrome.project.id, "ws-b", "B, never the cookie's A");
});

test("a payload for B landing while A is live is refused", () => {
  const harness = new Harness();
  const a = project("ws-a");
  const b = project("ws-b");

  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", a);
  const committed = harness.state.committed;

  // B's server payload arrives late, after the user went back to A.
  harness.publish("/app/tasks", b);
  assert.equal(harness.state.committed, committed, "B's snapshot must not land");
});

test("a cross-product navigation re-verifies rather than carrying the old snapshot", () => {
  const harness = new Harness();
  const a = project("ws-a");

  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", a);
  assert.equal(harness.chrome().kind, "verified");

  harness.navigate("/app/notes", "ws-a");
  assert.equal(
    harness.chrome().kind,
    "pending",
    "same Project, different route: the snapshot is for the route, not the Project",
  );

  harness.publish("/app/notes", a);
  assert.equal(harness.chrome().kind, "verified");
});

/**
 * A1 → B → A2, driven rather than hand-fed. This documents the acknowledged
 * limit of a client-minted epoch instead of pretending it is closed: with no
 * supplied epoch the stamp is derived from the live transition, so a late A1
 * payload is indistinguishable from A2's own and does commit. The revision
 * floor is what stops it doing damage.
 */
test("A1 -> B -> A2: the revision floor, not the epoch, is what refuses a late A1", () => {
  const harness = new Harness();
  const a2 = project("ws-a", 9);
  const staleA1 = project("ws-a", 4);
  const b = project("ws-b");

  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", project("ws-a", 3));
  harness.navigate("/app/tasks", "ws-b");
  harness.publish("/app/tasks", b);
  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", a2);

  assert.equal(harness.state.committed?.project.revision, 9);

  // The late A1 payload. Its route key matches, and its derived epoch matches.
  harness.publish("/app/tasks", staleA1);
  assert.equal(
    harness.state.committed?.project.revision,
    9,
    "the older revision is refused; without the floor this would have committed",
  );

  // And a supplied epoch — the case a caller that knows its transition can use
  // — is refused on the epoch alone, before the floor is consulted.
  const harness2 = new Harness();
  harness2.navigate("/app/tasks", "ws-a");
  harness2.publish("/app/tasks", project("ws-a", 3));
  harness2.navigate("/app/tasks", "ws-b");
  harness2.navigate("/app/tasks", "ws-a");
  harness2.publish("/app/tasks", a2);
  harness2.publish("/app/tasks", project("ws-a", 12), 1);
  assert.equal(
    harness2.state.committed?.project.revision,
    9,
    "a supplied stale epoch is refused even when the revision is newer",
  );
});

test("an unstamped payload for a route that is not live carries a refusing epoch", () => {
  const live = { routeKey: routeKey("/app/tasks", "ws-a"), epoch: 3 };
  assert.equal(
    stampSnapshotEpoch({
      payloadRouteKey: routeKey("/app/notes", "ws-b"),
      live,
    }),
    -1,
  );
  assert.equal(
    stampSnapshotEpoch({ payloadRouteKey: live.routeKey, live }),
    3,
    "a payload for the live route stamps the live epoch",
  );
  assert.equal(
    stampSnapshotEpoch({ suppliedEpoch: 1, payloadRouteKey: live.routeKey, live }),
    1,
    "a supplied epoch always wins",
  );
});

test("selection state clears when the destination Project verifies", () => {
  const harness = new Harness();
  const b = project("ws-b");
  harness.navigate("/app/tasks", "ws-a");
  harness.publish("/app/tasks", project("ws-a"));

  harness.state = reduceActiveProject(harness.state, {
    type: "select-started",
    pending: { projectId: assertProjectId("ws-b"), label: "Opening WS-B…" },
  });
  assert.equal(harness.state.pending?.projectId, "ws-b");
  assert.equal(harness.state.lastError, null);

  harness.navigate("/app/tasks", "ws-b");
  harness.publish("/app/tasks", b);
  assert.equal(harness.state.pending, null, "arrival clears the pending label");
});

test("a failed selection clears pending and states that A is still active", () => {
  const harness = new Harness();
  harness.state = reduceActiveProject(harness.state, {
    type: "select-started",
    pending: { projectId: assertProjectId("ws-b"), label: "Opening WS-B…" },
  });
  harness.state = reduceActiveProject(harness.state, {
    type: "select-failed",
    message: "Couldn't open WS-B. You're still in the current project.",
  });
  assert.equal(harness.state.pending, null);
  assert.match(harness.state.lastError ?? "", /still in the current project/);
});

/**
 * WP6: the unsaved-work hold in the machine. A refusal is *held*, not failed:
 * nothing started, so it must not disturb a genuinely pending switch, and it
 * leaves the moment a switch starts or the founder stays put. The hold rule
 * itself (which claims refuse) lives in `unsaved-work.test.ts`; the provider's
 * ordering is pinned by `active-project-contract.test.mjs`.
 */
test("a held switch surfaces its refusal without touching pending, and clears on start or dismiss", () => {
  const refusal = {
    kind: "unsaved-work",
    claims: [
      {
        source: "notes-draft",
        description: "A note you started in Notes hasn’t been saved.",
      },
    ],
  } as const;

  const harness = new Harness();
  harness.state = reduceActiveProject(harness.state, {
    type: "select-refused",
    refusal,
  });
  assert.equal(harness.state.refusal, refusal, "the chrome can render the hold");
  assert.equal(harness.state.pending, null, "held means nothing started");

  // "Stay" — the refusal leaves the screen; the claims live in the store and
  // are untouched, so the next attempt re-consults them.
  harness.state = reduceActiveProject(harness.state, { type: "refusal-dismissed" });
  assert.equal(harness.state.refusal, null);

  // After the owning surface clears its claim, a switch starts — and starting
  // moots any refusal still on screen.
  harness.state = reduceActiveProject(harness.state, {
    type: "select-refused",
    refusal,
  });
  harness.state = reduceActiveProject(harness.state, {
    type: "select-started",
    pending: { projectId: assertProjectId("ws-b"), label: "Opening WS-B…" },
  });
  assert.equal(harness.state.refusal, null, "a started switch clears the hold");
  assert.equal(harness.state.pending?.projectId, "ws-b");
});

test("a refusal never erases an in-flight switch's own label", () => {
  // The provider's ordering makes this unreachable today — the pending guard
  // answers before the store is consulted, and that refusal is not dispatched
  // — but the reducer cannot know its caller's discipline, so the invariant
  // is pinned where it is enforced: `select-refused` touches `refusal` and
  // nothing else.
  const harness = new Harness();
  harness.state = reduceActiveProject(harness.state, {
    type: "select-started",
    pending: { projectId: assertProjectId("ws-b"), label: "Opening WS-B…" },
  });
  harness.state = reduceActiveProject(harness.state, {
    type: "select-refused",
    refusal: { kind: "switch-pending" },
  });
  assert.equal(harness.state.pending?.projectId, "ws-b");
  assert.equal(harness.state.refusal?.kind, "switch-pending");
});
