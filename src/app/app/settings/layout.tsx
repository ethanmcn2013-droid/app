import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
