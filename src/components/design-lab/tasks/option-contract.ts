import type { LabRouteState } from "./types";

export type TasksOptionProps = {
  route: LabRouteState;
  onRouteChange: (patch: Partial<LabRouteState>) => void;
};
