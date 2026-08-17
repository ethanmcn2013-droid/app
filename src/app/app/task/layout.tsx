import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export default function TaskLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
