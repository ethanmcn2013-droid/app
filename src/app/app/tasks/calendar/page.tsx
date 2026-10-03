import { HybridWorkspace } from "@/components/hybrid/hybrid-workspace";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { tasksViewCapabilities } from "../capabilities";

export const metadata = { title: "Calendar · Tasks · Signal Studio" };

export default async function TasksCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string | string[]; preview?: string }>;
}) {
  const sp = await searchParams;
  const { canEdit, canManage } = await tasksViewCapabilities(sp.workspaceId, sp.preview);
  // The view renders entirely from the runtime's providers, so the whole
  // surface, chrome and content together, follows the URL's Project when
  // the flag-on page mount consumes it (D-022).
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <HybridWorkspace view="calendar" canEdit={canEdit} canManage={canManage} />
    </TasksRuntimePageMount>
  );
}
