"use server";

import { getActivitiesForTask } from "@/server/db/queries";
import type { Activity } from "@/lib/data";

export async function getActivitiesForTaskAction(
  taskId: string,
): Promise<Activity[]> {
  return getActivitiesForTask(taskId);
}
