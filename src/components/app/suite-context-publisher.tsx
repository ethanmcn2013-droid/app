"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { isSuiteContextId, type SuiteContextV2 } from "@/lib/suite-context";

export const SUITE_CONTEXT_STORAGE_KEY = "signal_suite_context_v2";
export const SUITE_CONTEXT_EVENT = "signal-suite-context-v2";

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
    try {
      if (context) window.localStorage.setItem(SUITE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
      else window.localStorage.removeItem(SUITE_CONTEXT_STORAGE_KEY);
    } catch {
      // Storage is a navigation cache. The live authorized route still wins.
    }
    window.dispatchEvent(new CustomEvent(SUITE_CONTEXT_EVENT, { detail: context }));
  }, [planningPeriodId, projectId, workspaceId]);
  return null;
}
