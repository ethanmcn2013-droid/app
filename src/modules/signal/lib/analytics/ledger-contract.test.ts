import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSignalLedger,
  safeSignalAppHref,
  SIGNAL_LEDGER_MAX_ENTRIES,
  type BuildSignalLedgerInput,
  type SignalLedgerCandidate,
} from "./ledger-contract";

const APP_ORIGIN = "https://app.signalstudio.ie";

describe("the accounting never calls held-back work clear", () => {
  it("subtracts everything that crossed a rule, not just what is shown", () => {
    // Six crossed a rule out of forty read; the display cap shows three.
    // The three held back are neither shown nor clear, so they are named
    // by `flagged` and are absent from `cleared`.
    const ledger = buildSignalLedger(
      input({
        candidates: [0, 1, 2, 3, 4, 5].map((index) => candidate(index)),
        readCount: 40,
        triggeredCount: 6,
      }),
    );
    assert.equal(ledger.entries.length, SIGNAL_LEDGER_MAX_ENTRIES);
    assert.deepEqual(ledger.readCounts, {
      read: 40,
      flagged: 6,
      shown: 3,
      cleared: 34,
    });
  });

  it("closes the arithmetic in front of the reader", () => {
    const ledger = buildSignalLedger(
      input({
        candidates: [0, 1, 2, 3, 4, 5].map((index) => candidate(index)),
        readCount: 40,
        triggeredCount: 6,
      }),
    );
    const counts = ledger.readCounts!;
    assert.equal(counts.flagged + counts.cleared, counts.read);
    assert.ok(counts.shown <= counts.flagged);
  });

  it("counts what is shown in items, not in rows", () => {
    // One row standing for two merged items still stands for two items,
    // so the header can never say "one shown" over a row reading "2 items".
    const ledger = buildSignalLedger(
      input({
        candidates: [
          candidate(0, {
            receipt: {
              ...candidate(0).receipt,
              evidenceCount: 2,
              sourceCounts: { notes: 0, tasks: 2, milestones: 0 },
            },
          }),
        ],
        readCount: 12,
        triggeredCount: 2,
      }),
    );
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.readCounts?.shown, 2);
    assert.equal(ledger.readCounts?.flagged, 2);
  });

  it("falls back to the candidate count when no pre-cap total is given", () => {
    const ledger = buildSignalLedger(
      input({ candidates: [candidate(0)], readCount: 12 }),
    );
    assert.deepEqual(ledger.readCounts, {
      read: 12,
      flagged: 1,
      shown: 1,
      cleared: 11,
    });
  });

  it("withholds the accounting rather than guessing a denominator", () => {
    assert.equal(buildSignalLedger(input()).readCounts, null);
  });

  it("never reports a negative cleared count", () => {
    const ledger = buildSignalLedger(
      input({ readCount: 1, triggeredCount: 6 }),
    );
    assert.equal(ledger.readCounts?.cleared, 0);
  });
});

function candidate(
  index: number,
  overrides: Partial<SignalLedgerCandidate> = {},
): SignalLedgerCandidate {
  return {
    idSeed: `private-task-id-${index}`,
    section: index === 0 ? "attention" : "risks",
    state: index === 0 ? "needs_attention" : "watch",
    text: `Grounded observation ${index}`,
    detail: `A concise account of observation ${index}.`,
    reasons: [`Rule ${index} crossed its reviewed threshold.`],
    receipt: {
      sourceLabel: "Tasks · Personal",
      evidenceCount: 1,
      sourceCounts: { notes: 0, tasks: 1, milestones: 0 },
      ageLabel: null,
      updatedAtLabel: "26 Jul, 09:00",
    },
    primaryAction: {
      label: "Open task",
      href: `${APP_ORIGIN}/app/tasks?task=${index}`,
    },
    fallbackAction: { label: "Open Tasks", href: "/app/tasks" },
    evidenceHref: `/app/signal?evidence=observation-${index}`,
    ...overrides,
  };
}

function input(
  overrides: Partial<BuildSignalLedgerInput> = {},
): BuildSignalLedgerInput {
  return {
    heading: "Three things genuinely need you.",
    generatedAt: "2026-07-26T08:00:00.000Z",
    generatedAtLabel: "Sunday, 09:00",
    scopeLabel: "Personal",
    scopeKind: "workspace",
    freshness: "fresh",
    coverageStatus: "complete",
    candidates: [candidate(0)],
    healthyEmptyState: {
      headline: "Nothing needs your attention right now.",
      body: "No item in this scope crossed Signal’s attention rules.",
    },
    closingLine: "That’s the read. Dates came first, then the quiet ones.",
    allowedAppOrigin: APP_ORIGIN,
    ...overrides,
  };
}

describe("Signal ledger presentation contract", () => {
  it("emits only the versioned allowlisted shape and opaque ids", () => {
    const unsafeCandidate = {
      ...candidate(0),
      sourceRecords: [
        {
          id: "raw-source-id",
          noteBody: "private note body",
          clerkId: "user_private",
        },
      ],
    } as SignalLedgerCandidate;

    const ledger = buildSignalLedger(input({ candidates: [unsafeCandidate] }));
    assert.deepEqual(Object.keys(ledger).sort(), [
      "closingLine",
      "coverageNote",
      "emptyState",
      "entries",
      "freshness",
      "generatedAt",
      "generatedAtLabel",
      "heading",
      "readCounts",
      "scopeKind",
      "scopeLabel",
      "version",
    ]);
    assert.deepEqual(Object.keys(ledger.entries[0]!).sort(), [
      "detail",
      "evidenceHref",
      "id",
      "primaryAction",
      "reasons",
      "receipt",
      "section",
      "state",
      "text",
    ]);

    const serialized = JSON.stringify(ledger);
    assert.doesNotMatch(serialized, /private-task-id-0/);
    assert.doesNotMatch(serialized, /raw-source-id/);
    assert.doesNotMatch(serialized, /private note body/);
    assert.doesNotMatch(serialized, /user_private/);
    assert.match(ledger.entries[0]!.id, /^signal-[a-z0-9]+$/);
  });

  it("enforces the briefing-wide maximum of three entries", () => {
    const ledger = buildSignalLedger(
      input({ candidates: [0, 1, 2, 3, 4].map((index) => candidate(index)) }),
    );

    assert.equal(SIGNAL_LEDGER_MAX_ENTRIES, 3);
    assert.equal(ledger.entries.length, 3);
    assert.deepEqual(
      ledger.entries.map((entry) => entry.text),
      [
        "Grounded observation 0",
        "Grounded observation 1",
        "Grounded observation 2",
      ],
    );
  });

  it("never turns partial or unavailable coverage into a healthy empty day", () => {
    for (const state of ["partial", "stale", "unavailable"] as const) {
      const ledger = buildSignalLedger(
        input({
          candidates: [],
          freshness: state,
          coverageStatus: state,
        }),
      );

      assert.equal(ledger.emptyState?.kind, "coverage");
      assert.ok(ledger.coverageNote);
      assert.doesNotMatch(
        `${ledger.emptyState?.headline} ${ledger.emptyState?.body}`,
        /nothing needs your attention|all clear/i,
      );
    }
  });

  it("states the coverage state instead of defending the engine", () => {
    for (const state of ["partial", "stale", "unavailable"] as const) {
      const ledger = buildSignalLedger(
        input({ candidates: [], freshness: state, coverageStatus: state }),
      );
      const copy = `${ledger.emptyState?.headline} ${ledger.emptyState?.body}`;

      // "Signal is not calling the rest clear" / "nothing here is being
      // called current" argue with the reader about the implementation.
      assert.doesNotMatch(
        copy,
        /is not (calling|being)|is being called|nothing here is/i,
        `${state}: ${copy}`,
      );
      // There is no refresh control in Signal; the read happens when the
      // reader opens it.
      assert.doesNotMatch(copy, /refresh|try again|reload/i, `${state}: ${copy}`);
      assert.doesNotMatch(copy, /—|!/, `${state}: ${copy}`);
      assert.doesNotMatch(copy, /'/, `${state}: ${copy}`);
    }
  });

  it("keeps the coverage note free of the straight apostrophe", () => {
    for (const state of ["partial", "stale", "unavailable"] as const) {
      const ledger = buildSignalLedger(
        input({ candidates: [], freshness: state, coverageStatus: state }),
      );
      assert.doesNotMatch(ledger.coverageNote!, /'/, state);
    }
  });

  it("preserves the healthy empty state only with complete coverage", () => {
    const ledger = buildSignalLedger(input({ candidates: [] }));

    assert.equal(ledger.emptyState?.kind, "healthy");
    assert.equal(
      ledger.emptyState?.headline,
      "Nothing needs your attention right now.",
    );
    assert.equal(ledger.coverageNote, null);
  });

  it("allows only canonical product routes on the configured app origin", () => {
    assert.equal(
      safeSignalAppHref(
        "https://app.signalstudio.ie/app/tasks?task=one#detail",
        APP_ORIGIN,
      ),
      "/app/tasks?task=one#detail",
    );
    assert.equal(
      safeSignalAppHref("/app/timeline/wedding?workspaceId=one", APP_ORIGIN),
      "/app/timeline/wedding?workspaceId=one",
    );
    assert.equal(
      safeSignalAppHref("/app/notes", APP_ORIGIN),
      "/app/notes",
    );
    assert.equal(
      safeSignalAppHref("/app/signal?evidence=one", APP_ORIGIN),
      "/app/signal?evidence=one",
    );

    for (const unsafe of [
      "https://evil.example/app/tasks",
      "//evil.example/app/tasks",
      "javascript:alert(1)",
      "/api/account/delete",
      "/app/settings",
      "/app/taskish",
    ]) {
      assert.equal(safeSignalAppHref(unsafe, APP_ORIGIN), null);
    }
  });

  it("drops an unsafe primary action and uses an allowlisted fallback", () => {
    const ledger = buildSignalLedger(
      input({
        candidates: [
          candidate(0, {
            primaryAction: {
              label: "Leave Signal",
              href: "https://evil.example/collect",
            },
            fallbackAction: {
              label: "Review in Tasks",
              href: "/app/tasks",
            },
          }),
        ],
      }),
    );

    assert.deepEqual(ledger.entries[0]?.primaryAction, {
      label: "Review in Tasks",
      href: "/app/tasks",
    });
  });

  it("keeps source identifiers out of client action URLs", () => {
    const rawSourceId = "task-private-source-7f91";
    const ledger = buildSignalLedger(
      input({
        candidates: [
          candidate(0, {
            primaryAction: {
              label: "Open task",
              href: `/app/tasks?task=${rawSourceId}#detail`,
            },
            fallbackAction: {
              label: "Review in Tasks",
              href: "/app/tasks",
            },
          }),
        ],
      }),
    );

    assert.deepEqual(ledger.entries[0]?.primaryAction, {
      label: "Review in Tasks",
      href: "/app/tasks",
    });
    assert.doesNotMatch(JSON.stringify(ledger), new RegExp(rawSourceId));
  });

  it("drops an unsafe evidence link instead of serializing it", () => {
    const ledger = buildSignalLedger(
      input({
        candidates: [
          candidate(0, {
            evidenceHref: "https://evil.example/evidence",
          }),
        ],
      }),
    );

    assert.equal(ledger.entries[0]?.evidenceHref, null);
  });
});
