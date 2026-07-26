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
    text: "Wedding invites haven't moved in 9 days",
    sourceLabel: "Tasks · Personal",
    trigger: "stuck-work",
    reasons: ["No status update in 9 days."],
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
    assert.equal(ledger.entries[0]?.text, "Wedding invites haven't moved in 9 days");
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
});

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
