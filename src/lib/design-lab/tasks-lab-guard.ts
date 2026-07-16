export type TasksLabGuardInput = {
  nodeEnv: string | undefined;
  vercelEnv?: string | undefined;
  flag: string | undefined;
  reviewMode: boolean;
};

export function isTasksDesignLabEnabled(input: TasksLabGuardInput): boolean {
  const isLocalReview = input.nodeEnv === "development";
  const isPreviewReview = input.vercelEnv === "preview";
  return (isLocalReview || isPreviewReview) && input.flag === "true" && input.reviewMode;
}
