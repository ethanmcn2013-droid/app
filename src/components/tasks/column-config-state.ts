import type { ColumnConfig } from "@/lib/board-config";

export type OptimisticBoardConfigState = Readonly<{
  projectId: string | null;
  serverConfig: ColumnConfig | null;
  optimistic: ColumnConfig | null;
  epoch: number;
}>;

export function initialBoardConfigState(
  projectId: string | null,
  serverConfig: ColumnConfig | null,
): OptimisticBoardConfigState {
  return { projectId, serverConfig, optimistic: serverConfig, epoch: 0 };
}

/** A Project switch resets even when both Projects have the same/null config. */
export function syncBoardConfigState(
  state: OptimisticBoardConfigState,
  projectId: string | null,
  serverConfig: ColumnConfig | null,
): OptimisticBoardConfigState {
  if (state.projectId === projectId && state.serverConfig === serverConfig) return state;
  return {
    projectId,
    serverConfig,
    optimistic: serverConfig,
    epoch: state.epoch + 1,
  };
}

/** A late result from an old render cannot write into the new Project. */
export function setBoardOptimisticForEpoch(
  state: OptimisticBoardConfigState,
  projectId: string,
  epoch: number,
  config: ColumnConfig | null,
): OptimisticBoardConfigState {
  return state.projectId === projectId && state.epoch === epoch
    ? { ...state, optimistic: config }
    : state;
}
