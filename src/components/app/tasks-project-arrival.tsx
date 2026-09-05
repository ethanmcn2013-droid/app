import "server-only";
import Link from "next/link";
import { isActiveProjectV3Enabled } from "@/lib/projects/flags";
import { HOME_APP_PATH } from "@/lib/product-urls";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { ActiveProjectRouteSync } from "./active-project-route-sync";
import { OpenTasksProject } from "./open-tasks-project";

/** Prove the explicit route before rendering any target project content. */
export async function resolveTasksArrival(requested?: string | string[]) {
  const project = await resolveProjectForRoute(requested);
  if (project.kind !== "ready" && project.kind !== "archived") {
    return { kind: "unavailable" as const };
  }
  // A flag-off layout cannot consume searchParams. Offer an explicit POST
  // selection instead of putting its ambient task data beneath a B URL.
  if (requested !== undefined && !isActiveProjectV3Enabled()) {
    const ambient = await resolveProjectForRoute(undefined);
    if ((ambient.kind !== "ready" && ambient.kind !== "archived") || ambient.workspaceId !== project.workspaceId) {
      return { kind: "selection-required" as const, project };
    }
  }
  return { kind: "ready" as const, project };
}

export function TasksArrivalRefusal({ arrival, requested, surface, taskId }: {
  arrival: Exclude<Awaited<ReturnType<typeof resolveTasksArrival>>, { kind: "ready" }>;
  requested?: string | string[];
  surface: "tasks" | "my-work";
  taskId?: string;
}) {
  const project = arrival.kind === "selection-required" ? arrival.project : null;
  return (
    <>
      <ActiveProjectRouteSync project={null} requestedProjectId={typeof requested === "string" ? requested : null} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-[22px] font-medium tracking-tight text-ink">{project ? `This link opens ${project.name}` : "Project unavailable"}</h1>
        <p className="max-w-sm text-[14px] leading-relaxed text-ink-soft">
          {project ? (project.kind === "archived" ? "This project is archived. Return to Home to choose an active project." : "You have a different project open. Continue to change your active project and open this work.") : "This link does not name a project you can open. It may have been removed, or your access may have changed."}
        </p>
        {project?.kind === "ready" ? <OpenTasksProject workspaceId={project.workspaceId} name={project.name} surface={surface} taskId={taskId} /> : null}
        <Link href={HOME_APP_PATH} className="inline-flex min-h-[44px] items-center text-[14px] text-ink-soft underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">Go to Home</Link>
      </div>
    </>
  );
}
