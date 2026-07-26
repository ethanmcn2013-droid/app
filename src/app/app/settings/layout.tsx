import { TasksRuntimeShell } from "@/components/app/tasks-runtime-shell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeShell>{children}</TasksRuntimeShell>;
}
