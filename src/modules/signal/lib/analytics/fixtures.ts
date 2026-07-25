import type {
  AnalyticsEvent,
  AnalyticsQuery,
  AnalyticsSnapshot,
  MilestoneRecord,
  NoteRecord,
  ProjectRecord,
  ProviderCapability,
  ProviderCoverage,
  ProviderKey,
  TaskRecord,
} from "./contracts";
import { resolvePeriod } from "./time";
import { PRODUCT_APP_URLS } from "@/lib/product-urls";

// This module is pure and has no persistence hooks. Importing it can never seed a database.
// Production services must not select fixtures; the demo/development boundary owns that choice.

export const FIXTURE_NOW = "2026-07-13T09:00:00.000Z";
export const FIXTURE_TIMEZONE = "Europe/London";
export const FIXTURE_WORKSPACE_ID = "ws-signal-fixture";

export type AnalyticsFixtureScenario =
  | "signature"
  | "healthy"
  | "insufficient_history"
  | "empty"
  | "stale"
  | "provider_failure"
  | "large_evidence"
  | "unauthorized";

export interface FixtureAccess {
  userId: string;
  authorized: boolean;
  allowedWorkspaceIds: string[];
  allowedProjectIds: string[];
  deniedProjectIds: string[];
}

export interface AnalyticsFixture {
  scenario: AnalyticsFixtureScenario;
  query: AnalyticsQuery;
  snapshot: AnalyticsSnapshot;
  access: FixtureAccess;
}

const ALL_CAPABILITIES: Record<ProviderKey, ProviderCapability[]> = {
  tasks: [
    "task_read",
    "task_completion_timestamps",
    "task_status_history",
    "task_meaningful_activity",
    "task_dependencies",
    "task_owners",
    "cross_product_links",
  ],
  notes: ["decision_read", "follow_up_read", "cross_product_links"],
  timeline: ["milestone_read", "milestone_date_history", "cross_product_links"],
  projects: ["project_read"],
};

function coverage(
  provider: ProviderKey,
  sourceRecordCount: number,
  overrides: Partial<ProviderCoverage> = {},
): ProviderCoverage {
  return {
    provider,
    status: "ready",
    capabilities: ALL_CAPABILITIES[provider],
    historyStartAt: "2025-01-01T00:00:00.000Z",
    historyEndAt: FIXTURE_NOW,
    calculatedAt: FIXTURE_NOW,
    staleAfter: "2026-07-13T09:15:00.000Z",
    sourceRecordCount,
    issues: [],
    ...overrides,
  };
}

function query(scope: AnalyticsQuery["scope"] = {
  type: "workspace",
  id: FIXTURE_WORKSPACE_ID,
  workspaceId: FIXTURE_WORKSPACE_ID,
}): AnalyticsQuery {
  return {
    scope,
    period: resolvePeriod("four_weeks", FIXTURE_NOW, FIXTURE_TIMEZONE),
    filters: {},
    metric: "work_completed",
    breakdown: "project",
    pagination: { page: 1, perPage: 25 },
  };
}

function project(
  id: string,
  name: string,
  ownerIds: string[] = ["user-owner"],
): ProjectRecord {
  return {
    id,
    workspaceId: FIXTURE_WORKSPACE_ID,
    name,
    ownerIds,
    state: "unknown",
    deepLink: `${PRODUCT_APP_URLS.timeline}/${id}?workspaceId=${FIXTURE_WORKSPACE_ID}`,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: FIXTURE_NOW,
  };
}

function task(
  id: string,
  overrides: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    id,
    workspaceId: FIXTURE_WORKSPACE_ID,
    projectIds: ["launch"],
    title: `Work ${id}`,
    status: "in-flight",
    terminal: false,
    ownerIds: ["user-owner"],
    owners: [{ id: "user-owner", displayName: "Ethan" }],
    due: null,
    createdAt: "2026-07-01T09:00:00.000Z",
    completedAt: null,
    lastMeaningfulActivityAt: "2026-07-12T09:00:00.000Z",
    blocking: {
      explicit: false,
      dependencyIds: [],
      unresolvedDependencyIds: [],
    },
    linkedDecisionIds: [],
    linkedMilestoneIds: [],
    workType: "task",
    deepLink: `/app/board?task=${id}`,
    updatedAt: "2026-07-12T09:00:00.000Z",
    ...overrides,
  };
}

function completedTask(id: string, completedAt: string): TaskRecord {
  return task(id, {
    title: `Completed work ${id}`,
    status: "shipped",
    terminal: true,
    completedAt,
    lastMeaningfulActivityAt: completedAt,
    updatedAt: completedAt,
  });
}

function completedEvent(taskRecord: TaskRecord): AnalyticsEvent {
  return {
    id: `event-completed-${taskRecord.id}`,
    workspaceId: FIXTURE_WORKSPACE_ID,
    projectIds: taskRecord.projectIds,
    entityType: "task",
    entityId: taskRecord.id,
    kind: "status_changed",
    at: taskRecord.completedAt!,
    meaningful: true,
    terminalTransition: true,
    fromValue: "in-flight",
    toValue: "shipped",
  };
}

function decision(id: string, title: string): NoteRecord {
  return {
    id,
    workspaceId: FIXTURE_WORKSPACE_ID,
    projectIds: ["launch"],
    kind: "decision",
    title,
    state: "open",
    ownerIds: ["client-contact"],
    due: { kind: "date", value: "2026-07-14" },
    createdAt: "2026-07-06T09:00:00.000Z",
    updatedAt: "2026-07-12T11:00:00.000Z",
    completedAt: null,
    linkedTaskIds: [],
    linkedMilestoneIds: ["milestone-friday"],
    deepLink: `${PRODUCT_APP_URLS.notes}?note=${id}`,
    exposure: "approved_extract",
  };
}

function signatureFixture(): AnalyticsFixture {
  const projects = [
    project("launch", "Launch"),
    project("venue", "Venue rollout"),
    project("private-client", "Private client", ["user-owner", "user-private"]),
  ];
  const decisions = [
    decision("decision-copy", "Approve final launch copy"),
    decision("decision-date", "Confirm client launch date"),
  ];

  const blocked = Array.from({ length: 4 }, (_, index) => {
    const id = `blocked-${index + 1}`;
    const decisionId = decisions[index % decisions.length].id;
    return task(id, {
      title: [
        "Prepare launch announcement",
        "Schedule release sequence",
        "Complete client handover",
        "Publish launch page",
      ][index],
      due: { kind: "date", value: `2026-07-${String(8 + index).padStart(2, "0")}` },
      createdAt: "2026-06-20T09:00:00.000Z",
      lastMeaningfulActivityAt: "2026-07-07T09:00:00.000Z",
      status: "blocked",
      blocking: {
        explicit: true,
        dependencyIds: [decisionId],
        unresolvedDependencyIds: [decisionId],
      },
      linkedDecisionIds: [decisionId],
      linkedMilestoneIds: ["milestone-friday"],
    });
  });
  const overdue = task("overdue-5", {
    title: "Confirm final asset list",
    due: { kind: "date", value: "2026-07-10" },
    createdAt: "2026-06-22T09:00:00.000Z",
    lastMeaningfulActivityAt: "2026-07-12T09:00:00.000Z",
  });
  const unowned = task("unowned-1", {
    title: "Collect launch screenshots",
    projectIds: ["venue"],
    ownerIds: [],
    owners: [],
    due: { kind: "date", value: "2026-07-20" },
  });
  const normal = [
    task("normal-1", { title: "Review accessibility notes", projectIds: ["venue"] }),
    task("normal-2", { title: "Confirm support coverage", projectIds: ["private-client"] }),
  ];

  // Four current completions against prior comparable counts of 8, 7 and 9.
  const completionDates = [
    "2026-06-20T10:00:00.000Z",
    "2026-06-26T10:00:00.000Z",
    "2026-07-04T10:00:00.000Z",
    "2026-07-10T10:00:00.000Z",
    ...Array.from({ length: 8 }, (_, index) =>
      new Date(Date.parse("2026-05-20T10:00:00.000Z") + index * 2 * 86_400_000).toISOString(),
    ),
    ...Array.from({ length: 7 }, (_, index) =>
      new Date(Date.parse("2026-04-22T10:00:00.000Z") + index * 2 * 86_400_000).toISOString(),
    ),
    ...Array.from({ length: 9 }, (_, index) =>
      new Date(Date.parse("2026-03-25T10:00:00.000Z") + index * 2 * 86_400_000).toISOString(),
    ),
  ];
  const completed = completionDates.map((date, index) =>
    completedTask(`completed-${index + 1}`, date),
  );

  const milestone: MilestoneRecord = {
    id: "milestone-friday",
    workspaceId: FIXTURE_WORKSPACE_ID,
    projectId: "launch",
    title: "Friday delivery",
    state: "upcoming",
    currentDate: { kind: "date", value: "2026-07-17" },
    dateChanges: [
      {
        from: { kind: "date", value: "2026-07-15" },
        to: { kind: "date", value: "2026-07-16" },
        changedAt: "2026-07-08T12:00:00.000Z",
      },
      {
        from: { kind: "date", value: "2026-07-16" },
        to: { kind: "date", value: "2026-07-17" },
        changedAt: "2026-07-11T12:00:00.000Z",
      },
    ],
    dependencyIds: blocked.map((record) => record.id),
    unresolvedDependencyIds: blocked.map((record) => record.id),
    linkedTaskIds: blocked.map((record) => record.id),
    linkedDecisionIds: decisions.map((record) => record.id),
    ownerIds: ["user-owner"],
    deepLink: `${PRODUCT_APP_URLS.timeline}/launch?workspaceId=${FIXTURE_WORKSPACE_ID}&milestone=milestone-friday`,
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-07-11T12:00:00.000Z",
  };
  const tasks = [...blocked, overdue, unowned, ...normal, ...completed];
  const events = [
    ...completed.map(completedEvent),
    ...milestone.dateChanges.map<AnalyticsEvent>((change, index) => ({
      id: `event-date-${index + 1}`,
      workspaceId: FIXTURE_WORKSPACE_ID,
      projectIds: ["launch"],
      entityType: "milestone",
      entityId: milestone.id,
      kind: "date_changed",
      at: change.changedAt,
      meaningful: true,
      fromValue: change.from.value,
      toValue: change.to.value,
    })),
  ];
  const snapshot: AnalyticsSnapshot = {
    scope: query().scope,
    capturedAt: FIXTURE_NOW,
    projects,
    tasks,
    notes: decisions,
    milestones: [milestone],
    events,
    coverage: {
      status: "complete",
      providers: {
        tasks: coverage("tasks", tasks.length),
        notes: coverage("notes", decisions.length),
        timeline: coverage("timeline", 1),
        projects: coverage("projects", projects.length),
      },
      calculatedAt: FIXTURE_NOW,
    },
  };
  return {
    scenario: "signature",
    query: query(),
    snapshot,
    access: {
      userId: "user-owner",
      authorized: true,
      allowedWorkspaceIds: [FIXTURE_WORKSPACE_ID],
      allowedProjectIds: ["launch", "venue", "private-client"],
      deniedProjectIds: [],
    },
  };
}

function healthyFixture(): AnalyticsFixture {
  const base = signatureFixture();
  const currentAndHistory = [
    "2026-06-20T10:00:00.000Z",
    "2026-06-27T10:00:00.000Z",
    "2026-07-04T10:00:00.000Z",
    "2026-07-11T10:00:00.000Z",
    "2026-05-20T10:00:00.000Z",
    "2026-05-27T10:00:00.000Z",
    "2026-06-03T10:00:00.000Z",
    "2026-06-10T10:00:00.000Z",
    "2026-04-22T10:00:00.000Z",
    "2026-04-29T10:00:00.000Z",
    "2026-05-06T10:00:00.000Z",
    "2026-05-13T10:00:00.000Z",
    "2026-03-25T10:00:00.000Z",
    "2026-04-01T10:00:00.000Z",
    "2026-04-08T10:00:00.000Z",
    "2026-04-15T10:00:00.000Z",
  ].map((date, index) => completedTask(`healthy-completed-${index}`, date));
  const active = [
    task("healthy-active", {
      title: "Prepare next review",
      due: { kind: "date", value: "2026-07-28" },
      createdAt: "2026-07-10T09:00:00.000Z",
      lastMeaningfulActivityAt: "2026-07-13T08:00:00.000Z",
    }),
  ];
  const milestone: MilestoneRecord = {
    ...base.snapshot.milestones[0],
    id: "healthy-milestone",
    title: "August review",
    currentDate: { kind: "date", value: "2026-08-05" },
    dateChanges: [],
    dependencyIds: [],
    unresolvedDependencyIds: [],
    linkedTaskIds: [],
    linkedDecisionIds: [],
  };
  const tasks = [...active, ...currentAndHistory];
  return {
    ...base,
    scenario: "healthy",
    snapshot: {
      ...base.snapshot,
      tasks,
      notes: [],
      milestones: [milestone],
      events: currentAndHistory.map(completedEvent),
      coverage: {
        ...base.snapshot.coverage,
        providers: {
          tasks: coverage("tasks", tasks.length),
          notes: coverage("notes", 0),
          timeline: coverage("timeline", 1),
          projects: coverage("projects", base.snapshot.projects.length),
        },
      },
    },
  };
}

function insufficientHistoryFixture(): AnalyticsFixture {
  const base = healthyFixture();
  const tasksCoverage = base.snapshot.coverage.providers.tasks!;
  return {
    ...base,
    scenario: "insufficient_history",
    snapshot: {
      ...base.snapshot,
      coverage: {
        ...base.snapshot.coverage,
        status: "partial",
        providers: {
          ...base.snapshot.coverage.providers,
          tasks: {
            ...tasksCoverage,
            status: "partial",
            historyStartAt: "2026-07-06T09:00:00.000Z",
            issues: ["Only one complete weekly period has trustworthy history."],
          },
        },
      },
    },
  };
}

function emptyFixture(): AnalyticsFixture {
  const base = healthyFixture();
  return {
    ...base,
    scenario: "empty",
    snapshot: {
      ...base.snapshot,
      projects: [],
      tasks: [],
      notes: [],
      milestones: [],
      events: [],
      coverage: {
        ...base.snapshot.coverage,
        providers: {
          tasks: coverage("tasks", 0),
          notes: coverage("notes", 0),
          timeline: coverage("timeline", 0),
          projects: coverage("projects", 0),
        },
      },
    },
  };
}

function staleFixture(): AnalyticsFixture {
  const base = healthyFixture();
  const providers = Object.fromEntries(
    Object.entries(base.snapshot.coverage.providers).map(([key, value]) => [
      key,
      value
        ? {
            ...value,
            status: "stale" as const,
            calculatedAt: "2026-07-12T09:00:00.000Z",
            staleAfter: "2026-07-12T09:15:00.000Z",
            issues: ["Last successful refresh is outside the freshness window."],
          }
        : value,
    ]),
  );
  return {
    ...base,
    scenario: "stale",
    snapshot: {
      ...base.snapshot,
      coverage: {
        ...base.snapshot.coverage,
        status: "stale",
        calculatedAt: "2026-07-12T09:00:00.000Z",
        providers,
      },
    },
  };
}

function providerFailureFixture(): AnalyticsFixture {
  const base = emptyFixture();
  return {
    ...base,
    scenario: "provider_failure",
    snapshot: {
      ...base.snapshot,
      coverage: {
        ...base.snapshot.coverage,
        status: "partial",
        providers: {
          ...base.snapshot.coverage.providers,
          tasks: coverage("tasks", 0, {
            status: "unavailable",
            capabilities: [],
            historyStartAt: null,
            historyEndAt: null,
            issues: ["tasks_provider_unavailable"],
          }),
          projects: coverage("projects", 0, {
            status: "unavailable",
            capabilities: [],
            historyStartAt: null,
            historyEndAt: null,
            issues: ["projects_provider_unavailable"],
          }),
        },
      },
    },
  };
}

function largeEvidenceFixture(): AnalyticsFixture {
  const base = emptyFixture();
  const tasks = Array.from({ length: 150 }, (_, index) =>
    task(`large-unowned-${index + 1}`, {
      title: `Unowned fixture work ${index + 1}`,
      ownerIds: [],
      owners: [],
      projectIds: ["launch"],
      createdAt: "2026-07-12T09:00:00.000Z",
      lastMeaningfulActivityAt: "2026-07-13T08:00:00.000Z",
      updatedAt: "2026-07-13T08:00:00.000Z",
    }),
  );
  const projects = [project("launch", "Launch")];
  return {
    ...base,
    scenario: "large_evidence",
    snapshot: {
      ...base.snapshot,
      projects,
      tasks,
      coverage: {
        ...base.snapshot.coverage,
        providers: {
          ...base.snapshot.coverage.providers,
          tasks: coverage("tasks", tasks.length),
          projects: coverage("projects", projects.length),
        },
      },
    },
    access: {
      ...base.access,
      allowedProjectIds: ["launch"],
    },
  };
}

function unauthorizedFixture(): AnalyticsFixture {
  const base = emptyFixture();
  const unauthorizedScope = {
    type: "project" as const,
    id: "private-client",
    workspaceId: FIXTURE_WORKSPACE_ID,
  };
  return {
    ...base,
    scenario: "unauthorized",
    query: query(unauthorizedScope),
    snapshot: { ...base.snapshot, scope: unauthorizedScope },
    access: {
      userId: "user-restricted",
      authorized: false,
      allowedWorkspaceIds: [FIXTURE_WORKSPACE_ID],
      allowedProjectIds: ["launch", "venue"],
      deniedProjectIds: ["private-client"],
    },
  };
}

export const ANALYTICS_FIXTURE_SCENARIOS: readonly AnalyticsFixtureScenario[] = [
  "signature",
  "healthy",
  "insufficient_history",
  "empty",
  "stale",
  "provider_failure",
  "large_evidence",
  "unauthorized",
];

export function getAnalyticsFixture(
  scenario: AnalyticsFixtureScenario,
): AnalyticsFixture {
  switch (scenario) {
    case "signature":
      return signatureFixture();
    case "healthy":
      return healthyFixture();
    case "insufficient_history":
      return insufficientHistoryFixture();
    case "empty":
      return emptyFixture();
    case "stale":
      return staleFixture();
    case "provider_failure":
      return providerFailureFixture();
    case "large_evidence":
      return largeEvidenceFixture();
    case "unauthorized":
      return unauthorizedFixture();
  }
}
