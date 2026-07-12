"use client";

import { useEffect } from "react";
import type { SuiteContextV2 } from "@/lib/suite-context";

export const SUITE_CONTEXT_STORAGE_KEY = "signal_suite_context_v2";
export const SUITE_CONTEXT_EVENT = "signal-suite-context-v2";

export function SuiteContextPublisher({
  planningPeriodId,
  workspaceId,
}: {
  planningPeriodId: string | null;
  workspaceId: string;
}) {
  useEffect(() => {
    if (!planningPeriodId) {
      window.localStorage.removeItem(SUITE_CONTEXT_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(SUITE_CONTEXT_EVENT, { detail: null }));
      return;
    }
    const context: SuiteContextV2 = {
      version: 2,
      planningPeriodId,
      workspaceId,
    };
    window.localStorage.setItem(SUITE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    window.dispatchEvent(new CustomEvent(SUITE_CONTEXT_EVENT, { detail: context }));
  }, [planningPeriodId, workspaceId]);
  return null;
}
