import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export default function YourWorkLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
