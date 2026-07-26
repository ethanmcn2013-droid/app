"use client";

import { useEffect, useState } from "react";
import {
  SUITE_CONTEXT_EVENT,
  SUITE_CONTEXT_STORAGE_KEY,
} from "@/components/app/suite-context-publisher";
import {
  isSuiteContextId,
  type SuiteContextV2,
} from "@/lib/suite-context";

function validatedSuiteContext(value: unknown): SuiteContextV2 | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SuiteContextV2>;
  if (
    candidate.version !== 2 ||
    !isSuiteContextId(candidate.workspaceId) ||
    (candidate.planningPeriodId !== undefined &&
      !isSuiteContextId(candidate.planningPeriodId)) ||
    (candidate.projectId !== undefined &&
      !isSuiteContextId(candidate.projectId))
  ) {
    return null;
  }

  return {
    version: 2,
    workspaceId: candidate.workspaceId,
    ...(candidate.planningPeriodId
      ? { planningPeriodId: candidate.planningPeriodId }
      : {}),
    ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
  };
}

/** Read the latest allowlisted suite navigation hints published by Tasks. */
export function useSuiteContext(): SuiteContextV2 | null {
  const [suiteContext, setSuiteContext] = useState<SuiteContextV2 | null>(null);

  useEffect(() => {
    const readStored = () => {
      try {
        setSuiteContext(
          validatedSuiteContext(
            JSON.parse(
              window.localStorage.getItem(SUITE_CONTEXT_STORAGE_KEY) ?? "null",
            ),
          ),
        );
      } catch {
        setSuiteContext(null);
      }
    };
    const onContext = (event: Event) => {
      setSuiteContext(
        validatedSuiteContext(
          (event as CustomEvent<SuiteContextV2 | null>).detail,
        ),
      );
    };

    // Subscribe before reading. If the Tasks publisher writes between these
    // two operations, the event is observed; if it wrote earlier, storage is
    // already authoritative. Reading first left a narrow first-load gap where
    // one responsive nav instance could miss both and emit a bare product URL.
    window.addEventListener(SUITE_CONTEXT_EVENT, onContext);
    readStored();
    return () => window.removeEventListener(SUITE_CONTEXT_EVENT, onContext);
  }, []);

  return suiteContext;
}
