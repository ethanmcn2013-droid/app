import "server-only";
import { getCurrentUser } from "@/server/auth";

/**
 * Operator/admin gate, the single source of truth for "is this caller the
 * operator?". `ADMIN_USER_IDS` is a comma-separated list of Clerk user ids,
 * set in production. When unset (dev) only the legacy seed user "david"
 * passes, i.e. no Clerk session = no admin. Fail-closed by construction.
 *
 * Used by the comp-code minter (actions/comp.ts) and the GTM-roadmap
 * actions (actions/roadmap.ts), which mutate shared operator/marketing
 * state that no ordinary signed-in user should be able to touch.
 */
export function callerIsAdmin(userId: string): boolean {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  if (!raw.trim()) return userId === "david";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

/**
 * Resolve the current user and throw unless they are an operator. Returns
 * the user id on success so callers can reuse it.
 */
export async function requireAdmin(): Promise<string> {
  const me = await getCurrentUser();
  if (!callerIsAdmin(me)) {
    throw new Error("Unauthorized: operator-only action");
  }
  return me;
}
