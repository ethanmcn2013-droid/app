import { TasksRuntimeShell } from "@/components/app/tasks-runtime-shell";

export default function MyTasksLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeShell>{children}</TasksRuntimeShell>;
}
