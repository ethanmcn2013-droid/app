"use client";

/**
 * "Start with Monthly business rhythm": the one-click starter Project.
 *
 * Extracted from `projects-sidebar.tsx` (T·97) so the v3 Projects page can
 * offer the same flow beside its "New project" form without loading the
 * legacy sidebar. Behaviour is unchanged; the component carries no styles of
 * its own and each caller passes its class names.
 */

import { useEffect, useState, type TransitionStartFunction } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { parseProjectId } from "@/lib/projects/project-ref";
import { confirmMonthlyRemix, pendingMonthlyRemix, prepareMonthlyRemix } from "@/lib/template-remix-intent";
import { useActiveProject } from "@/components/app/active-project-provider";
import { selectWorkspaceAction } from "@/server/actions/cross-workspace";
import { remixTemplateAction } from "@/server/actions/templates";

const MONTHLY_TEMPLATE_ID = "local-business-monthly-rhythm";
const MONTHLY_PROJECT_NAME = "Monthly business rhythm · my remix";

export type MonthlyTemplateChoiceClassNames = Readonly<{
  wrap: string;
  choice: string;
  help: string;
  status: string;
}>;

/** A remix always creates a separate owned Project. Its saved request survives
 * a lost action response and this component's remount in the same tab. */
export function MonthlyTemplateChoice({ pending, startTransition, onCreated, classNames }: {
  pending: boolean;
  startTransition: TransitionStartFunction;
  onCreated?: () => void;
  /** Each surface dresses the same flow in its own register. */
  classNames: MonthlyTemplateChoiceClassNames;
}) {
  const { isLoaded, userId } = useAuth();
  const activeProject = useActiveProject();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "unconfirmed" | "unavailable" | "created">("idle");

  useEffect(() => {
    if (!userId) return;
    let next: "idle" | "unconfirmed" | "unavailable";
    try {
      next = pendingMonthlyRemix(window.sessionStorage, userId) ? "unconfirmed" : "idle";
    } catch {
      next = "unavailable";
    }
    const frame = window.requestAnimationFrame(() => setStatus(next));
    return () => window.cancelAnimationFrame(frame);
  }, [userId]);

  function createFromTemplate() {
    if (!userId || pending) return;
    let requestId: string;
    try {
      requestId = prepareMonthlyRemix(window.sessionStorage, userId, () => crypto.randomUUID());
    } catch {
      setStatus("unavailable");
      return;
    }
    startTransition(async () => {
      let workspaceId: string;
      try {
        ({ workspaceId } = await remixTemplateAction(MONTHLY_TEMPLATE_ID, requestId));
      } catch {
        // The server may have committed and the acknowledgement may be lost.
        // A replay uses the saved ID, never a fresh Project request.
        setStatus("unconfirmed");
        return;
      }
      const id = parseProjectId(workspaceId);
      if (!id) {
        setStatus("unconfirmed");
        return;
      }
      try { confirmMonthlyRemix(window.sessionStorage, userId, requestId); }
      catch { /* A stale saved ID only reopens this same Project on replay. */ }
      try {
        if (activeProject?.enabled) {
          const selection = activeProject.selectProject({ id, name: MONTHLY_PROJECT_NAME }, { surface: "tasks" });
          if (selection.kind !== "started") {
            setStatus("created");
            router.refresh();
            return;
          }
        } else {
          await selectWorkspaceAction(id);
          window.sessionStorage.setItem("signal-tasks.recent-project", id);
          router.refresh();
        }
        onCreated?.();
      } catch {
        setStatus("created");
        router.refresh();
      }
    });
  }

  return (
    <div className={classNames.wrap}>
      <button
        className={classNames.choice}
        disabled={pending || !isLoaded || !userId || status === "created"}
        onClick={createFromTemplate}
        type="button"
      >
        {status === "unconfirmed" ? "Check monthly starter Project" : "Start with Monthly business rhythm"}
      </button>
      <p className={classNames.help}>A new Project with 18 starter tasks. Dates are yours to set.</p>
      {status === "unconfirmed" ? <p className={classNames.status} role="status">We couldn’t confirm the first attempt. Check again to open the same Project.</p> : null}
      {status === "unavailable" ? <p className={classNames.status} role="status">A safe retry isn’t available in this browser. Check your Projects list before trying again.</p> : null}
      {status === "created" ? <p className={classNames.status} role="status">Project created. Open it from your Projects list when you’re ready.</p> : null}
    </div>
  );
}
