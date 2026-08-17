import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
