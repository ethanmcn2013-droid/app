import "server-only";

import type {
  AnalyticsDate,
  AnalyticsEvent,
  AnalyticsQuery,
  MilestoneDateChange,
  MilestoneRecord,
  TimelineDependencyRecord,
  TimelineProvider,
  TimelineProviderResult,
} from "../../../lib/analytics/contracts";
import { TIMELINE_URL } from "@/lib/product-urls";
import {
  timelineDependencyResolved,
  unresolvedTimelineDependencyIds,
} from "../../../lib/analytics/timeline-dependencies";
import { providerCoverage } from "./coverage";
import { getTimelineClient } from "./optional-clients";

const MAX_PROJECTS = 100;
const MAX_MILESTONES = 1_000;
const MAX_EVENTS = 3_000;
const MAX_DEPENDENCIES = 1_000;

export class TimelineAnalyticsProvider implements TimelineProvider {
  async read(query: AnalyticsQuery, signal?: AbortSignal): Promise<TimelineProviderResult> {
    const calculatedAt = new Date().toISOString();
    const client = getTimelineClient();
    if (!client) {
      return {
        milestones: [],
        dependencies: [],
        events: [],
        coverage: providerCoverage({
          provider: "timeline",
          status: "unavailable",
          calculatedAt,
          issues: ["timeline_provider_not_configured"],
        }),
      };
    }

    const projectsResult = await client.execute({
      sql: `SELECT workspace_slug, slug, name
            FROM projects
            WHERE source_tasks_workspace_id = ?
            ORDER BY sort_order, slug
            LIMIT ?`,
      args: [query.scope.workspaceId, MAX_PROJECTS + 1],
    });
    signal?.throwIfAborted();
    const projects = projectsResult.rows.slice(0, MAX_PROJECTS).flatMap((row) => {
      const workspaceSlug = textValue(row.workspace_slug);
      const projectSlug = textValue(row.slug);
      return workspaceSlug && projectSlug ? [{ workspaceSlug, projectSlug }] : [];
    }).filter((project) => query.scope.type !== "project" || project.projectSlug === query.scope.id);

    if (!projects.length) {
      return {
        milestones: [],
        dependencies: [],
        events: [],
        coverage: providerCoverage({
          provider: "timeline",
          status: "partial",
          capabilities: ["milestone_read", "cross_product_links"],
          calculatedAt,
          issues: ["no_timeline_project_mapped_to_tasks_workspace"],
        }),
      };
    }

    const pairPredicate = projects.map(() => "(workspace_slug = ? AND project_slug = ?)").join(" OR ");
    const pairArgs = projects.flatMap((project) => [project.workspaceSlug, project.projectSlug]);
    const rowsResult = await client.execute({
      sql: `SELECT id, workspace_slug, project_slug, title, status, target_date,
                   blocker_id, assignee, created_at, updated_at, completed_at
            FROM tasks
            WHERE kind = 'milestone' AND (${pairPredicate})
            ORDER BY updated_at DESC
            LIMIT ?`,
      args: [...pairArgs, MAX_MILESTONES + 1],
    });
    signal?.throwIfAborted();

    const rawMilestones = rowsResult.rows
      .slice(0, MAX_MILESTONES)
      .filter((row) => query.scope.type !== "user" || textValue(row.assignee) === query.scope.id);
    const ids = rawMilestones.map((row) => textValue(row.id)).filter((id): id is string => Boolean(id));
    const blockerIds = Array.from(new Set(
      rawMilestones
        .map((row) => textValue(row.blocker_id))
        .filter((id): id is string => Boolean(id)),
    ));
    const blockedMilestonesByDependency = new Map<string, string[]>();
    for (const row of rawMilestones) {
      const milestoneId = textValue(row.id);
      const blockerId = textValue(row.blocker_id);
      if (!milestoneId || !blockerId) continue;
      const bucket = blockedMilestonesByDependency.get(blockerId);
      if (bucket) bucket.push(milestoneId);
      else blockedMilestonesByDependency.set(blockerId, [milestoneId]);
    }
    const dependenciesResult = blockerIds.length
      ? await client.execute({
          sql: `SELECT id, workspace_slug, project_slug, title, status, target_date,
                       assignee, created_at, updated_at, completed_at
                FROM tasks
                WHERE id IN (${blockerIds.map(() => "?").join(",")})
                  AND (${pairPredicate})
                ORDER BY updated_at DESC
                LIMIT ?`,
          args: [...blockerIds, ...pairArgs, MAX_DEPENDENCIES + 1],
        })
      : { rows: [] };
    signal?.throwIfAborted();
    const dependencies = dependenciesResult.rows
      .slice(0, MAX_DEPENDENCIES)
      .flatMap((row): TimelineDependencyRecord[] => {
        const id = textValue(row.id);
        const workspaceSlug = textValue(row.workspace_slug);
        const projectId = textValue(row.project_slug);
        const title = textValue(row.title);
        const state = textValue(row.status);
        const createdAt = timestampSeconds(row.created_at);
        const updatedAt = timestampSeconds(row.updated_at);
        if (!id || !workspaceSlug || !projectId || !title || !state || !createdAt || !updatedAt) {
          return [];
        }
        const completedAt = timestampSeconds(row.completed_at);
        const assignee = textValue(row.assignee);
        return [{
          id,
          workspaceId: query.scope.workspaceId,
          projectId,
          title,
          state,
          resolved: timelineDependencyResolved(state, completedAt),
          ownerIds: assignee ? [assignee] : [],
          date: analyticsDateValue(row.target_date),
          blockedMilestoneIds: blockedMilestonesByDependency.get(id) ?? [],
          deepLink: `${TIMELINE_URL}/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`,
          createdAt,
          updatedAt,
        }];
      });
    const projectByMilestone = new Map(
      rawMilestones.flatMap((row) => {
        const id = textValue(row.id);
        const projectId = textValue(row.project_slug);
        return id && projectId ? [[id, projectId]] as const : [];
      }),
    );
    const workspaceSlugs = Array.from(new Set(projects.map((project) => project.workspaceSlug)));
    const eventsResult = ids.length
      ? await client.execute({
          sql: `SELECT id, workspace_slug, entity_id, action, payload, created_at
                FROM activity
                WHERE workspace_slug IN (${workspaceSlugs.map(() => "?").join(",")})
                  AND entity_kind = 'task'
                  AND entity_id IN (${ids.map(() => "?").join(",")})
                ORDER BY created_at ASC
                LIMIT ?`,
          args: [...workspaceSlugs, ...ids, MAX_EVENTS + 1],
        })
      : { rows: [] };
    signal?.throwIfAborted();

    const dateChanges = new Map<string, MilestoneDateChange[]>();
    const events: AnalyticsEvent[] = [];
    for (const row of eventsResult.rows.slice(0, MAX_EVENTS)) {
      const id = textValue(row.id);
      const entityId = textValue(row.entity_id);
      const at = timestampSeconds(row.created_at);
      if (!id || !entityId || !at) continue;
      const payload = jsonObject(row.payload);
      const from = analyticsDateValue(payload.from ?? payload.previousDate);
      const to = analyticsDateValue(payload.to ?? payload.targetDate);
      const action = textValue(row.action) ?? "updated";
      const dateChanged = action.includes("date") && Boolean(from) && Boolean(to);
      if (dateChanged && from && to) {
        const change = { from, to, changedAt: at };
        const bucket = dateChanges.get(entityId);
        if (bucket) bucket.push(change);
        else dateChanges.set(entityId, [change]);
      }
      events.push({
        id,
        workspaceId: query.scope.workspaceId,
        projectIds: projectByMilestone.get(entityId) ? [projectByMilestone.get(entityId)!] : [],
        entityType: "milestone",
        entityId,
        kind: dateChanged ? "date_changed" : action.includes("status") ? "status_changed" : "updated",
        at,
        meaningful: dateChanged || action.includes("status"),
        fromValue: typeof payload.from === "string" ? payload.from : null,
        toValue: typeof payload.to === "string" ? payload.to : null,
      });
    }

    const milestones = rawMilestones.flatMap((row): MilestoneRecord[] => {
      const id = textValue(row.id);
      const workspaceSlug = textValue(row.workspace_slug);
      const projectId = textValue(row.project_slug);
      const title = textValue(row.title);
      const createdAt = timestampSeconds(row.created_at);
      const updatedAt = timestampSeconds(row.updated_at);
      if (!id || !workspaceSlug || !projectId || !title || !createdAt || !updatedAt) return [];
      const blockerId = textValue(row.blocker_id);
      const assignee = textValue(row.assignee);
      const linkedTaskId = syncedTaskId(id, query.scope.workspaceId);
      const dependencyIds = blockerId ? [blockerId] : [];
      return [{
        id,
        workspaceId: query.scope.workspaceId,
        projectId,
        title,
        state: milestoneState(textValue(row.status)),
        currentDate: analyticsDateValue(row.target_date),
        dateChanges: dateChanges.get(id) ?? [],
        dependencyIds,
        unresolvedDependencyIds: unresolvedTimelineDependencyIds(dependencyIds, dependencies),
        linkedTaskIds: linkedTaskId ? [linkedTaskId] : [],
        linkedDecisionIds: [],
        ownerIds: assignee ? [assignee] : [],
        deepLink: `${TIMELINE_URL}/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`,
        createdAt,
        updatedAt,
      }];
    });

    const issues: string[] = [];
    if (projectsResult.rows.length > MAX_PROJECTS) issues.push("timeline_project_limit_reached");
    if (rowsResult.rows.length > MAX_MILESTONES) issues.push("timeline_milestone_limit_reached");
    if (eventsResult.rows.length > MAX_EVENTS) issues.push("timeline_activity_limit_reached");
    if (dependenciesResult.rows.length > MAX_DEPENDENCIES) issues.push("timeline_dependency_limit_reached");
    if (blockerIds.some((id) => !dependencies.some((dependency) => dependency.id === id))) {
      issues.push("timeline_dependency_record_unavailable");
    }
    if (!dateChanges.size) issues.push("milestone_date_history_unavailable");
    return {
      milestones,
      dependencies,
      events,
      coverage: providerCoverage({
        provider: "timeline",
        status: issues.length ? "partial" : "ready",
        capabilities: [
          "milestone_read",
          ...(dateChanges.size ? ["milestone_date_history" as const] : []),
          ...(milestones.some((milestone) => milestone.linkedTaskIds.length || milestone.dependencyIds.length)
            ? ["cross_product_links" as const]
            : []),
        ],
        count: milestones.length + dependencies.length,
        calculatedAt,
        historyStartAt: events.map((event) => event.at).sort()[0] ?? null,
        historyEndAt: events.map((event) => event.at).sort().at(-1) ?? null,
        issues,
      }),
    };
  }
}

function syncedTaskId(milestoneId: string, tasksWorkspaceId: string): string | null {
  const prefix = `ms-${tasksWorkspaceId}-`;
  return milestoneId.startsWith(prefix) && milestoneId.length > prefix.length
    ? milestoneId.slice(prefix.length)
    : null;
}

function milestoneState(status: string | null): MilestoneRecord["state"] {
  if (status === "shipped") return "completed";
  if (status === "refused") return "cancelled";
  if (status === "next") return "upcoming";
  return "in_flight";
}

function analyticsDateValue(value: unknown): AnalyticsDate | null {
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { kind: "date", value };
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : { kind: "instant", value: date.toISOString() };
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function textValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function timestampSeconds(value: unknown): string | null {
  const number = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(number)) return null;
  const date = new Date(number * 1_000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
