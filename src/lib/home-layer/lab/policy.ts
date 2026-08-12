/**
 * Protected-lab access policy — the decision, with nothing around it.
 *
 * This file holds the *whole* rule for who may see the Home operating-layer
 * design lab, expressed as pure functions over an environment and an email.
 * It imports nothing: no Clerk, no Next, no database, no `server-only`. That
 * is deliberate. The rule is the part that has to be provable, and a rule you
 * can only exercise inside a request is a rule you cannot test.
 *
 * `guard.ts` is the thin server-side wrapper that resolves the identity, asks
 * this file, and turns a refusal into `notFound()`. Everything decidable lives
 * here; everything unavoidably ambient lives there.
 *
 * ── Which flag convention this is, and why ─────────────────────────────────
 *
 * This repository has two, and they are not interchangeable:
 *
 *   src/lib/planning/flags.ts
 *     `defaultEnabled = env.NODE_ENV !== "production"` — every planning flag
 *     is ON by default in development and in test, OFF only in production.
 *     Correct for progressive product features. Wrong here: it would serve the
 *     lab to anyone who reached a non-production build, which is exactly the
 *     exposure R-H10 exists to close.
 *
 *   src/modules/signal/server/analytics/feature-flag.ts
 *     Closed in every environment. Only a literal "true"/"1" opens it, an
 *     explicit "false"/"0" always loses, and anything unrecognised is closed.
 *
 * The second one is copied here. Default-off must mean off in *every*
 * environment, not off in one of them.
 *
 * ── Fail-closed, stated exactly ────────────────────────────────────────────
 *
 * Every unknown resolves to refusal. Unset flag: refused. Unparseable flag
 * value: refused. No email: refused. Unverified email: refused. Email absent
 * from the reviewer list: refused. Seed-data access posture (demo/review),
 * where there is no real identity to check at all: refused. There is no input
 * to these functions that opens the lab by accident.
 */

/** Env var that opens the lab at all. Absent means closed, everywhere. */
export const LAB_FLAG_ENV = "HOME_REVIEW_LAB_ENABLED";

/** Env var carrying the reviewer allowlist. Comma / space / newline separated. */
export const LAB_REVIEWERS_ENV = "HOME_REVIEW_LAB_REVIEWERS";

/**
 * Reviewers who are always on the list, mirroring the shape of
 * `src/lib/access-allowlist.ts`. The founder is the named reviewer for this
 * programme — the charter's one expected pause is his visual-direction
 * selection, taken in this exact lab — so an empty env var must not lock him
 * out of the thing he is required to look at.
 *
 * This is not a weakening of "explicit allowlist": it is a literal in source,
 * reviewable in a diff, and it grants nothing on its own. The flag is still
 * default-off, so with `HOME_REVIEW_LAB_ENABLED` unset this entry reaches
 * nothing.
 */
const ALWAYS_REVIEWER: readonly string[] = ["ethanmcn2013@gmail.com"];

export type LabAccessInput = {
  /** Resolved from the flag. Passed in so the decision stays pure. */
  readonly flagEnabled: boolean;
  /** True in demo / review access mode: synthetic identity, public posture. */
  readonly seedDataPosture: boolean;
  /** The signed-in reviewer's verified primary email, or null when unknown. */
  readonly email: string | null | undefined;
};

/**
 * Why a request was refused. For tests and for the contract document only.
 *
 * This value must never reach a response. Every non-"granted" outcome renders
 * the same 404, because telling an authenticated non-reviewer *why* they were
 * refused confirms the route exists, and the route existing is itself the
 * thing being withheld.
 */
export type LabAccessDecision =
  | "granted"
  | "flag-off"
  | "seed-data-posture"
  | "not-authenticated"
  | "not-a-reviewer";

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Is the lab open at all? Closed unless explicitly opened, in every
 * environment, with an explicit false always winning.
 */
export function isHomeReviewLabEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const configured = env[LAB_FLAG_ENV]?.trim().toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return false;
}

/** The reviewer allowlist: the named reviewer plus HOME_REVIEW_LAB_REVIEWERS. */
export function labReviewers(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Set<string> {
  const set = new Set<string>(ALWAYS_REVIEWER.map(normalise));
  for (const part of (env[LAB_REVIEWERS_ENV] ?? "").split(/[,\s]+/)) {
    const email = normalise(part);
    if (email) set.add(email);
  }
  return set;
}

/** Whether this email is a lab reviewer. No email is not a reviewer. */
export function isLabReviewer(
  email: string | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (!email) return false;
  return labReviewers(env).has(normalise(email));
}

/**
 * The whole rule, in order. The flag is checked first so that when the lab is
 * closed no identity is resolved and no reviewer list is read.
 */
export function labAccessDecision(
  input: LabAccessInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
): LabAccessDecision {
  if (!input.flagEnabled) return "flag-off";
  if (input.seedDataPosture) return "seed-data-posture";
  if (!input.email) return "not-authenticated";
  if (!isLabReviewer(input.email, env)) return "not-a-reviewer";
  return "granted";
}

/** Convenience predicate over `labAccessDecision`. */
export function labAccessGranted(
  input: LabAccessInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return labAccessDecision(input, env) === "granted";
}
