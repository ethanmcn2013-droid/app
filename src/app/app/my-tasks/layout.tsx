import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export default function MyTasksLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
