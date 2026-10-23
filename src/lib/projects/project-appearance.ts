/** Shared Project identity: a fixed palette token, never an arbitrary CSS value. */
export const PROJECT_COLOR_INDICES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type ProjectColorIndex = typeof PROJECT_COLOR_INDICES[number];
export const PROJECT_COLOR_CHANGED_EVENT = "signal:project-color-changed";
export const PROJECT_ROWS_CHANGED_EVENT = "signal:project-rows-changed";
export function projectColorMetaKey(projectId: string): string { return `project-color:${projectId}`; }
export function parseProjectColorIndex(value: unknown): ProjectColorIndex | null {
  const number = typeof value === "string" && /^[1-8]$/.test(value) ? Number(value) : value;
  return PROJECT_COLOR_INDICES.includes(number as ProjectColorIndex) ? number as ProjectColorIndex : null;
}
export function projectColorToken(index: ProjectColorIndex): string { return `var(--v3-project-${index})`; }
