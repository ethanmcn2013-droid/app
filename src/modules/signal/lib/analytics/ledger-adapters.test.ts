import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BriefingResponse } from "./contracts";
import {
  groupLegacyBriefItems,
  ledgerFromLegacyBriefing,
  ledgerFromProgressiveBriefing,
} from "./ledger-adapters";
import { legacyLedgerTasksHref } from "./ledger-task-target";
import type { Briefing, BriefItem } from "../briefing/types";

const APP_ORIGIN = "https://app.signalstudio.ie";
const NOW = Date.parse("2026-07-26T08:00:00.000Z");

function legacyItem(
  id: string,
  workspaceId = "workspace-one",
): BriefItem {
  return {
    id,
    text: "Send the wedding invites",
    detail: "Nothing has moved on it for nine days.",
    sourceLabel: "Tasks · Personal",
    trigger: "stuck-work",
    reasons: [
      "Signal flags anything quiet for three days or more.",
      "Started, and still open.",
    ],
    workspaceId,
    planningPeriodId: null,
  };
}

function legacyBriefing(
  items: BriefItem[],
  overrides: Partial<Briefing> = {},
): Briefing {
  return {
    userId: "clerk-private-user",
    generatedAt: NOW,
    greetingHour: 9,
    needsAttention: [],
    movingWell: [],
    quietRisks: items,
    suggestedFocus: [],
    isEmpty: items.length === 0,
    readCount: 0,
    triggeredCount: items.length,
    ...overrides,
  };
}

describe("legacy Signal ledger adapter", () => {
  it("groups exact same-title signals in the same authorized scope", () => {
    const briefing = legacyBriefing([
      legacyItem("task-private-one"),
      legacyItem("task-private-two"),
    ]);

    const groups = groupLegacyBriefItems(briefing);
    const ledger = ledgerFromLegacyBriefing(briefing, {
      generatedAtLabel: "Sunday, 09:00",
      scopeLabel: "Personal",
      scopeKind: "workspace",
      allowedAppOrigin: APP_ORIGIN,
    });

    assert.equal(groups.length, 1);
    assert.equal(ledger.entries.length, 1);
    // The headline is the reader's own title, verbatim; the observation
    // sits underneath it as detail.
    assert.equal(ledger.entries[0]?.text, "Send the wedding invites");
    assert.equal(
      ledger.entries[0]?.detail,
      "Nothing has moved on it for nine days.",
    );
    assert.equal(ledger.entries[0]?.receipt.evidenceCount, 2);
    assert.equal(ledger.entries[0]?.receipt.sourceCounts.tasks, 2);
    assert.deepEqual(ledger.entries[0]?.primaryAction, {
      label: "Review in Tasks",
      href: "/app/tasks",
    });
  });

  it("does not merge matching prose across different workspaces", () => {
    const briefing = legacyBriefing([
      legacyItem("task-one", "workspace-one"),
      legacyItem("task-two", "workspace-two"),
    ]);

    assert.equal(groupLegacyBriefItems(briefing).length, 2);
  });

  it("does not merge a shared title whose observations differ", () => {
    const briefing = legacyBriefing([
      legacyItem("task-one"),
      {
        ...legacyItem("task-two"),
        detail: "Nothing has moved on it for twenty days.",
      },
    ]);

    assert.equal(groupLegacyBriefItems(briefing).length, 2);
  });

  it("carries the engine's read count into the accounting", () => {
    const ledger = ledgerFromLegacyBriefing(
      legacyBriefing([legacyItem("task-counted")], { readCount: 41 }),
      {
        generatedAtLabel: "Sunday, 09:00",
        scopeLabel: "Personal",
        scopeKind: "workspace",
        allowedAppOrigin: APP_ORIGIN,
      },
    );

    assert.equal(ledger.readCounts?.read, 41);
    assert.equal(ledger.readCounts?.flagged, 1);
    assert.equal(ledger.readCounts?.shown, 1);
    assert.equal(ledger.readCounts?.cleared, 40);
  });

  it("states the denominator on a clear day instead of asserting it", () => {
    const withCount = ledgerFromLegacyBriefing(
      legacyBriefing([], { readCount: 41 }),
      {
        generatedAtLabel: "Sunday, 09:00",
        scopeLabel: "Personal",
        scopeKind: "workspace",
        allowedAppOrigin: APP_ORIGIN,
      },
    );
    const withoutCount = ledgerFromLegacyBriefing(
      legacyBriefing([], {
        readCount: 0,
        emptyStateBody:
          "No event work in this scope crossed Signal’s attention rules.",
      }),
      {
        generatedAtLabel: "Sunday, 09:00",
        scopeLabel: "Personal",
        scopeKind: "workspace",
        allowedAppOrigin: APP_ORIGIN,
      },
    );

    assert.equal(
      withCount.emptyState?.body,
      "Signal read 41 items in this scope. Nothing crossed Signal’s attention rules.",
    );
    assert.equal(
      withoutCount.emptyState?.body,
      "No event work in this scope crossed Signal’s attention rules.",
    );
  });

  // The ledger's entries are attention and risks only, so a lone
  // just-shipped item leaves the page empty while having crossed a rule.
  // "Nothing crossed Signal's attention rules" over that day was a false
  // all-clear the reader had no way to catch.
  it("never calls an empty page an all-clear when something crossed", () => {
    const ledger = ledgerFromLegacyBriefing(
      legacyBriefing([], { readCount: 2, triggeredCount: 1 }),
      {
        generatedAtLabel: "Sunday, 09:00",
        scopeLabel: "Personal",
        scopeKind: "workspace",
        allowedAppOrigin: APP_ORIGIN,
      },
    );

    assert.equal(ledger.emptyState?.kind, "healthy");
    assert.equal(
      ledger.emptyState?.body,
      "Signal read two items in this scope. One of them crossed a rule without asking anything of you.",
    );
    assert.doesNotMatch(ledger.emptyState!.body, /nothing crossed/i);
  });

  it("signs off with the same sentence the briefing voice uses", () => {
    const ledger = ledgerFromLegacyBriefing(
      legacyBriefing([legacyItem("task-one")]),
      {
        generatedAtLabel: "Sunday, 09:00",
        scopeLabel: "Personal",
        scopeKind: "workspace",
        allowedAppOrigin: APP_ORIGIN,
      },
    );

    // One row, so the sign-off stops after the read: the row already
    // carries its own "Review in Tasks" control.
    assert.equal(ledger.closingLine, "That’s the read.");
  });

  it("never signs off with an order the page does not carry out", () => {
    for (const count of [0, 1, 2, 3]) {
      const ledger = ledgerFromLegacyBriefing(
        legacyBriefing(
          Array.from({ length: count }, (_, index) =>
            legacyItem(`task-${index}`),
          ).map((item, index) => ({
            ...item,
            detail: `Nothing has moved on it for ${index + 3} days.`,
          })),
        ),
        {
          generatedAtLabel: "Sunday, 09:00",
          scopeLabel: "Personal",
          scopeKind: "workspace",
          allowedAppOrigin: APP_ORIGIN,
        },
      );
      if (!ledger.closingLine) continue;
      assert.doesNotMatch(ledger.closingLine, /open tasks/i, ledger.closingLine);
      assert.doesNotMatch(
        ledger.closingLine,
        /waiting longest/i,
        ledger.closingLine,
      );
      assert.doesNotMatch(ledger.closingLine, /'/, ledger.closingLine);
    }
  });

  it("does not serialize the legacy reader id or hidden focus projection", () => {
    const briefing = legacyBriefing([legacyItem("task-visible")], {
      suggestedFocus: [
        {
          id: "hidden-focus-private-id",
          text: "Hidden focus",
          due: "today",
          trigger: "stuck-work",
        },
      ],
    });
    const ledger = ledgerFromLegacyBriefing(briefing, {
      generatedAtLabel: "Sunday, 09:00",
      scopeLabel: "Personal",
      scopeKind: "workspace",
      allowedAppOrigin: APP_ORIGIN,
    });
    const serialized = JSON.stringify(ledger);

    assert.doesNotMatch(serialized, /clerk-private-user/);
    assert.doesNotMatch(serialized, /hidden-focus-private-id/);
    assert.doesNotMatch(serialized, /Hidden focus/);
  });

  it("never exposes a single legacy task id in its action URL", () => {
    const rawTaskId = "task-private-single";
    const ledger = ledgerFromLegacyBriefing(
      legacyBriefing([legacyItem(rawTaskId)]),
      {
        generatedAtLabel: "Sunday, 09:00",
        scopeLabel: "Personal",
        scopeKind: "workspace",
        allowedAppOrigin: APP_ORIGIN,
      },
    );

    assert.deepEqual(ledger.entries[0]?.primaryAction, {
      label: "Review in Tasks",
      href: "/app/tasks",
    });
    assert.doesNotMatch(JSON.stringify(ledger), new RegExp(rawTaskId));
  });

  it("maps only the opaque entry id back to an authorized Tasks receipt", () => {
    const rawTaskId = "task-private-single";
    const workspaceId = "workspace-one";
    const briefing = legacyBriefing([
      legacyItem(rawTaskId, workspaceId),
    ]);
    const ledger = ledgerFromLegacyBriefing(briefing, {
      generatedAtLabel: "Sunday, 09:00",
      scopeLabel: "The Orchard, events",
      scopeKind: "workspace",
      allowedAppOrigin: APP_ORIGIN,
    });
    const authorizedScope = {
      scope: { kind: "workspace" as const, workspaceId },
      label: "The Orchard, events",
      timezone: "Europe/Dublin",
      period: null,
      workspaces: [
        {
          id: workspaceId,
          name: "The Orchard, events",
          role: "owner" as const,
          planningPeriodId: null,
          contextType: "wedding",
          primaryDate: "2026-10-03",
          primaryDateLabel: "Wedding day",
        },
      ],
    };

    assert.doesNotMatch(JSON.stringify(ledger), new RegExp(rawTaskId));
    assert.equal(
      legacyLedgerTasksHref(
        briefing,
        authorizedScope,
        ledger.entries[0]!.id,
      ),
      "/app/tasks?task=task-private-single&workspaceId=workspace-one",
    );
    assert.equal(
      legacyLedgerTasksHref(
        briefing,
        authorizedScope,
        ledger.entries[0]!.id,
        {
          planningPeriodId: "period-one",
          projectId: "project-one",
        },
      ),
      "/app/tasks?task=task-private-single&workspaceId=workspace-one&planningPeriodId=period-one&projectId=project-one",
    );
    assert.equal(
      legacyLedgerTasksHref(
        briefing,
        authorizedScope,
        ledger.entries[0]!.id,
        {
          planningPeriodId: "period-one?leak=true",
          projectId: "../project-one",
        },
      ),
      "/app/tasks?task=task-private-single&workspaceId=workspace-one",
    );
    assert.equal(
      legacyLedgerTasksHref(
        briefing,
        authorizedScope,
        "signal-not-the-current-entry",
      ),
      null,
    );
  });

  it("refuses to deep-link a task outside the rebuilt authorized scope", () => {
    const briefing = legacyBriefing([
      legacyItem("task-private-other", "workspace-other"),
    ]);
    const ledger = ledgerFromLegacyBriefing(briefing, {
      generatedAtLabel: "Sunday, 09:00",
      scopeLabel: "The Orchard, events",
      scopeKind: "workspace",
      allowedAppOrigin: APP_ORIGIN,
    });

    assert.equal(
      legacyLedgerTasksHref(
        briefing,
        {
          scope: {
            kind: "workspace",
            workspaceId: "workspace-authorized",
          },
          label: "The Orchard, events",
          timezone: "Europe/Dublin",
          period: null,
          workspaces: [
            {
              id: "workspace-authorized",
              name: "The Orchard, events",
              role: "owner",
              planningPeriodId: null,
              contextType: "wedding",
              primaryDate: null,
              primaryDateLabel: null,
            },
          ],
        },
        ledger.entries[0]!.id,
      ),
      "/app/tasks?workspaceId=workspace-authorized",
    );
  });
});

describe("progressive Signal ledger adapter", () => {
  it("keeps source records behind Evidence and emits only aggregate receipts", () => {
    const response = progressiveBriefing();
    const ledger = ledgerFromProgressiveBriefing(response, {
      generatedAtLabel: "26 Jul, 09:00",
      scopeLabel: "Personal",
      allowedAppOrigin: APP_ORIGIN,
      evidenceHref: (id) => `/app/signal?evidence=${id}`,
    });
    const serialized = JSON.stringify(ledger);

    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0]?.receipt.evidenceCount, 2);
    assert.equal(ledger.entries[0]?.receipt.sourceCounts.tasks, 2);
    assert.doesNotMatch(serialized, /Private task title/);
    assert.doesNotMatch(serialized, /raw-task-private-one/);
    assert.doesNotMatch(serialized, /workspace-private-one/);
    assert.doesNotMatch(serialized, /"ownerIds"/);
    assert.deepEqual(ledger.entries[0]?.primaryAction, {
      label: "Review in Tasks",
      href: "/app/tasks",
    });
    assert.equal(
      ledger.entries[0]?.evidenceHref,
      "/app/signal?evidence=observation-one",
    );
  });

  it("counts the heading in words and closes with the briefing voice", () => {
    const response = progressiveBriefing();
    const two = {
      ...response,
      observations: [
        { ...response.observations[0]!, state: "needs_attention" as const },
        {
          ...response.observations[0]!,
          id: "observation-two",
          state: "needs_attention" as const,
        },
      ],
    };
    const ledger = ledgerFromProgressiveBriefing(two, {
      generatedAtLabel: "26 Jul, 09:00",
      scopeLabel: "Personal",
      allowedAppOrigin: APP_ORIGIN,
      evidenceHref: (id) => `/app/signal?evidence=${id}`,
    });

    assert.equal(ledger.heading, "Two things genuinely need you.");
    assert.doesNotMatch(ledger.heading, /\d/);
    assert.equal(
      ledger.closingLine,
      "That’s the read. Dates came first, then the quiet ones.",
    );
  });

  it("withholds the accounting when no provider reported a record count", () => {
    const ledger = ledgerFromProgressiveBriefing(progressiveBriefing(), {
      generatedAtLabel: "26 Jul, 09:00",
      scopeLabel: "Personal",
      allowedAppOrigin: APP_ORIGIN,
      evidenceHref: (id) => `/app/signal?evidence=${id}`,
    });

    assert.equal(ledger.readCounts, null);
  });

  it("sums the provider record counts on a complete read", () => {
    const response = progressiveBriefing();
    const ledger = ledgerFromProgressiveBriefing(
      {
        ...response,
        meta: {
          ...response.meta,
          coverage: {
            ...response.meta.coverage,
            providers: {
              tasks: providerCoverage("tasks", 31),
              timeline: providerCoverage("timeline", 10),
            },
          },
        },
      },
      {
        generatedAtLabel: "26 Jul, 09:00",
        scopeLabel: "Personal",
        allowedAppOrigin: APP_ORIGIN,
        evidenceHref: (id) => `/app/signal?evidence=${id}`,
      },
    );

    assert.equal(ledger.readCounts?.read, 41);
    // Counted in items, not rows: this row stands for two source records.
    assert.equal(ledger.readCounts?.shown, 2);
    // The progressive engine caps its observations and passes no pre-cap
    // total, so the raw candidate count (1) would have published a state the
    // contract calls impossible: two items shown out of one flagged. Anything
    // on screen demonstrably crossed a rule, so `shown` floors `flagged`.
    assert.equal(ledger.readCounts?.flagged, 2);
    assert.ok(
      ledger.readCounts!.shown <= ledger.readCounts!.flagged,
      "shown must never exceed flagged",
    );
    assert.equal(
      ledger.readCounts!.flagged + ledger.readCounts!.cleared,
      ledger.readCounts!.read,
      "read must equal flagged + cleared",
    );
  });

  it("drops the updated segment rather than composing a placeholder", () => {
    const response = progressiveBriefing();
    const ledger = ledgerFromProgressiveBriefing(
      {
        ...response,
        observations: [
          { ...response.observations[0]!, updatedAt: "not-an-instant" },
        ],
      },
      {
        generatedAtLabel: "26 Jul, 09:00",
        scopeLabel: "Personal",
        allowedAppOrigin: APP_ORIGIN,
        evidenceHref: (id) => `/app/signal?evidence=${id}`,
      },
    );

    assert.equal(ledger.entries[0]?.receipt.updatedAtLabel, null);
  });

  it("never offers to send the reader to the page they are on", () => {
    const response = progressiveBriefing();
    const ledger = ledgerFromProgressiveBriefing(
      {
        ...response,
        observations: [
          {
            ...response.observations[0]!,
            actions: [],
            sourceCounts: { notes: 0, tasks: 0, milestones: 0 },
          },
        ],
      },
      {
        generatedAtLabel: "26 Jul, 09:00",
        scopeLabel: "Personal",
        allowedAppOrigin: APP_ORIGIN,
        evidenceHref: (id) => `/app/signal?evidence=${id}`,
      },
    );

    assert.deepEqual(ledger.entries[0]?.primaryAction, {
      label: "Open Signal",
      href: "/app/signal",
    });
  });
});

function providerCoverage(
  provider: "tasks" | "timeline",
  sourceRecordCount: number,
) {
  return {
    provider,
    status: "ready" as const,
    capabilities: [],
    historyStartAt: null,
    historyEndAt: null,
    calculatedAt: "2026-07-26T08:00:00.000Z",
    staleAfter: null,
    sourceRecordCount,
    issues: [],
  };
}

function progressiveBriefing(): BriefingResponse {
  const start = "2026-05-03T00:00:00.000Z";
  const end = "2026-07-26T00:00:00.000Z";
  const calculatedAt = "2026-07-26T08:00:00.000Z";

  return {
    observations: [
      {
        id: "observation-one",
        type: "stalled_work",
        issueKey: "tasks:stalled",
        title: "Two active items have been waiting without progress.",
        summary: "Both items have been open without a meaningful update.",
        whyItMatters: "Long-waiting work can mean the next action is unclear.",
        state: "watch",
        confidence: 0.9,
        scope: {
          type: "workspace",
          id: "workspace-private-one",
          workspaceId: "workspace-private-one",
        },
        period: {
          start,
          end,
          timezone: "Europe/Dublin",
          preset: "twelve_weeks",
        },
        metric: {
          key: "stalled_work",
          value: 2,
          previousValue: 1,
          delta: 1,
          unit: "items",
          comparisonBasis: "previous equal period",
        },
        reasons: ["Two source records crossed the stalled-work threshold."],
        evidenceCount: 2,
        sourceCounts: { notes: 0, tasks: 2, milestones: 0 },
        sources: [
          {
            type: "task",
            id: "raw-task-private-one",
            title: "Private task title",
            ownerIds: [],
            state: "in_progress",
            date: null,
            projectIds: ["project-private-one"],
            deepLink:
              "https://app.signalstudio.ie/app/tasks?task=raw-task-private-one",
            reason: "Source record crossed the reviewed threshold.",
          },
        ],
        actions: [
          {
            id: "review-stalled",
            label: "Review waiting work",
            href:
              "https://app.signalstudio.ie/app/tasks?task=raw-task-private-one",
            primary: true,
          },
        ],
        updatedAt: calculatedAt,
        ruleVersion: "signal-rules-v1",
      },
    ],
    emptyState: null,
    meta: {
      scope: {
        type: "workspace",
        id: "workspace-private-one",
        workspaceId: "workspace-private-one",
      },
      period: {
        start,
        end,
        timezone: "Europe/Dublin",
        preset: "twelve_weeks",
      },
      calculatedAt,
      coverage: {
        status: "complete",
        providers: {},
        calculatedAt,
      },
      freshness: "fresh",
      ruleVersion: "signal-rules-v1",
    },
  };
}
