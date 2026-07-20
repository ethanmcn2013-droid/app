// Kept free of the `server-only` sentinel so the strict DTO and context
// selection helpers can run in node:test. Every runtime importer is a server
// component/action, and the module exposes no credential values.
import { createHmac, randomUUID } from "node:crypto";
import { createTasksPersonalizationAssertion } from "./notes-cross-product-assertion";

export type TasksPersonalization = {
  headline: string;
  body: string;
  firstTaskExample: string;
  workspaceTitle: string;
  primaryUseCase: string | null;
};

export type TasksWorkspaceDestination = {
  id: string;
  name: string;
  role: "owner" | "member";
  planningPeriodId: string | null;
  planningPeriodName: string | null;
  contextType: string | null;
  primaryDate: string | null;
  primaryDateLabel: string | null;
};

export type TasksPlanningPeriodDestination = {
  id: string;
  name: string;
  contextType: string;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
};

export type TasksWorkspaceCatalog =
  | {
      status: "ready";
      planningPeriods: TasksPlanningPeriodDestination[];
      workspaces: TasksWorkspaceDestination[];
    }
  | {
      status: "unavailable";
      planningPeriods: TasksPlanningPeriodDestination[];
      workspaces: TasksWorkspaceDestination[];
    };

const CATALOG_TIMEOUT_MS = 2_000;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseWorkspace(
  raw: unknown,
  period: TasksPlanningPeriodDestination | null,
): TasksWorkspaceDestination | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = stringOrNull(value.id);
  const name = stringOrNull(value.name);
  const role = value.role;
  if (!id || !name || (role !== "owner" && role !== "member")) return null;
  // Archived rows are never valid destinations, even if an older Tasks
  // deployment accidentally includes them in the response.
  if (value.archivedAt != null || value.archived_at != null) return null;
  return {
    id,
    name,
    role,
    planningPeriodId:
      stringOrNull(value.planningPeriodId) ?? period?.id ?? null,
    planningPeriodName:
      stringOrNull(value.planningPeriodName) ?? period?.name ?? null,
    contextType: stringOrNull(value.contextType),
    primaryDate: stringOrNull(value.primaryDate),
    primaryDateLabel: stringOrNull(value.primaryDateLabel),
  };
}

function parsePeriod(raw: unknown): TasksPlanningPeriodDestination | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = stringOrNull(value.id);
  const name = stringOrNull(value.name);
  const contextType = stringOrNull(value.contextType);
  const startDate = stringOrNull(value.startDate);
  const endDate = stringOrNull(value.endDate);
  const timezone = stringOrNull(value.timezone);
  if (!id || !name || !contextType || !timezone) {
    return null;
  }
  return { id, name, contextType, startDate, endDate, timezone };
}

/** Strict DTO parser, exported for contract tests. Unknown fields are dropped. */
export function parseTasksWorkspaceCatalog(raw: unknown): TasksWorkspaceCatalog {
  if (!raw || typeof raw !== "object") {
    return { status: "unavailable", planningPeriods: [], workspaces: [] };
  }
  const value = raw as Record<string, unknown>;
  const periods: TasksPlanningPeriodDestination[] = [];
  const workspaces: TasksWorkspaceDestination[] = [];

  // v2 may return grouped periods (`periods`) or one group (`period`). Keep
  // the consumer rollout-tolerant while retaining the same strict DTO.
  const groups = Array.isArray(value.periods)
    ? value.periods
    : value.period
      ? [{ period: value.period, workspaces: value.workspaces }]
      : [];
  for (const groupRaw of groups) {
    if (!groupRaw || typeof groupRaw !== "object") continue;
    const group = groupRaw as Record<string, unknown>;
    const period = parsePeriod(group.period ?? group);
    if (!period) continue;
    periods.push(period);
    for (const workspaceRaw of Array.isArray(group.workspaces) ? group.workspaces : []) {
      const workspace = parseWorkspace(workspaceRaw, period);
      if (workspace) workspaces.push(workspace);
    }
  }

  // v1 compatibility during ordered rollout. These workspaces remain
  // selectable but have no Planning Period projection until Tasks is v2.
  if (workspaces.length === 0 && Array.isArray(value.workspaces)) {
    for (const workspaceRaw of value.workspaces) {
      const workspace = parseWorkspace(workspaceRaw, null);
      if (workspace) workspaces.push(workspace);
    }
  }

  return { status: "ready", planningPeriods: periods, workspaces };
}

export async function fetchTasksWorkspaceCatalog(
  clerkId: string,
): Promise<TasksWorkspaceCatalog> {
  const baseRaw = process.env.TASKS_API_URL ??
    (process.env.VERCEL_ENV === "production" ? "https://tasks.signalstudio.ie" : null);
  const secret = process.env.NOTES_TO_TASKS_SECRET;
  if (!baseRaw || !secret || !clerkId.trim()) {
    return { status: "unavailable", planningPeriods: [], workspaces: [] };
  }
  const base = baseRaw.replace(/\/+$/, "");
  try {
    const assertion = createTasksWorkspaceAssertion(clerkId, secret);
    const res = await fetch(`${base}/api/internal/workspaces?contractVersion=2`, {
      headers: { authorization: `Bearer ${assertion}` },
      cache: "no-store",
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { status: "unavailable", planningPeriods: [], workspaces: [] };
    }
    return parseTasksWorkspaceCatalog(await res.json());
  } catch {
    return { status: "unavailable", planningPeriods: [], workspaces: [] };
  }
}

export async function fetchTasksWorkspaces(
  clerkId: string,
): Promise<TasksWorkspaceDestination[]> {
  const catalog = await fetchTasksWorkspaceCatalog(clerkId);
  return catalog.workspaces;
}

export async function authorizeTasksWorkspace(
  clerkId: string,
  workspaceId: string,
): Promise<"allowed" | "denied" | "unavailable"> {
  const catalog = await fetchTasksWorkspaceCatalog(clerkId);
  if (catalog.status === "unavailable") return "unavailable";
  return catalog.workspaces.some((workspace) => workspace.id === workspaceId)
    ? "allowed"
    : "denied";
}

export function selectAuthorizedWorkspaceHint(
  catalog: TasksWorkspaceCatalog,
  workspaceId: string | null,
  planningPeriodId: string | null,
): TasksWorkspaceDestination | null {
  if (catalog.status !== "ready") return null;
  return (
    (workspaceId
      ? catalog.workspaces.find((workspace) => workspace.id === workspaceId)
      : undefined) ??
    (planningPeriodId
      ? catalog.workspaces.find(
          (workspace) => workspace.planningPeriodId === planningPeriodId,
        )
      : undefined) ??
    null
  );
}

function createTasksWorkspaceAssertion(subject: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    v: 1 as const,
    iss: "signal-notes" as const,
    aud: "signal-tasks.workspace-list" as const,
    sub: subject,
    iat: now,
    exp: now + 300,
    jti: randomUUID(),
    traceId: randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  // Server modules run in Node; use the same narrow HMAC envelope as the
  // Notes→Tasks write assertion without adding a JWT dependency.
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

/**
 * Read segment empty-state copy from Tasks for the signed-in user's email.
 * Uses the same bearer secret as notes-extract cross-repo calls.
 */
export async function fetchTasksPersonalization(
  clerkId: string,
): Promise<TasksPersonalization | null> {
  const base =
    process.env.TASKS_API_URL?.replace(/\/+$/, "") ??
    "https://tasks.signalstudio.ie";
  const secret = process.env.NOTES_TO_TASKS_SECRET;
  if (!secret) return null;

  try {
    const assertion = createTasksPersonalizationAssertion(clerkId, secret);
    const res = await fetch(
      `${base}/api/internal/workspace-personalization`,
      {
        headers: { authorization: `Bearer ${assertion}` },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      personalization?: TasksPersonalization | null;
    };
    return json.personalization ?? null;
  } catch {
    return null;
  }
}
