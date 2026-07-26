/**
 * Per-user briefing orchestrator — ported from
 * signal/src/server/briefing/build-for-user.ts.
 *
 * S8: this is a PORTED COPY; the old deployment retains its own for cron.
 * Until cron migrates, briefing-logic changes must be applied in both places.
 * See RISK_REGISTER: phase6-build-for-user-divergence.
 *
 * DB client: signalAnalyticsDb (SIGNAL_ANALYTICS_* vars).
 * Demo guard: preserves DEMO_BRIEFING_NOW pinned synthetic clock.
 */

import { eq } from "drizzle-orm";
import { signalAnalyticsDb as db } from "../db/signal-analytics-client";
import { analyticsUsers } from "../db/signal-analytics-schema";
import type { Cadence } from "../../lib/db/signal-prefs-schema";
import { dataSource } from "../../lib/data/source";
import { buildBriefing } from "../../lib/briefing/build";
import type { Briefing } from "../../lib/briefing/types";
import type { BriefingSource } from "../../lib/briefing/source";
import type { TriggerId } from "../../lib/triggers/types";
import { bumpRotations } from "./signal-rotation";
import {
  getDismissedKeys,
  getSurfacedAges,
  recordSurfaced,
} from "./signal-read-state";
import { getBriefingEmptyCopy } from "../../lib/onboarding/personalization";
import { isDemoMode } from "@/lib/access-mode";
import {
  createMockBriefingSource,
  mockPlanningPeriodBriefingSource,
} from "../../lib/briefing/mock-source";
import {
  authorizeSignalScope,
  listPlanningCatalogForUser,
  planningPeriodsEnabled,
  type AuthorizedSignalScope,
  type PlanningCatalog,
  type SignalScope,
} from "../../lib/planning-periods/scope";
import {
  calendarDayDifference,
  dateOnlyToTimestamp,
} from "../../lib/briefing/calendar-time";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";

export type BriefingForUserResult =
  | {
      kind: "ok";
      briefing: Briefing;
      authorizedScope: AuthorizedSignalScope;
      catalog: PlanningCatalog;
    }
  | { kind: "no-workspace" };

/**
 * Fixed synthetic clock for deterministic demo/review screenshots and audits.
 * 07:42 UTC is 08:42 in Europe/London on 15 July 2026.
 */
export const DEMO_BRIEFING_NOW = Date.UTC(2026, 6, 15, 7, 42);

export async function buildBriefingForUser(opts: {
  clerkId: string;
  cadence: Cadence;
  scope?: SignalScope;
}): Promise<BriefingForUserResult> {
  const { clerkId } = opts;

  // Demo/Review: build a real briefing from the shared suite fixture through
  // the pure buildBriefing engine. No DB touch.
  if (isDemoMode()) {
    const periodScopeEnabled = planningPeriodsEnabled();
    const planningCatalog: PlanningCatalog = {
      periods: [
        {
          id: "period_demo_school",
          name: "2026–27 School year",
          contextType: "school_year",
          startDate: "2026-09-01",
          endDate: "2027-06-30",
          timezone: "Europe/Dublin",
        },
      ],
      workspaces: [
        {
          id: "ws_demo_geography",
          name: "6th Year Geography",
          role: "owner",
          planningPeriodId: "period_demo_school",
          contextType: "class",
          primaryDate: "2027-06-09",
          primaryDateLabel: "State examinations",
        },
        {
          id: "ws_demo_history",
          name: "5th Year History",
          role: "owner",
          planningPeriodId: "period_demo_school",
          contextType: "class",
          primaryDate: "2027-06-09",
          primaryDateLabel: "State examinations",
        },
        {
          id: "ws_demo_politics",
          name: "Leaving Cert Politics",
          role: "owner",
          planningPeriodId: "period_demo_school",
          contextType: "class",
          primaryDate: "2027-06-09",
          primaryDateLabel: "State examinations",
        },
      ],
      planningSchemaAvailable: true,
    };
    const workspaceCatalog: PlanningCatalog = {
      periods: [],
      workspaces: [
        {
          id: REVIEW_SUITE_FIXTURE.workspace.id,
          name: REVIEW_SUITE_FIXTURE.workspace.name,
          role: "owner",
          planningPeriodId: null,
          contextType: "wedding",
          primaryDate: REVIEW_SUITE_FIXTURE.primaryDate.date,
          primaryDateLabel: REVIEW_SUITE_FIXTURE.primaryDate.label,
        },
      ],
      planningSchemaAvailable: false,
    };
    const catalog = periodScopeEnabled ? planningCatalog : workspaceCatalog;
    const defaultScope: SignalScope = periodScopeEnabled
      ? {
          kind: "planningPeriod",
          planningPeriodId: "period_demo_school",
        }
      : {
          kind: "workspace",
          workspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
        };
    const requestedScope =
      opts.scope?.kind === "workspace" || periodScopeEnabled
        ? opts.scope
        : undefined;
    const authorizedScope =
      authorizeSignalScope(
        catalog,
        requestedScope ?? defaultScope,
        "Europe/Dublin",
      ) ??
      authorizeSignalScope(
        catalog,
        defaultScope,
        "Europe/Dublin",
      );
    if (!authorizedScope) return { kind: "no-workspace" };
    const demoSource: BriefingSource = periodScopeEnabled
      ? {
          getSignalsForUser: async (context) => {
            const signals =
              await mockPlanningPeriodBriefingSource.getSignalsForUser(
                context,
              );
            return authorizedScope.scope.kind === "workspace"
              ? signals.filter((signal) =>
                  signal.sourceLabel?.endsWith(authorizedScope.label),
                )
              : signals;
          },
        }
      : createMockBriefingSource({
          now: DEMO_BRIEFING_NOW,
          workspaceId: REVIEW_SUITE_FIXTURE.workspace.id,
          sourceLabel: `Tasks · ${REVIEW_SUITE_FIXTURE.workspace.name} · Mara & Finn`,
        });
    const briefing = await buildBriefing(
      demoSource,
      { userId: clerkId || "demo-user", email: "" },
      DEMO_BRIEFING_NOW,
    );
    const emptyCopy = getBriefingEmptyCopy({
      primaryUseCase: periodScopeEnabled ? "student" : "venue",
    });
    return {
      kind: "ok",
      briefing: {
        ...briefing,
        emptyStateHeadline: emptyCopy.headline,
        emptyStateBody: emptyCopy.body,
      },
      authorizedScope,
      catalog,
    };
  }

  const rows = await db
    .select({
      workspaceId: analyticsUsers.linkedWorkspaceId,
      scopeKind: analyticsUsers.scopeKind,
      planningPeriodId: analyticsUsers.planningPeriodId,
      timezone: analyticsUsers.timezone,
    })
    .from(analyticsUsers)
    .where(eq(analyticsUsers.clerkId, clerkId))
    .limit(1);

  const prefs = rows[0];
  const persistedScope: SignalScope | null =
    prefs?.scopeKind === "planningPeriod" && prefs.planningPeriodId
      ? { kind: "planningPeriod", planningPeriodId: prefs.planningPeriodId }
      : prefs?.workspaceId
        ? { kind: "workspace", workspaceId: prefs.workspaceId }
        : null;
  const requestedScope = planningPeriodsEnabled()
    ? opts.scope ?? persistedScope
    : opts.scope?.kind === "workspace"
      ? opts.scope
      : prefs?.workspaceId
        ? { kind: "workspace" as const, workspaceId: prefs.workspaceId }
        : null;
  if (!requestedScope) return { kind: "no-workspace" };

  const catalog = await listPlanningCatalogForUser({
    clerkId,
    email: null,
  });
  let authorizedScope = authorizeSignalScope(
    catalog,
    requestedScope,
    prefs?.timezone ?? "UTC",
  );
  if (!authorizedScope && opts.scope && persistedScope) {
    authorizedScope = authorizeSignalScope(
      catalog,
      persistedScope,
      prefs?.timezone ?? "UTC",
    );
  }
  if (!authorizedScope) return { kind: "no-workspace" };

  const workspaceIds = authorizedScope.workspaces.map((w) => w.id);
  const workspaceNames = new Map(
    authorizedScope.workspaces.map((w) => [w.id, w.name]),
  );
  const now = Date.now();

  const onboarding =
    (await dataSource.getWorkspaceOnboarding?.(workspaceIds[0]!)) ?? null;
  const emptyCopy = getBriefingEmptyCopy({
    primaryUseCase:
      authorizedScope.period?.contextType === "wedding"
        ? "wedding"
        : authorizedScope.period?.contextType === "school_year" ||
            authorizedScope.period?.contextType === "semester"
          ? "student"
          : onboarding?.primaryUseCase,
  });

  const source: BriefingSource = {
    getSignalsForUser: async () => {
      const workspaces = dataSource.readMany
        ? await dataSource.readMany(workspaceIds)
        : await Promise.all(
            workspaceIds.map((wid) => dataSource.read(wid)),
          );
      return workspaces.flatMap((work) =>
        work.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          lane: ((): import("../../lib/briefing/types").Lane => {
            if (t.status === "shipped") return "shipped";
            if (t.status === "in-flight") return "in-flight";
            if (t.status === "blocked") return "in-flight";
            if (t.status === "next") return "next";
            return "next";
          })(),
          priority: 2 as const,
          dueAt: t.dueDate ? dateOnlyToTimestamp(t.dueDate) : null,
          idleDays: (() => {
            const last = new Date(t.lastActivityAt).getTime();
            return Math.max(
              0,
              calendarDayDifference(now, last, authorizedScope!.timezone),
            );
          })(),
          commentCount: 0,
          blockedBy: t.blockedBy,
          sourceLabel: `Tasks · ${workspaceNames.get(work.workspaceId) ?? "Workspace"}`,
          movedToShippedAt:
            t.status === "shipped"
              ? new Date(t.lastStatusChangeAt).getTime()
              : null,
          workspaceId: work.workspaceId,
          planningPeriodId: authorizedScope!.period?.id ?? null,
        })),
      );
    },
  };

  const [suppressed, ages] = await Promise.all([
    getDismissedKeys(clerkId),
    getSurfacedAges(clerkId, now),
  ]);

  const briefing = await buildBriefing(
    source,
    { userId: clerkId, email: "" },
    now,
    { suppressed, ages, timezone: authorizedScope.timezone },
  );

  const fired = new Set<TriggerId>();
  const allItems = [
    ...briefing.needsAttention,
    ...briefing.movingWell,
    ...briefing.quietRisks,
  ];
  for (const item of allItems) {
    fired.add(item.trigger as unknown as TriggerId);
  }
  await bumpRotations(clerkId, Array.from(fired));

  await recordSurfaced(
    clerkId,
    [...briefing.needsAttention, ...briefing.quietRisks].map((item) => ({
      itemKey: item.id,
      triggerId: item.trigger,
    })),
    now,
  );

  return {
    kind: "ok",
    briefing: {
      ...briefing,
      emptyStateHeadline: emptyCopy.headline,
      emptyStateBody: emptyCopy.body,
    },
    authorizedScope,
    catalog,
  };
}
