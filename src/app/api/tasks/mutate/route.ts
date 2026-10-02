import "server-only";

import {
  addTaskAction,
  getTasksAction,
  toggleCompleteAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import type { Task } from "@/lib/data";
import { isTaskMutationRefused } from "@/server/tasks/mutation-refusal";
import { createTaskMutationHttp } from "@/server/tasks/mutation-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createTaskMutationHttp({
  read: getTasksAction,
  create: addTaskAction,
  edit: (id, patch, expectedProjectId) =>
    updateTaskAction(id, patch as Partial<Omit<Task, "id">>, expectedProjectId),
  toggleComplete: toggleCompleteAction,
}, isTaskMutationRefused);
