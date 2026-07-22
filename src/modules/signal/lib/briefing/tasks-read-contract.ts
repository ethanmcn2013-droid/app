import contract from "./tasks-read-contract.v1.json";

export const TASKS_READ_CONTRACT_VERSION = contract.version;
export const TASKS_READ_TIMEOUT_MS = contract.timeoutMs;

export type TasksBriefingQuery = Readonly<{
  subject: string;
  workspaceId?: string;
}>;

export function assertTasksBriefingQuery(query: TasksBriefingQuery): void {
  if (!query.subject.trim()) throw new TypeError("Tasks read subject is required");
  if (query.workspaceId !== undefined && !query.workspaceId.trim()) {
    throw new TypeError("Tasks read workspaceId cannot be blank");
  }
}
