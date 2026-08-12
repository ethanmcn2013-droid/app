import "server-only";

/**
 * The unified last-active Project cookie — plan §3.3, ADR 0001 §4.
 *
 * One constant, one writer. Everything that has ever set an active-workspace
 * cookie in this repo did it with its own inline options object; this module
 * is the single place those attributes are decided.
 *
 * Attributes, and why each one:
 *
 *  - `HttpOnly` — the value is never needed by client JavaScript. The provider
 *    bootstraps from a server-validated prop, not from `document.cookie`.
 *  - `SameSite=Lax` — cross-product navigation inside the suite is top-level
 *    GET, which Lax permits; a cross-site POST must not carry it.
 *  - `Secure` in production — and deliberately not in development, where the
 *    dev server is plain HTTP and a Secure cookie would simply never be set.
 *  - `Path=/` — every product surface reads it.
 *  - 30-day max age — a browser-scoped preference, not account state.
 *
 * No signature and no cross-device preference table. Both would be dead
 * weight: the value is freshly authorized against live membership on every
 * read, so a forged cookie buys an attacker nothing but a failed lookup. Plan
 * §3.3 is explicit that bespoke cryptography and a Tasks schema migration are
 * not to be added here without a separate product need.
 *
 * **Following a contextual link must not rewrite this cookie.** Only an
 * explicit Project selection does — that is why the only caller of
 * `writeActiveProjectCookie` is `switchActiveProjectAction`, and why a
 * contract test pins that.
 */

import { cookies } from "next/headers";
import { parseProjectId, type ProjectId } from "@/lib/projects/project-ref";

export const ACTIVE_PROJECT_COOKIE = "signal_active_project";

/** The legacy Tasks cookie, still honoured as *input* during migration. */
export const LEGACY_ACTIVE_WORKSPACE_COOKIE = "tasks_active_ws";

export const ACTIVE_PROJECT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ActiveProjectCookieOptions = Readonly<{
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}>;

export function activeProjectCookieOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ActiveProjectCookieOptions {
  return Object.freeze({
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/" as const,
    maxAge: ACTIVE_PROJECT_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Write the last-active Project. The caller must already have proved fresh
 * membership and a non-archived state; this function does not authorize, and
 * is not exported anywhere that could make it look as though it does.
 */
export async function writeActiveProjectCookie(projectId: ProjectId): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROJECT_COOKIE, projectId, activeProjectCookieOptions());
}

/** Read both cookies. Shape-validated; membership is somebody else's job. */
export async function readActiveProjectCookies(): Promise<{
  unified: ProjectId | null;
  legacy: ProjectId | null;
}> {
  const store = await cookies();
  return {
    unified: parseProjectId(store.get(ACTIVE_PROJECT_COOKIE)?.value),
    legacy: parseProjectId(store.get(LEGACY_ACTIVE_WORKSPACE_COOKIE)?.value),
  };
}

export async function clearActiveProjectCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_PROJECT_COOKIE);
}
