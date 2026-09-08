import { getArchivedTasks } from "@/server/db/queries";
import { resolveTasksArrival, TasksArrivalRefusal } from "@/components/app/tasks-project-arrival";
import { AppPageHeader } from "@/components/app/page-header";
import { ArchivedApp } from "@/components/app/archived/archived-app";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";

export const dynamic = "force-dynamic";

export default async function ArchivedPage({ searchParams }: {
  searchParams: Promise<{ workspaceId?: string | string[] }>;
}) {
  const requested = (await searchParams).workspaceId;
  const arrival = await resolveTasksArrival(requested);
  if (arrival.kind !== "ready") {
    return <TasksArrivalRefusal arrival={arrival} requested={requested} surface="archive" />;
  }
  // Content and runtime follow the same authorized Project. The flag-off
  // mismatch has already refused before this archive read.
  const tasks = await getArchivedTasks(arrival.project.workspaceId);
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <AppPageHeader />
      <ArchivedApp tasks={tasks} />
    </TasksRuntimePageMount>
  );
}
