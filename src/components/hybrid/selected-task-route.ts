import type { LabRouteState } from "./types";

/** Keep Floor's route model aligned with the production detail panel. */
export function withInspectedTask(
  route: LabRouteState,
  inspectedId: string | null,
): LabRouteState {
  return route.task === inspectedId ? route : { ...route, task: inspectedId };
}
