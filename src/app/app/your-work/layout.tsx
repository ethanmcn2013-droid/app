import { TasksRuntimeShell } from "@/components/app/tasks-runtime-shell";

export default function YourWorkLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeShell>{children}</TasksRuntimeShell>;
}
