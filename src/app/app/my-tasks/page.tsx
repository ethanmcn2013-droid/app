import { AppPageHeader } from "@/components/app/page-header";
import { MyWeekApp } from "@/components/app/my-week/my-week-app";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";

export const dynamic = "force-dynamic";

export default function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string | string[] }>;
}) {
  // MyWeekApp reads the runtime's own task state, so chrome and content move
  // together when the flag-on page mount consumes the URL's Project (D-022).
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <AppPageHeader />
      <MyWeekApp />
    </TasksRuntimePageMount>
  );
}
