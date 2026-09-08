"use server";

/**
 * Project overview — server reads and meta KV writes (Phase 4.1).
 *
 * D-011 vocabulary: Projects = workspaces, Programs = planning periods.
 * Declared status (owner opinion) and computed task progress are always
 * kept separate and never conflated in this module.
 *
 * Key shapes:
 *   project-status:<workspaceId>      string enum | "" (not set)
 *   project-target-date:<workspaceId> ISO date string | "" (not set)
 *
 * Both keys follow the same meta KV pattern as board.ts and room.ts.
 * No schema migration required.
 */

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { readSponsoredWeddingDate } from "@/server/db/sponsored-wedding-date";
import type { SponsoredWeddingDate } from "@/lib/sponsored-wedding-date";
import {
  meta,
  tasks,
  users,
  workspaceMembers,
  workspaceEvents,
  workspaces,
  planningPeriods,
} from "@/server/db/schema";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import {
  authorizeProjectCandidate,
  type ProjectCapabilityKey,
} from "@/server/actions/project-authz";

/**
 * The Project this action acts on — ADR 0001 §9, create/list.
 *
 * Resolved through the fail-closed accessor so the cookie can no longer decay
 * into LEGACY_WORKSPACE_ID (D-005), then proved against live membership.
 */
async function provedProject(
  candidate: string | null | undefined,
  capability: ProjectCapabilityKey = "createOrEditTasks",
): Promise<string> {
  const grant = await authorizeProjectCandidate({
    candidateProjectId: candidate,
    capability,
  });
  // One neutral message for every refusal (ADR 0001 §4).
  if (!grant.ok) throw new Error("That project isn’t available.");
  return grant.projectId;
}

import { getTasks } from "@/server/db/queries";
import { isDemoMode } from "@/lib/access-mode";
import { getBoardName } from "@/server/actions/board";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { isTaskDone } from "@/lib/board-columns";
import {
  DEMO_USER_ID,
  DEMO_WORKSPACE_ID,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_SLUG,
} from "@/server/demo/tasks-demo";
import {
  REVIEW_MENU_MILESTONE,
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";

// ── Status type ───────────────────────────────────────────────────────

export type ProjectStatus =
  | "on-track"
  | "at-risk"
  | "paused"
  | "complete"
  | null;

// ── Key helpers ───────────────────────────────────────────────────────

function statusKey(workspaceId: string): string {
  return `project-status:${workspaceId}`;
}

function targetDateKey(workspaceId: string): string {
  return `project-target-date:${workspaceId}`;
}

function purposeKey(workspaceId: string): string {
  return `room:${workspaceId}:purpose`;
}

// ── Member shape ──────────────────────────────────────────────────────

export type ProjectMember = {
  userId: string;
  role: "owner" | "member";
  name: string | null;
  email: string | null;
  initials: string | null;
};

// ── Milestone shape ───────────────────────────────────────────────────

export type ProjectMilestone = {
  id: string;
  title: string;
  dueAt: string | null;
};

// ── Event shape ───────────────────────────────────────────────────────

export type ProjectEvent = {
  id: string;
  sentence: string;
  createdAt: string;
  relative: string;
};

// ── Program shape (only present when a planning period is assigned) ───

export type ProjectProgram = {
  name: string;
  dateRange: string | null;
};

// ── Task stats ────────────────────────────────────────────────────────

export type ProjectTaskStats = {
  total: number;
  complete: number;
  overdue: number;
  undated: number;
  progressPct: number;
};

// ── Full overview shape ───────────────────────────────────────────────

export type ProjectOverviewData = {
  workspaceId: string;
  slug: string;
  displayName: string;
  purpose: string | null;
  createdAt: string | null;
  ownerUserId: string | null;
  isOwner: boolean;
  members: ProjectMember[];
  taskStats: ProjectTaskStats;
  milestones: ProjectMilestone[];
  recentEvents: ProjectEvent[];
  declaredStatus: ProjectStatus;
  targetDate: string | null;
  sponsoredWeddingDate?: SponsoredWeddingDate | null;
  program: ProjectProgram | null;
};

// ── Relative-time helper (no extra deps) ─────────────────────────────

function relativeSeconds(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diff < 60) return "just now";
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function compactDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatEventSentence(kind: string, payload: unknown): string {
  try {
    const p = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (kind === "inviteSent") {
      const role = (p as { role?: string }).role ?? "member";
      return `A workspace invite was sent (${role} role).`;
    }
    if (kind === "inviteAccepted") {
      return "A workspace invite was accepted.";
    }
  } catch {
    // malformed payload
  }
  return "A workspace event occurred.";
}

// ── Main read ─────────────────────────────────────────────────────────

/**
 * Returns the full overview data for the caller's active workspace.
 * Demo mode returns a synthesized object; never touches the DB.
 */
export async function getProjectOverviewData(projectId?: string): Promise<ProjectOverviewData> {
  if (isDemoMode()) {
    return {
      workspaceId: DEMO_WORKSPACE_ID,
      slug: DEMO_WORKSPACE_SLUG,
      displayName: DEMO_WORKSPACE_NAME,
      purpose:
        `Run ${REVIEW_PRIMARY_PROJECT.name}'s wedding from one clear venue workspace, with every supplier, date, and decision accounted for.`,
      createdAt: "2026-01-01T00:00:00.000Z",
      ownerUserId: DEMO_USER_ID,
      isOwner: true,
      members: [
        {
          userId: DEMO_USER_ID,
          role: "owner",
          name: "Orla",
          email: "orla@theorchard.example",
          initials: "OR",
        },
      ],
      taskStats: {
        total: 10,
        complete: 4,
        overdue: 1,
        undated: 2,
        progressPct: 40,
      },
      milestones: [
        {
          id: "demo-milestone-1",
          title: REVIEW_MENU_MILESTONE.title,
          dueAt: `${REVIEW_MENU_MILESTONE.date}T00:00:00.000Z`,
        },
        {
          id: "demo-milestone-2",
          title: "Wedding day",
          dueAt: `${REVIEW_SUITE_FIXTURE.primaryDate.date}T00:00:00.000Z`,
        },
      ],
      recentEvents: [
        {
          id: "demo-evt-1",
          sentence: "A workspace invite was accepted.",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          relative: "2d ago",
        },
      ],
      declaredStatus: "on-track",
      targetDate: REVIEW_SUITE_FIXTURE.primaryDate.date,
      program: {
        name: "Wedding season",
        dateRange: "3 Oct 2026",
      },
    };
  }

  const [me, ws] = await Promise.all([
    getCurrentUser(),
    provedProject(projectId === undefined ? await getActiveWorkspaceOrNull() : projectId, "open"),
  ]);

  // Workspace row + planning period in one read.
  const [wsRow] = await db
    .select({
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
      planningPeriodId: workspaces.planningPeriodId,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, ws));

  // Members: join workspace_members with users for name/email/initials.
  const memberRows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      name: users.name,
      email: users.email,
      initials: users.initials,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ws));

  // Meta KV: purpose, declared status, target date.
  const metaKeys = [
    purposeKey(ws),
    statusKey(ws),
    targetDateKey(ws),
  ];
  const metaRows = await db
    .select({ key: meta.key, value: meta.value })
    .from(meta)
    .where(inArray(meta.key, metaKeys));

  const metaMap = new Map(metaRows.map((r) => [r.key, r.value]));
  const rawPurpose = metaMap.get(purposeKey(ws)) ?? null;
  const rawStatus = metaMap.get(statusKey(ws)) ?? null;
  const rawTargetDate = metaMap.get(targetDateKey(ws)) ?? null;

  const declaredStatus = parseStatus(rawStatus);
  const targetDate = rawTargetDate?.trim() || null;

  // Tasks: getTasks already workspace-scoped via byWorkspace. Column config
  // fetched once alongside it and reused for every done-check below (T·122).
  const [allTasks, columnConfig] = await Promise.all([
    getTasks(ws),
    readWorkspaceColumnConfig(ws),
  ]);
  const nowMs = Date.now();
  const total = allTasks.length;
  const complete = allTasks.filter((t) => isTaskDone(t, columnConfig)).length;
  const overdue = allTasks.filter(
    (t) => t.dueAt && t.dueAt.getTime() < nowMs && !isTaskDone(t, columnConfig),
  ).length;
  const undated = allTasks.filter((t) => !t.dueAt && !isTaskDone(t, columnConfig)).length;
  const progressPct = total === 0 ? 0 : Math.round((complete / total) * 100);

  // Milestone tasks: is_milestone = true, not done, capped 5, ordered by dueAt.
  const milestoneRows = await db
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, ws),
        eq(tasks.isMilestone, true),
        isNull(tasks.parentTaskId),
        isNull(tasks.archivedAt),
        sql`${tasks.lane} != 'done'`,
      ),
    )
    .orderBy(asc(tasks.dueAt))
    .limit(5);

  const milestones: ProjectMilestone[] = milestoneRows.map((r) => ({
    id: r.id,
    title: r.title,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
  }));

  // Recent workspace events: latest 8, all kinds.
  const eventRows = await db
    .select({
      id: workspaceEvents.id,
      kind: workspaceEvents.kind,
      payload: workspaceEvents.payload,
      createdAt: workspaceEvents.createdAt,
    })
    .from(workspaceEvents)
    .where(eq(workspaceEvents.workspaceId, ws))
    .orderBy(desc(workspaceEvents.createdAt))
    .limit(8);

  const recentEvents: ProjectEvent[] = eventRows.map((r) => ({
    id: r.id,
    sentence: formatEventSentence(r.kind, r.payload),
    createdAt: new Date(r.createdAt * 1000).toISOString(),
    relative: relativeSeconds(r.createdAt),
  }));

  // Planning period (program line) — only if assigned.
  let program: ProjectProgram | null = null;
  if (wsRow?.planningPeriodId) {
    const [period] = await db
      .select({
        name: planningPeriods.name,
        startDate: planningPeriods.startDate,
        endDate: planningPeriods.endDate,
      })
      .from(planningPeriods)
      .where(eq(planningPeriods.id, wsRow.planningPeriodId));
    if (period) {
      const dateRange =
        period.startDate && period.endDate
          ? `${compactDate(period.startDate)} to ${compactDate(period.endDate)}`
          : period.startDate
            ? compactDate(period.startDate)
            : null;
      program = { name: period.name, dateRange };
    }
  }

  // Display name: board-name override first, then workspace name.
  const boardName = await getBoardName(ws);
  const displayName = boardName ?? wsRow?.name ?? "Project";

  const members: ProjectMember[] = memberRows.map((m) => ({
    userId: m.userId,
    role: m.role,
    name: m.name ?? null,
    email: m.email ?? null,
    initials: m.initials ?? null,
  }));

  return {
    workspaceId: ws,
    slug: wsRow?.slug ?? ws,
    displayName,
    purpose: rawPurpose?.trim() || null,
    createdAt: wsRow?.createdAt ? wsRow.createdAt.toISOString() : null,
    ownerUserId: wsRow?.ownerUserId ?? null,
    isOwner: wsRow?.ownerUserId === me,
    members,
    taskStats: { total, complete, overdue, undated, progressPct },
    milestones,
    recentEvents,
    declaredStatus,
    targetDate,
    sponsoredWeddingDate: await readSponsoredWeddingDate(db, { projectId: ws, actorUserId: me }),
    program,
  };
}

// ── Status helpers ────────────────────────────────────────────────────

function parseStatus(raw: string | null): ProjectStatus {
  if (!raw) return null;
  if (
    raw === "on-track" ||
    raw === "at-risk" ||
    raw === "paused" ||
    raw === "complete"
  ) {
    return raw;
  }
  return null;
}

// ── Permission guard (mirrors board.ts setBoardNameAction pattern) ───

async function requireOwnerOrMember(ws: string, me: string): Promise<void> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ws),
        eq(workspaceMembers.userId, me),
      ),
    );
  if (!row) throw new Error("Not a member of this workspace.");
}

// ── Mutations ─────────────────────────────────────────────────────────

/**
 * Set or clear the declared project status.
 * Permitted for any workspace member (owner or member).
 * Demo mode: no-op success.
 */
export async function setProjectStatusAction(
  status: ProjectStatus,
  projectId?: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  // Server-side allow-list: the parameter type is client-asserted only.
  if (status !== null && parseStatus(status) === null) {
    throw new Error("Unknown project status.");
  }
  const [me, ws] = await Promise.all([
    getCurrentUser(),
    provedProject(projectId === undefined ? await getActiveWorkspaceOrNull() : projectId, "createOrEditTasks"),
  ]);
  await requireOwnerOrMember(ws, me);

  const key = statusKey(ws);
  const value = status ?? "";
  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${key}, ${value}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  revalidatePath("/app", "layout");
  revalidatePath("/app/project");
  return { ok: true };
}

/**
 * Set or clear the target date for the project.
 * Permitted for any workspace member (owner or member).
 * Demo mode: no-op success.
 */
export async function setProjectTargetDateAction(
  isoDate: string | null,
  projectId?: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  // Server-side shape check: only a plain YYYY-MM-DD or null is stored.
  if (isoDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("Target date must be a YYYY-MM-DD date.");
  }
  const [me, ws] = await Promise.all([
    getCurrentUser(),
    provedProject(projectId === undefined ? await getActiveWorkspaceOrNull() : projectId, "createOrEditTasks"),
  ]);
  await requireOwnerOrMember(ws, me);

  const key = targetDateKey(ws);
  const value = isoDate ?? "";
  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${key}, ${value}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  revalidatePath("/app", "layout");
  revalidatePath("/app/project");
  return { ok: true };
}
