import "server-only";
import { streamText } from "ai";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  MAX_OUTPUT_TOKENS,
  WEEKLY_DIGEST_PROMPT,
  aiConfigured,
  getModel,
  type WeeklyDigestSnapshot,
} from "@/server/ai";
import { getTasks } from "@/server/db/queries";

/**
 * Server-only digest narration. Lives outside `actions/` because the
 * RSC server-actions channel auto-exposes every export from any
 * `"use server"` file — and these helpers accept an explicit workspace
 * id, which would let any caller pass a workspace they don't belong to.
 *
 * Trusted server-side callers (cron routes, the inbox server component)
 * import these directly. The public action equivalents in
 * `actions/ai.ts` resolve workspace from the active session.
 */

function staticStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

/**
 * Build the lightweight rules-based snapshot that feeds the weekly
 * narration. Pure read; no side-effects.
 */
export async function buildWeeklySnapshotFor(
  workspaceId: string,
): Promise<WeeklyDigestSnapshot> {
  const tasks = await getTasks(workspaceId);
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const closed = tasks.filter(
    (t) =>
      t.lane === "done" &&
      now - t.updatedAt.getTime() <= WEEK_MS,
  );
  closed.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const open = tasks.filter((t) => t.lane !== "done");
  const stillCircling = open
    .filter((t) => {
      const ageMs = now - t.updatedAt.getTime();
      return ageMs >= 3 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, 4);

  return {
    closedThisWeek: closed.length,
    closedTitles: closed.slice(0, 8).map((t) => t.title),
    stillCirclingTitles: stillCircling.map((t) => t.title),
    openCount: open.length,
  };
}

/**
 * LLM-narrated Sunday recap for an explicit workspace. Returns a
 * single-chunk fallback stream when AI isn't configured.
 */
export async function weeklyDigestNarrationFor(
  workspaceId: string,
): Promise<ReadableStream<string>> {
  if (!aiConfigured()) return staticStream(AI_NOT_CONFIGURED_MESSAGE);
  const model = getModel();
  if (!model) return staticStream(AI_NOT_CONFIGURED_MESSAGE);

  const snap = await buildWeeklySnapshotFor(workspaceId);
  if (snap.closedThisWeek === 0 && snap.openCount === 0) {
    return staticStream("Quiet week. Nothing to recap.");
  }

  const userMessage = [
    `Closed this week: ${snap.closedThisWeek}`,
    snap.closedTitles.length > 0
      ? `Closeout titles: ${snap.closedTitles.map((t) => `"${t}"`).join(", ")}`
      : null,
    `Still open: ${snap.openCount}`,
    snap.stillCirclingTitles.length > 0
      ? `Still circling (idle ≥ 3 days): ${snap.stillCirclingTitles.map((t) => `"${t}"`).join(", ")}`
      : null,
    "",
    "Output: the 4-5 sentence Sunday recap.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = streamText({
      model,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "system",
          content: WEEKLY_DIGEST_PROMPT,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
        { role: "user", content: userMessage },
      ],
      onError({ error }) {
        console.error("weeklyDigestNarrationFor stream error:", error);
      },
    });
    return result.textStream;
  } catch (err) {
    console.error("weeklyDigestNarrationFor failed:", err);
    return staticStream(AI_NOT_CONFIGURED_MESSAGE);
  }
}
