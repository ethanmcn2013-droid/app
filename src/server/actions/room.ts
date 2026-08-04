"use server";

/**
 * Editorial Project Room — server side (Option B port, 2026-07-17).
 *
 * The workspace brief above the four views needs facts the client store
 * doesn't carry: the workspace's purpose line, its date window, the
 * planning-period name, and the owner. Purpose lives in the existing
 * `meta` KV (`room:{wsId}:purpose`) — same pattern as the board-name
 * override — so no schema migration is required and the field stays
 * reversible.
 */

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { meta, planningPeriods, users, workspaces } from "@/server/db/schema";
import { getActiveWorkspace } from "@/server/auth";
import { getAccessMode, isDemoMode } from "@/lib/access-mode";
import {
  createCalendarFrame,
  PINNED_REVIEW_CALENDAR_FRAME,
  type CalendarFrame,
  type CalendarPlanningPeriod,
} from "@/lib/calendar-frame";
import {
  assertIanaTimeZone,
  isCalendarDate,
} from "@/lib/planning/dates";
import {
  REVIEW_PRIMARY_PROJECT,
  REVIEW_SUITE_FIXTURE,
} from "@/lib/review-suite-fixture";

const MAX_PURPOSE_LEN = 280;

const purposeKey = (workspaceId: string) => `room:${workspaceId}:purpose`;

export type RoomBriefData = {
  /** Planning-period name for the breadcrumb; null when none is assigned. */
  periodName: string | null;
  /** Human date-window line: planning period range, or the workspace's
   *  primary-date label ("The wedding · 3 Oct 2026"), or null. */
  dateWindow: string | null;
  /** Workspace owner's display name; null when unresolvable. */
  ownerName: string | null;
  /** Operator-authored purpose line; null until one is saved. */
  purpose: string | null;
  /** Request-derived, serializable calendar truth for all Tasks views. */
  calendarFrame: CalendarFrame;
};

function formatCalendarDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Server read for the four view pages. One workspace row + up to two
 * small lookups; pages are force-dynamic already.
 */
export async function getRoomBriefData(): Promise<RoomBriefData> {
  if (isDemoMode()) {
    const accessMode = getAccessMode();
    return {
      periodName: "Wedding season",
      dateWindow: "Wedding day · 3 Oct 2026",
      ownerName: REVIEW_SUITE_FIXTURE.workspace.ownerName,
      calendarFrame: {
        ...PINNED_REVIEW_CALENDAR_FRAME,
        source: accessMode === "demo" ? "demo" : "review",
      },
      purpose:
        `Run ${REVIEW_PRIMARY_PROJECT.name}'s wedding from one clear venue workspace, with every supplier, date, and decision accounted for.`,
    };
  }

  const workspaceId = await getActiveWorkspace();

  const [ws] = await db
    .select({
      ownerUserId: workspaces.ownerUserId,
      planningPeriodId: workspaces.planningPeriodId,
      primaryDate: workspaces.primaryDate,
      primaryDateLabel: workspaces.primaryDateLabel,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  let periodName: string | null = null;
  let dateWindow: string | null = null;
  let ownerName: string | null = null;
  let periodTimeZone = "UTC";
  let calendarPeriod: CalendarPlanningPeriod | null = null;

  if (ws?.planningPeriodId) {
    const [period] = await db
      .select({
        id: planningPeriods.id,
        name: planningPeriods.name,
        startDate: planningPeriods.startDate,
        endDate: planningPeriods.endDate,
        timezone: planningPeriods.timezone,
      })
      .from(planningPeriods)
      .where(eq(planningPeriods.id, ws.planningPeriodId));
    if (period) {
      periodName = period.name;
      try {
        assertIanaTimeZone(period.timezone);
        periodTimeZone = period.timezone;
      } catch {
        // A corrupt legacy timezone must not make the workspace unusable.
        periodTimeZone = "UTC";
      }
      calendarPeriod = {
        id: period.id,
        name: period.name,
        startDate: isCalendarDate(period.startDate) ? period.startDate : null,
        endDate: isCalendarDate(period.endDate) ? period.endDate : null,
      };
      if (period.startDate && period.endDate) {
        dateWindow = `${formatCalendarDate(period.startDate)} to ${formatCalendarDate(period.endDate)}`;
      }
    }
  }

  if (!dateWindow && ws?.primaryDate) {
    const formatted = formatCalendarDate(ws.primaryDate);
    dateWindow = ws.primaryDateLabel
      ? `${ws.primaryDateLabel} · ${formatted}`
      : formatted;
  }

  if (ws?.ownerUserId) {
    const [owner] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, ws.ownerUserId));
    ownerName = owner?.name ?? null;
  }

  const [purposeRow] = await db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, purposeKey(workspaceId)));

  return {
    periodName,
    dateWindow,
    ownerName,
    purpose: purposeRow?.value?.trim() ? purposeRow.value : null,
    calendarFrame: createCalendarFrame({
      now: new Date(),
      locale: "en-GB",
      timeZone: periodTimeZone,
      planningPeriod: calendarPeriod,
    }),
  };
}

/**
 * Upsert the workspace purpose line. Empty input clears it (the brief
 * falls back to its invitation copy). Trims and clamps; demo mode
 * no-ops like every other write.
 */
export async function setWorkspacePurposeAction(
  purpose: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const ws = await getActiveWorkspace();
  const clamped = purpose.trim().slice(0, MAX_PURPOSE_LEN);
  const key = purposeKey(ws);
  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${key}, ${clamped}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);
  revalidatePath("/app", "layout");
  return { ok: true };
}
