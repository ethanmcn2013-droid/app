/** Name the real Floor from persisted Project data before domain examples. */
export function floorProjectName(input: {
  boardName: string | null;
  workspaceName: string | null;
  domainExample: string | null;
}): string {
  return input.boardName?.trim() || input.workspaceName?.trim() || input.domainExample?.trim() || "This project";
}
