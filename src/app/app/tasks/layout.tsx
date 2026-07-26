import { TasksRuntimeShell } from "@/components/app/tasks-runtime-shell";

export const metadata = { title: "Tasks · Signal Studio" };

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeShell>{children}</TasksRuntimeShell>;
}
