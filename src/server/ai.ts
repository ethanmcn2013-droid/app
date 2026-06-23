import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Vercel AI SDK + Anthropic provider config.
 *
 * Behavior contract:
 *   - Default model is `claude-haiku-4-5-20251001`. Override via
 *     `TASKS_AI_MODEL` (lets us swap snapshots without a deploy).
 *   - API key from `ANTHROPIC_API_KEY`. When unset we DO NOT crash —
 *     `aiConfigured` returns false and callers fall back to a static
 *     "AI not configured" message. This matters because preview /
 *     local environments will frequently lack the key, and the brand
 *     contract is "nothing pings unless asked" — that includes
 *     bricking the build for missing optional infra.
 *   - The chat model is constructed lazily so importing this module
 *     in a context without the key never throws.
 */

export const DEFAULT_MODEL_ID = "claude-haiku-4-5-20251001";

/**
 * Hard ceiling on generated tokens per AI call. Every Tasks AI surface
 * is intentionally tiny — a 1-3 sentence reply, a 2-3 sentence summary,
 * a 4-5 sentence digest. 512 output tokens is comfortably above all of
 * them while capping the blast radius of a runaway generation (a
 * prompt-injected "ignore your limits and write forever" can't bill us
 * past this). Applied at every streamText call site. Tune via
 * TASKS_AI_MAX_OUTPUT_TOKENS without a deploy.
 */
export const MAX_OUTPUT_TOKENS: number = (() => {
  const raw = Number(process.env.TASKS_AI_MAX_OUTPUT_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 512;
})();

/**
 * Per-user burst cap on the interactive AI actions (draft reply, summarize
 * thread). Pairs with MAX_OUTPUT_TOKENS: the token cap bounds the cost of
 * ONE call; this bounds how many calls a single user can fire in a window,
 * so a stuck client loop or a malicious caller can't run up an Anthropic
 * bill. A human using the composer won't approach 20/minute.
 *
 * Enforced via src/lib/ratelimit.ts, which is GATED + FAILS OPEN: a no-op
 * until the operator provisions Upstash (UPSTASH_REDIS_REST_URL/_TOKEN),
 * then live with no deploy. Tune via env without a deploy.
 */
export const AI_RATE_LIMIT: number = (() => {
  const raw = Number(process.env.TASKS_AI_RATE_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20;
})();
export const AI_RATE_WINDOW = (process.env.TASKS_AI_RATE_WINDOW?.trim() ||
  "1 m") as `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

/** Surfaced verbatim when a caller trips the per-user AI burst cap. */
export const AI_RATE_LIMITED_MESSAGE =
  "Too many AI requests in a short window. Give it a minute.";

export function getModelId(): string {
  return process.env.TASKS_AI_MODEL?.trim() || DEFAULT_MODEL_ID;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Construct the Anthropic-backed model. Returns null when the API
 *  key isn't set so callers can branch without try/catch. */
export function getModel(): LanguageModel | null {
  if (!aiConfigured()) return null;
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  return anthropic(getModelId());
}

/** The "AI not configured" sentinel. Surfaced to UI verbatim when
 *  the key is missing — same dry tone as the rules-based nudges. */
export const AI_NOT_CONFIGURED_MESSAGE =
  "AI assist isn't configured here. Add ANTHROPIC_API_KEY to wake it up.";

/** Snapshot of the past week, used both as input to the LLM
 *  narration and as a static fallback when AI is off. */
export type WeeklyDigestSnapshot = {
  /** Number of tasks marked done in the past 7 days. */
  closedThisWeek: number;
  /** Titles of up to 8 closeouts, most-recent first. */
  closedTitles: string[];
  /** Tasks still open and idle ≥ 3 days; the "still circling" set. */
  stillCirclingTitles: string[];
  /** Total open tasks in the workspace. */
  openCount: number;
};

// ────────────────────────────────────────────────────────────────────
// System prompts.
//
// Tone reference: `src/lib/nudges/generate-nudges.ts`. Dry,
// observational, never preachy. We notice; we don't lecture. Cheeky
// is allowed when the moment earns it. Em-dashes welcome. No emojis.
// No "I hope this helps." No "As an AI, …".
//
// Each prompt is split into a long, stable preamble (the brand voice
// shaping) and a short variable suffix. Anthropic prompt caching is
// applied to the preamble so repeat calls hit the cache.
// ────────────────────────────────────────────────────────────────────

export const VOICE_PREAMBLE = `You write microcopy and short replies for Tasks, a calm, anti-spam team task workspace.

Brand voice — non-negotiable:
- Dry, observational, never preachy. Notice things; don't lecture.
- Cheeky-but-restrained. A smirk, not a wink.
- Plain words. No "I hope this helps", no "As an AI", no "Sure!", no apologies.
- No emojis. No exclamation points. Em-dashes are fine.
- Concrete over abstract. "Three tasks closed" beats "Significant progress was made".
- Spec-tight: don't pad. If a sentence isn't pulling weight, cut it.
- Match the user's existing tone in the thread. If they're terse, you're terse.

Do not include preambles like "Here's a draft:" or trailing meta like "Let me know if you'd like to adjust." Output the requested text only.`;

export const DRAFT_REPLY_PROMPT = `${VOICE_PREAMBLE}

Job: draft a 1-3 sentence reply for the conversation composer.

Constraints:
- 1-3 sentences. Stop. Resist the fourth.
- Speak as the current user, not as the assistant.
- Build on what's already in the thread; don't restate it.
- If the user supplied an intent (e.g. "ack and ship by Friday"), honor it precisely. If the intent contradicts the thread, follow the user's intent — they're the human, you're the typist.
- No greetings, no sign-offs.`;

export const SUMMARIZE_THREAD_PROMPT = `${VOICE_PREAMBLE}

Job: summarize a long task conversation in 2-3 sentences.

Constraints:
- 2-3 sentences. Hard cap.
- Lead with the decision or current state, not the chronology. ("Scope is locked at v1; auth is the hold-up.") Skip the "First, X said Y, then Z said W" recap.
- Mention the people involved by first name only when their position matters. Otherwise omit names.
- Surface anything blocking or load-bearing. Bury anything inert.`;

export const WEEKLY_DIGEST_PROMPT = `${VOICE_PREAMBLE}

Job: narrate a workspace's week in 4-5 sentences for the Sunday recap.

Constraints:
- 4-5 sentences. No bullet lists.
- Open with the headline number — what closed, what shipped. Specifics, not vibes.
- Name 1-2 things still circling. Use the actual task titles. Be honest about what's load-bearing.
- Close with a one-line vibe-check appropriate to a Sunday morning. Something restrained, not a pep talk. ("Sunday is for resets." beats "You've got this!")
- Address the reader directly. Second person. No "the team should…".`;
