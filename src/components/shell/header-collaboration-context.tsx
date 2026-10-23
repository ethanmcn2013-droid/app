"use client";

import { Suspense, createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { EMPTY_HEADER_SLOT, headerRouteKey, headerSlotReducer, type HeaderCollaborationData, type HeaderSlotEvent, type HeaderSlotState } from "@/lib/projects/header-collaboration-scope";

const Context = createContext<{ state: HeaderSlotState; dispatch: Dispatch<HeaderSlotEvent> } | null>(null);

export function HeaderCollaborationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(headerSlotReducer, EMPTY_HEADER_SLOT);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHeaderCollaboration() { return useContext(Context); }

/** A verified route payload can publish in one navigation epoch only. */
export function HeaderCollaborationPublisher({ data }: { data: HeaderCollaborationData | null }) {
  return <Suspense fallback={null}><PublishCurrentPage data={data} /></Suspense>;
}

function PublishCurrentPage({ data }: { data: HeaderCollaborationData | null }) {
  const context = useHeaderCollaboration();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const liveKey = headerRouteKey(pathname, new URLSearchParams(search.toString()));
  const dispatch = context?.dispatch;
  const routeKey = context?.state.routeKey;
  const epoch = context?.state.epoch;
  const stamp = useRef<{ data: HeaderCollaborationData | null; epoch: number | null }>({ data: null, epoch: null });
  useEffect(() => {
    if (stamp.current.data !== data) stamp.current = { data, epoch: null };
    if (!data || !dispatch || routeKey !== liveKey || epoch === undefined) return;
    // Stamp even a mismatched late payload; it cannot become valid on a later visit.
    if (stamp.current.epoch === null) stamp.current.epoch = epoch;
    // Returning to A after A → B must wait for a fresh A server payload.
    if (routeKey !== data.routeKey || stamp.current.epoch !== epoch) return;
    const owner = Symbol("page collaboration");
    dispatch({ type: "publish", owner, epoch, data });
    return () => dispatch({ type: "remove", owner });
  }, [data, dispatch, routeKey, liveKey, epoch]);
  return null;
}
