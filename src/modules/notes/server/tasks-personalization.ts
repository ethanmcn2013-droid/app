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
  /**
   * The owner workspace's active domain, as Tasks already reports it.
   *
   * Notes reads this only to choose which register its own copy speaks in
   * (see lib/notes-copy.ts). It is a presentation hint and never an
   * authorisation signal: nothing is unlocked, hidden or scoped by it.
   *
   * The workspace-personalization route has returned this field since it was
   * written; Notes simply dropped it because the type did not declare it.
   * Declaring it is the whole of the wiring, so a couple's notebook can speak
   * about a wedding without a new field, a new route or a migration.
   */
  activeDomain: string | null;
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

/**
 * Which Project, if any, an incoming Notes URL is allowed to select.
 *
 * ── THE DEFECT THIS REPLACES (WP1 · DECISIONS.md D-006) ────────────────────
 * These two lookups used to be links in one `??` chain. An EXPLICIT
 * `workspaceId` that failed authorization therefore fell through to the period
 * lookup and silently selected a DIFFERENT Project from the same Planning
 * Period — and that Project then became the notebook's task destination. The
 * URL said one Project, the notebook filed into another, and nothing said so.
 *
 * ── THE RULE (ADR 0001 §4, plan §1.2 rule 4) ───────────────────────────────
 * An explicit Project is exact or nothing. A Planning Period may only supply a
 * default when NO Project was named at all: a period is a grouping, never an
 * authorization boundary and never a substitute for a Project someone asked
 * for by id. Returning null here is the fail-closed answer — the notebook
 * simply has no preselected destination, which is a state it already renders.
 *
 * This is not flag-gated. `SIGNAL_PLANNING_PERIODS_ENABLED` decides whether
 * the caller consults hints at all; it cannot restore the substitution.
 */
export function selectAuthorizedWorkspaceHint(
  catalog: TasksWorkspaceCatalog,
  workspaceId: string | null,
  planningPeriodId: string | null,
): TasksWorkspaceDestination | null {
  if (catalog.status !== "ready") return null;

  // An explicit Project fails closed. No fall-through, by construction rather
  // than by ordering: this branch returns, so nothing below it can run.
  if (workspaceId) {
    return (
      catalog.workspaces.find((workspace) => workspace.id === workspaceId) ??
      null
    );
  }

  if (planningPeriodId) {
    return (
      catalog.workspaces.find(
        (workspace) => workspace.planningPeriodId === planningPeriodId,
      ) ?? null
    );
  }

  return null;
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
        // Same budget as the workspace catalog. This call now sits on the
        // notebook's render path, and a slow Tasks must never hold the
        // capture field back. Notes degrades to its generic register.
        signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
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

/**
 * The active domain of the signed-in person's workspace, or null.
 *
 * The only reason Notes asks. It decides whether the notebook speaks in the
 * wedding register or the generic one, and nothing else. Any failure, any
 * timeout, any missing secret returns null and Notes reads generic, so this
 * can never block or break a capture.
 */
export async function fetchNotesWorkspaceDomain(
  clerkId: string,
): Promise<string | null> {
  if (!clerkId.trim()) return null;
  const personalization = await fetchTasksPersonalization(clerkId);
  const domain = personalization?.activeDomain;
  return typeof domain === "string" && domain.trim() ? domain : null;
}
