"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isSuiteContextId, type SuiteContextV2 } from "@/lib/suite-context";

export const SUITE_CONTEXT_STORAGE_KEY = "signal_suite_context_v2";
export const SUITE_CONTEXT_EVENT = "signal-suite-context-v2";

// Undefined means no route has published in this document. Explicit null is
// a refusal, and must outrank persisted hints even when storage is unwritable.
let currentPublication: { context: SuiteContextV2 | null } | undefined;

export function readPublishedSuiteContext(): SuiteContextV2 | null | undefined {
  return currentPublication?.context;
}

export function SuiteContextPublisher({
  planningPeriodId,
  workspaceId,
}: {
  planningPeriodId: string | null;
  workspaceId: string | null;
}) {
  const searchParams = useSearchParams();
  const projectHint = searchParams.get("projectId");
  const projectId = isSuiteContextId(projectHint) ? projectHint : undefined;

  useEffect(() => {
    const context: SuiteContextV2 | null = workspaceId ? {
      version: 2,
      workspaceId,
      ...(planningPeriodId ? { planningPeriodId } : {}),
      ...(projectId ? { projectId } : {}),
    } : null;
    const publication = { context };
    currentPublication = publication;
    try {
      if (context) window.localStorage.setItem(SUITE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
      else window.localStorage.removeItem(SUITE_CONTEXT_STORAGE_KEY);
    } catch {
      // Storage is a navigation cache. The live authorized route still wins.
    }
    window.dispatchEvent(new CustomEvent(SUITE_CONTEXT_EVENT, { detail: context }));
    return () => {
      // A departing route/account cannot leave live authority behind. A newer
      // publisher may already own the context; its proof must survive cleanup.
      if (currentPublication !== publication) return;
      currentPublication = { context: null };
      window.dispatchEvent(new CustomEvent(SUITE_CONTEXT_EVENT, { detail: null }));
    };
  }, [planningPeriodId, projectId, workspaceId]);
  return null;
}
