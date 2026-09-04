"use client";

import { useEffect, useState } from "react";
import { useActiveProject } from "@/components/app/active-project-provider";
import {
  SUITE_CONTEXT_EVENT,
  SUITE_CONTEXT_STORAGE_KEY,
} from "@/components/app/suite-context-publisher";
import {
  isSuiteContextId,
  type SuiteContextV2,
  type SuiteNavigationContext,
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

/** Prefer the verified live Project; retain the legacy publisher with V3 off. */
export function useSuiteContext(): SuiteNavigationContext | null {
  const activeProject = useActiveProject();
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

  // In V3, the route's server proof is the only displayed Project authority.
  // Pending/unavailable routes must never revive an unrelated cached A.
  if (activeProject?.enabled) {
    return activeProject.chrome.kind === "verified"
      ? { version: 3, workspaceId: activeProject.chrome.project.id }
      : null;
  }
  return suiteContext;
}
