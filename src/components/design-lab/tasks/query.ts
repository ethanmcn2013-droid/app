import {
  LAB_DATASETS,
  LAB_DENSITIES,
  LAB_MODES,
  LAB_OPTIONS,
  LAB_VIEWS,
  type LabRouteState,
} from "./types";

export const DEFAULT_LAB_ROUTE: LabRouteState = {
  option: "a",
  view: "board",
  dataset: "normal",
  density: "compact",
  mode: "default",
  task: null,
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

export function parseLabRoute(search: string): LabRouteState {
  const params = new URLSearchParams(search);
  return {
    option: oneOf(params.get("option"), LAB_OPTIONS, DEFAULT_LAB_ROUTE.option),
    view: oneOf(params.get("view"), LAB_VIEWS, DEFAULT_LAB_ROUTE.view),
    dataset: oneOf(params.get("dataset"), LAB_DATASETS, DEFAULT_LAB_ROUTE.dataset),
    density: oneOf(params.get("density"), LAB_DENSITIES, DEFAULT_LAB_ROUTE.density),
    mode: oneOf(params.get("mode"), LAB_MODES, DEFAULT_LAB_ROUTE.mode),
    task: params.get("task")?.slice(0, 80) || null,
  };
}

export function routeSearch(route: LabRouteState): string {
  const params = new URLSearchParams({
    option: route.option,
    view: route.view,
    dataset: route.dataset,
    density: route.density,
    mode: route.mode,
  });
  if (route.task) params.set("task", route.task);
  return `?${params.toString()}`;
}

export function replaceLabRoute(route: LabRouteState): void {
  window.history.replaceState(null, "", `${window.location.pathname}${routeSearch(route)}`);
}
