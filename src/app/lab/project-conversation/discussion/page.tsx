import { notFound } from "next/navigation";
import { TaskDiscussionPreview } from "@/components/app/messages/task-discussion-preview";

export default async function TaskDiscussionLab({ searchParams }: { searchParams: Promise<{ actor?: string; task?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const actor = params.actor === "bob" ? "synthetic_bob" : params.actor === "charlie" ? "synthetic_charlie" : "synthetic_alice";
  const task = params.task === "b" ? "synthetic_task_b" : "synthetic_task_a";
  return <TaskDiscussionPreview key={`${actor}:${task}`} actor={actor} task={task} />;
}
