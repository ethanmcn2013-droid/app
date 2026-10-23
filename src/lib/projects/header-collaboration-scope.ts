import type { ProjectId } from "./project-ref";

export type HeaderCollaborationData = Readonly<{
  routeKey: string;
  projectId: ProjectId;
  projectName: string;
  href: string;
  canInvite: boolean;
  members: readonly Readonly<{ id: string; name: string; initials: string; role: "owner" | "member" }>[];
}>;

export type HeaderParams = Record<string, string | string[] | undefined>;

export function headerSearch(params: HeaderParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  return search;
}

/** Full query identity: scope-only navigation must also withdraw the old header. */
export function headerRouteKey(pathname: string, params: URLSearchParams): string {
  const sorted = new URLSearchParams(params);
  sorted.sort();
  return `${pathname}?${sorted}`;
}

export function headerScopeAllowed(pathname: string, params: URLSearchParams): boolean {
  return pathname === "/app/files" || (
    pathname === "/app/analytics" && params.get("scope") !== "all" && params.get("view") !== "projects"
  );
}

/** Authenticated navigation only; this never generates a public sharing token. */
export function headerMemberHref(pathname: "/app/files" | "/app/analytics", params: URLSearchParams, projectId: ProjectId): string {
  const safe = new URLSearchParams({ workspaceId: projectId });
  for (const key of pathname === "/app/files" ? ["source", "archived"] : ["ask", "range"]) {
    const value = params.get(key);
    if (value) safe.set(key, value);
  }
  return `${pathname}?${safe}`;
}

export type HeaderSlotState = Readonly<{
  routeKey: string | null;
  epoch: number;
  slot: { owner: symbol; epoch: number; data: HeaderCollaborationData } | null;
}>;
export type HeaderSlotEvent =
  | { type: "route"; routeKey: string }
  | { type: "publish"; owner: symbol; epoch: number; data: HeaderCollaborationData }
  | { type: "remove"; owner: symbol };
export const EMPTY_HEADER_SLOT: HeaderSlotState = { routeKey: null, epoch: 0, slot: null };

export function headerSlotReducer(state: HeaderSlotState, event: HeaderSlotEvent): HeaderSlotState {
  if (event.type === "route") return event.routeKey === state.routeKey ? state : { routeKey: event.routeKey, epoch: state.epoch + 1, slot: null };
  if (event.type === "remove") return state.slot?.owner === event.owner ? { ...state, slot: null } : state;
  if (event.epoch !== state.epoch || event.data.routeKey !== state.routeKey) return state;
  return { ...state, slot: { owner: event.owner, epoch: event.epoch, data: event.data } };
}

export function visibleHeaderData(state: HeaderSlotState, liveKey: string): HeaderCollaborationData | null {
  return state.routeKey === liveKey && state.slot?.epoch === state.epoch && state.slot.data.routeKey === liveKey ? state.slot.data : null;
}
