import { AppPageHeader } from "@/components/app/page-header";
import { MyWeekApp } from "@/components/app/my-week/my-week-app";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { resolveTasksArrival, TasksArrivalRefusal } from "@/components/app/tasks-project-arrival";

export const dynamic = "force-dynamic";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string | string[] }>;
}) {
  const requested = (await searchParams).workspaceId;
  const arrival = await resolveTasksArrival(requested);
  if (arrival.kind !== "ready") {
    return <TasksArrivalRefusal arrival={arrival} requested={requested} surface="my-work" />;
  }
  // MyWeekApp reads the runtime's own task state, so chrome and content move
  // together when the flag-on page mount consumes the URL's Project (D-022).
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <AppPageHeader />
      <MyWeekApp canSetUpProject={arrival.project.project.capabilities.manageProject && arrival.project.project.capabilities.createOrEditTasks} />
    </TasksRuntimePageMount>
  );
}
