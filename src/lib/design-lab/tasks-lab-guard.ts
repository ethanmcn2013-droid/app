export type TasksLabGuardInput = {
  nodeEnv: string | undefined;
  flag: string | undefined;
  reviewMode: boolean;
};

export function isTasksDesignLabEnabled(input: TasksLabGuardInput): boolean {
  return input.nodeEnv === "development" && input.flag === "true" && input.reviewMode;
}
