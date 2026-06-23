"use server";

import { streamText } from "ai";
import {
  AI_NOT_CONFIGURED_MESSAGE,
  DRAFT_REPLY_PROMPT,
  MAX_OUTPUT_TOKENS,
  SUMMARIZE_THREAD_PROMPT,
  aiConfigured,
  getModel,
  type WeeklyDigestSnapshot,
} from "@/server/ai";
import { getTaskById, getTaskConversation } from "@/server/db/queries";
import {
  buildWeeklySnapshotFor,
  weeklyDigestNarrationFor,
} from "@/server/digest-narration";
import { getActiveWorkspace, getCurrentUser } from "@/server/auth";
import { USERS } from "@/lib/data";
import type { ConversationItem } from "@/server/db/queries";

/**
 * AI server actions. All three return a `ReadableStream<string>` of
 * the generated text. React 19 / Next 16 streams these back over the
 * RSC channel; the client iterates the stream and appends tokens.
 *
 * Failure mode is graceful: when `ANTHROPIC_API_KEY` is unset (preview
 * envs, local without keys) we return a single-chunk stream with a
 * static "AI not configured" message instead of throwing. The UI
 * never sees a runtime crash.
 *
 * Brand-voice enforcement lives in `src/server/ai.ts` — these actions
 * are thin glue that assembles the user-message context (thread,
 * tasks, intent) and delegates voice/shape to the system prompt.
 */

/** Wrap a string as a single-chunk readable stream. Used for
 *  graceful-degradation paths. */
function staticStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

/** Render a conversation slice as plain text the model can read. We
 *  keep this lightweight on purpose — names + bodies, no metadata. */
function renderConversation(items: ConversationItem[]): string {
  const lines: string[] = [];
  for (const it of items) {
    if (it.kind === "comment") {
      const name = it.comment.authorName ?? USERS[it.comment.userId]?.name ?? it.comment.userId;
      lines.push(`${name}: ${it.comment.body}`);
    } else {
      // Activity rows are noisy for the model; skip everything except
      // commentAdd which we already emit via the comment branch.
      // (We render lane moves as a one-liner just so the model sees
      // status context.)
      const a = it.activity;
      if (a.payload.kind === "move") {
        lines.push(
          `[moved from ${a.payload.from} to ${a.payload.to}]`,
        );
      } else if (a.payload.kind === "toggleComplete") {
        lines.push(
          a.payload.to === "done"
            ? "[marked complete]"
            : "[reopened]",
        );
      }
    }
  }
  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────
// 1) Draft a reply
// ────────────────────────────────────────────────────────────────────

export async function draftReplyAction(
  taskId: string,
  intent?: string,
): Promise<ReadableStream<string>> {
  if (!aiConfigured()) return staticStream(AI_NOT_CONFIGURED_MESSAGE);
  const model = getModel();
  if (!model) return staticStream(AI_NOT_CONFIGURED_MESSAGE);

  const [task, items, me, ws] = await Promise.all([
    getTaskById(taskId),
    getTaskConversation(taskId),
    getCurrentUser(),
    getActiveWorkspace(),
  ]);
  if (!task) return staticStream("Task not found.");
  // Workspace guard — without this, an authenticated caller could
  // narrate any task in any workspace by passing its id.
  if (task.workspaceId !== ws) {
    return staticStream("Task not found.");
  }

  const myName = USERS[me]?.name ?? me;
  const thread = renderConversation(items);
  const userIntent = intent?.trim()
    ? `User-supplied intent: "${intent.trim()}"`
    : "User-supplied intent: (none — pick the most natural reply)";

  const userMessage = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : null,
    "",
    "Conversation so far:",
    thread || "(empty thread)",
    "",
    `You are drafting a reply as: ${myName}`,
    userIntent,
    "",
    "Output: the reply text only.",
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
          content: DRAFT_REPLY_PROMPT,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
        { role: "user", content: userMessage },
      ],
      onError({ error }) {
        console.error("draftReplyAction stream error:", error);
      },
    });
    return result.textStream;
  } catch (err) {
    console.error("draftReplyAction failed:", err);
    return staticStream(AI_NOT_CONFIGURED_MESSAGE);
  }
}

// ────────────────────────────────────────────────────────────────────
// 2) Summarize this thread
// ────────────────────────────────────────────────────────────────────

export async function summarizeConversationAction(
  taskId: string,
): Promise<ReadableStream<string>> {
  if (!aiConfigured()) return staticStream(AI_NOT_CONFIGURED_MESSAGE);
  const model = getModel();
  if (!model) return staticStream(AI_NOT_CONFIGURED_MESSAGE);

  const [task, items, ws] = await Promise.all([
    getTaskById(taskId),
    getTaskConversation(taskId),
    getActiveWorkspace(),
  ]);
  if (!task) return staticStream("Task not found.");
  // Workspace guard mirrors draftReplyAction — same vector, same fix.
  if (task.workspaceId !== ws) {
    return staticStream("Task not found.");
  }

  // The "≥ 6 messages" gate also lives client-side, but we re-check
  // here so a hand-crafted call doesn't generate drivel for a 2-line
  // thread.
  const messageCount = items.filter((i) => i.kind === "comment").length;
  if (messageCount < 6) {
    return staticStream("Thread is too short to summarize.");
  }

  const thread = renderConversation(items);
  const userMessage = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : null,
    "",
    "Full conversation:",
    thread,
    "",
    "Output: a 2-3 sentence summary, lead with the current state.",
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
          content: SUMMARIZE_THREAD_PROMPT,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
        { role: "user", content: userMessage },
      ],
      onError({ error }) {
        console.error("summarizeConversationAction stream error:", error);
      },
    });
    return result.textStream;
  } catch (err) {
    console.error("summarizeConversationAction failed:", err);
    return staticStream(AI_NOT_CONFIGURED_MESSAGE);
  }
}

// ────────────────────────────────────────────────────────────────────
// 3) Weekly digest narration
//
// Public action narrates the caller's **active workspace only**. The
// caller-supplied `workspaceId` parameter on previous versions was an
// unguarded read across tenants — fixed by routing all explicit-id
// access through `@/server/digest-narration` (server-only, not RSC-
// exposed) instead.
// ────────────────────────────────────────────────────────────────────

export async function weeklyDigestNarrationAction(): Promise<
  ReadableStream<string>
> {
  const ws = await getActiveWorkspace();
  return weeklyDigestNarrationFor(ws);
}

/** Read-only check exposed to client components so they can hide
 *  affordances entirely when the key isn't configured (no point
 *  in showing a button that always returns the static message). */
export async function isAiConfiguredAction(): Promise<boolean> {
  return aiConfigured();
}

/** Compile the snapshot for the caller's active workspace. The inbox
 *  uses this to decide whether to render the weekly recap at all.
 *  Server-side callers wanting an explicit workspace import
 *  `buildWeeklySnapshotFor` from `@/server/digest-narration` instead. */
export async function getWeeklySnapshotAction(): Promise<WeeklyDigestSnapshot> {
  const ws = await getActiveWorkspace();
  return buildWeeklySnapshotFor(ws);
}
