import { Suspense } from "react";
import { AppSidebar } from "@/components/app/sidebar";
import { TasksProvider } from "@/lib/tasks/tasks-context";
import { TaskDetailPanel } from "@/components/app/detail-panel/task-detail-panel";
import { getTasks } from "@/server/db/queries";

// Layout reads from a runtime DB; mark dynamic so Next doesn't try
// to prerender app routes against a build-time empty DB.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tasks = await getTasks();
  return (
    <TasksProvider initialTasks={tasks}>
      <div className="flex h-screen w-full overflow-hidden bg-bg">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <Suspense fallback={null}>
        <TaskDetailPanel />
      </Suspense>
    </TasksProvider>
  );
}
