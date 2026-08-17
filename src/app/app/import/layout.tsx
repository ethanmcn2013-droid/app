import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
