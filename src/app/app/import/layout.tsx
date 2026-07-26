import { TasksRuntimeShell } from "@/components/app/tasks-runtime-shell";

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeShell>{children}</TasksRuntimeShell>;
}
