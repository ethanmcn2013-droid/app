import { redirect } from "next/navigation";
import { TASKS_VIEW_PATHS } from "@/lib/product-urls";

export const metadata = { title: "Tasks · Signal Studio" };

/**
 * The Schedule view is retired. Links people already have to
 * /app/tasks/timeline land on the board, keeping the project and any open
 * task, so nothing they bookmarked or shared goes nowhere.
 */
export default async function TasksTimelineRedirect({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string | string[]; task?: string | string[] }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  const workspaceId = Array.isArray(sp.workspaceId) ? sp.workspaceId[0] : sp.workspaceId;
  const task = Array.isArray(sp.task) ? sp.task[0] : sp.task;
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (task) params.set("task", task);
  const query = params.toString();
  redirect(query ? `${TASKS_VIEW_PATHS.board}?${query}` : TASKS_VIEW_PATHS.board);
}
