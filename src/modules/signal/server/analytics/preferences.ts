import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type { AnalyticsPreferences } from "../../lib/analytics/contracts";
import { signalAnalyticsDb as db } from "../db/signal-analytics-client";
import { analyticsViewPreferences } from "../db/signal-analytics-schema";
import { AnalyticsApiError } from "./errors";

const CARD_ID = /^[a-z][a-z0-9._-]{0,63}$/;
const MAX_CARDS = 32;

export async function readAnalyticsPreferences(
  clerkId: string,
  workspaceId: string,
): Promise<AnalyticsPreferences> {
  const [row] = await db
    .select()
    .from(analyticsViewPreferences)
    .where(
      and(
        eq(analyticsViewPreferences.clerkId, clerkId),
        eq(analyticsViewPreferences.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return row
    ? {
        hiddenCardIds: stringArray(row.hiddenCardIds),
        pinnedCardIds: stringArray(row.pinnedCardIds),
        cardOrder: stringArray(row.cardOrder),
        updatedAt: row.updatedAt.toISOString(),
      }
    : { hiddenCardIds: [], pinnedCardIds: [], cardOrder: [], updatedAt: null };
}

export async function writeAnalyticsPreferences(
  clerkId: string,
  workspaceId: string,
  input: unknown,
): Promise<AnalyticsPreferences> {
  const values = parsePreferenceInput(input);
  const now = new Date();
  await db
    .insert(analyticsViewPreferences)
    .values({
      clerkId,
      workspaceId,
      hiddenCardIds: values.hiddenCardIds,
      pinnedCardIds: values.pinnedCardIds,
      cardOrder: values.cardOrder,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [analyticsViewPreferences.clerkId, analyticsViewPreferences.workspaceId],
      set: {
        hiddenCardIds: values.hiddenCardIds,
        pinnedCardIds: values.pinnedCardIds,
        cardOrder: values.cardOrder,
        schemaVersion: 1,
        updatedAt: sql`excluded.updated_at`,
      },
    });
  return { ...values, updatedAt: now.toISOString() };
}

export function parsePreferenceInput(input: unknown): Omit<AnalyticsPreferences, "updatedAt"> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AnalyticsApiError(400, "invalid_request", "Preference payload must be an object.");
  }
  const value = input as Record<string, unknown>;
  const allowed = new Set(["hiddenCardIds", "pinnedCardIds", "cardOrder"]);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new AnalyticsApiError(400, "invalid_request", "Preference payload contains unknown fields.", {
      fields: unexpected,
    });
  }
  const pinnedCardIds = cardIds(value.pinnedCardIds, "pinnedCardIds");
  const pinned = new Set(pinnedCardIds);
  return {
    pinnedCardIds,
    hiddenCardIds: cardIds(value.hiddenCardIds, "hiddenCardIds").filter((id) => !pinned.has(id)),
    cardOrder: cardIds(value.cardOrder, "cardOrder"),
  };
}

function cardIds(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_CARDS) {
    throw new AnalyticsApiError(400, "invalid_request", `${field} must contain at most ${MAX_CARDS} card identifiers.`);
  }
  const ids = value.filter((entry): entry is string => typeof entry === "string");
  if (ids.length !== value.length || ids.some((id) => !CARD_ID.test(id))) {
    throw new AnalyticsApiError(400, "invalid_request", `${field} contains an invalid card identifier.`);
  }
  return Array.from(new Set(ids));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
