import { TasksRuntimeLayoutMount } from "@/components/app/tasks-runtime-mount";

export const metadata = { title: "Tasks · Signal Studio" };

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <TasksRuntimeLayoutMount>{children}</TasksRuntimeLayoutMount>;
}
