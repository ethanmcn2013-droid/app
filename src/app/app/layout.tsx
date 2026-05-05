import { Suspense } from "react";
import { AppSidebar } from "@/components/app/sidebar";
import { TasksProvider } from "@/lib/tasks/tasks-context";
import { TaskDetailPanel } from "@/components/app/detail-panel/task-detail-panel";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TasksProvider>
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
