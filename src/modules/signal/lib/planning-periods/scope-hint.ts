import type { SignalScope } from "./scope";

const CONTEXT_ID = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Read an untrusted suite-context hint from the current Signal URL.
 *
 * This never authorizes the scope. The server briefing builder must still
 * resolve it against the current user's live workspace catalog.
 */
export function signalScopeHintFromReferer(
  referer: string | null,
  periodScopeEnabled: boolean,
): SignalScope | undefined {
  if (!referer) return undefined;

  try {
    const url = new URL(referer);
    if (
      url.pathname !== "/app/signal" &&
      !url.pathname.startsWith("/app/signal/")
    ) {
      return undefined;
    }

    const workspaceId = url.searchParams.get("workspaceId");
    if (workspaceId && CONTEXT_ID.test(workspaceId)) {
      return { kind: "workspace", workspaceId };
    }

    const planningPeriodId = url.searchParams.get("planningPeriodId");
    if (
      periodScopeEnabled &&
      planningPeriodId &&
      CONTEXT_ID.test(planningPeriodId)
    ) {
      return { kind: "planningPeriod", planningPeriodId };
    }
  } catch {
    return undefined;
  }

  return undefined;
}
